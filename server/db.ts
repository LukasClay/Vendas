import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  appSettings,
  auditLogs,
  clients,
  consultationSlots,
  InsertProduct,
  InsertReportSchedule,
  InsertSale,
  InsertUser,
  products,
  reportSchedules,
  sales,
  userSessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  getLocalLoginHealth,
  type LocalLoginHealthResult,
} from "./_core/localLoginHealth";
import {
  buildClientAccessCondition,
  type ClientAccessActor,
} from "./clientAccess";
import {
  ClientIdentityConflictError,
  ClientNotFoundError,
  getSafeClientEnrichment,
  normalizeClientBirthDate,
  normalizeClientName,
  normalizeClientPhone,
  type ClientIdentityDate,
} from "./clientIdentity";
import { getSaoPauloDateTimeParts } from "./consultationSlotAvailability";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export interface AdminUserListItem extends LocalLoginHealthResult {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "consultora" | "admin";
  displayName: string | null;
  phone: string | null;
  active: boolean;
  username: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  monthlyGoal: string | null;
}

/** Extrai rows de resultado de db.execute() (compatível com diferentes versões do driver) */
function extractRows(result: unknown): Record<string, unknown>[] {
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.rows)) return r.rows as Record<string, unknown>[];
  if (Array.isArray(r[0])) return r[0] as Record<string, unknown>[];
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return [];
}

export async function getDb() {
  if (_db) return _db;
  // Prefere RAILWAY_DATABASE_URL (PostgreSQL real) sobre DATABASE_URL (TiDB do Manus)
  const connStr = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  _pool = new Pool({
    connectionString: connStr,
    max: 20,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  _db = drizzle(_pool);
  return _db;
}

// M2: retry real com backoff exponencial para erros transitórios de conexão
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Só faz retry em erros transitórios de conexão
      const message = String(error).toLowerCase();
      const isTransient =
        message.includes("connection") ||
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("econnrefused") ||
        message.includes("terminating");

      if (!isTransient || attempt === maxAttempts) throw error;

      // Backoff exponencial: 200ms, 400ms
      const delay = 200 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(): Promise<AdminUserListItem[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      phone: users.phone,
      active: users.active,
      username: users.username,
      passwordHash: users.passwordHash,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      monthlyGoal: users.monthlyGoal,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.name));

  return rows.map(({ passwordHash, deletedAt, ...user }) => ({
    ...user,
    ...getLocalLoginHealth({
      active: user.active,
      deletedAt,
      username: user.username,
      passwordHash,
    }),
  }));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      phone: users.phone,
      active: users.active,
      username: users.username,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      deletedAt: users.deletedAt,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;

  // ⚠️ SOFT DELETE SEGURO: Histórico de vendas é sempre preservado
  // Passo 1: Salvar snapshot do nome do funcionário ANTES de qualquer alteração
  const user = await getUserById(id);
  if (!user) return;

  const snapshotName =
    user.displayName || user.name || user.username || `Usuário #${id}`;

  // Passo 1a: PROTEGER histórico de vendas — salvar snapshot do nome em todas as vendas
  // Isso garante que mesmo depois de deletado, o nome aparece corretamente nos relatórios
  await db
    .update(sales)
    .set({ sellerName: snapshotName })
    .where(and(eq(sales.sellerId, id), sql`${sales.sellerName} IS NULL`));

  // Passo 2: APENAS renomear username/openId para liberar para novos cadastros
  // O suffix _old segue o padrão do projeto (não altera dados na tabela sales)
  const suffix = `_old`;
  const newUsername = user.username ? `${user.username}${suffix}` : null;
  const newOpenId = `${user.openId}${suffix}`;

  // Passo 3: Marcar como deletado, inativo e invalidar sessões ativas
  // ⚠️ IMPORTANTE: Tabela sales NÃO é tocada aqui (histórico 100% preservado)
  await db
    .update(users)
    .set({
      active: false,
      deletedAt: new Date(),
      username: newUsername,
      openId: newOpenId,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(
  includeInactive = false,
  includeDeleted = false
) {
  const db = await getDb();
  if (!db) return [];
  try {
    if (includeDeleted) {
      // Retorna TODOS os produtos (ativos, inativos e excluídos) — para aba Lixeira no ADM
      return await db.select().from(products).orderBy(asc(products.name));
    }
    // Sempre filtra produtos com soft delete (deletedAt IS NULL)
    if (includeInactive)
      return await db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(asc(products.name));
    return await db
      .select()
      .from(products)
      .where(and(eq(products.active, true), isNull(products.deletedAt)))
      .orderBy(asc(products.name));
  } catch (e: unknown) {
    console.error(
      "[getAllProducts] Erro:",
      e instanceof Error ? e.message : String(e)
    );
    return [];
  }
}

export async function findDeletedProductByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(products)
    .where(
      and(
        sql`LOWER(${products.name}) = LOWER(${name})`,
        isNotNull(products.deletedAt)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function restoreProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(products)
    .set({ active: true, deletedAt: null })
    .where(eq(products.id, id));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function findActiveProductByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(products)
    .where(
      and(
        sql`LOWER(${products.name}) = LOWER(${name})`,
        isNull(products.deletedAt)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  // Bloqueia exclusão de produtos do sistema
  const product = await getProductById(id);
  if (product?.isSystem)
    throw new Error("Produto do sistema não pode ser excluído.");
  // Soft delete: marca deletedAt e desativa — productName já é snapshot nas vendas
  await db
    .update(products)
    .set({ active: false, deletedAt: new Date() })
    .where(eq(products.id, id));
}

// ─── Garante que produtos do sistema existam no banco ─────────────────────────
export const SYSTEM_PRODUCTS = [
  {
    name: "Consulta Cartas",
    description:
      "Consulta espiritual com horário agendado (produto do sistema)",
    isSystem: true,
    active: true,
  },
] as const;

export async function ensureSystemProducts() {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[SystemProducts] Banco não disponível, pulando criação de produtos do sistema."
    );
    return;
  }

  // 1. Garante que a coluna isSystem existe (auto-migração)
  try {
    await db.execute(
      sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false`
    );
    console.log("[SystemProducts] Coluna isSystem verificada/criada.");
  } catch (e: unknown) {
    // Se der erro (ex: versão antiga do PG sem IF NOT EXISTS), ignora
    console.warn(
      "[SystemProducts] Aviso ao verificar coluna isSystem:",
      e instanceof Error ? e.message : String(e)
    );
  }

  // 2. Garante que cada produto do sistema existe
  for (const sp of SYSTEM_PRODUCTS) {
    try {
      // Usa SQL direto para ser resiliente a qualquer estado do schema
      const existing = await db.execute(
        sql`SELECT id, active, "isSystem", "deletedAt" FROM products WHERE name = ${sp.name} LIMIT 1`
      );
      const rows = extractRows(existing);

      if (rows.length > 0) {
        const p = rows[0];
        if (!p.isSystem || !p.active || p.deletedAt) {
          await db.execute(
            sql`UPDATE products SET "isSystem" = true, active = true, "deletedAt" = NULL, "updatedAt" = NOW() WHERE id = ${p.id}`
          );
          console.log(
            `[SystemProducts] Produto "${sp.name}" restaurado/atualizado (id=${p.id}).`
          );
        } else {
          console.log(
            `[SystemProducts] Produto "${sp.name}" já existe (id=${p.id}). OK.`
          );
        }
      } else {
        await db.execute(
          sql`INSERT INTO products (name, description, active, "isSystem", "createdAt", "updatedAt") VALUES (${sp.name}, ${sp.description}, true, true, NOW(), NOW())`
        );
        console.log(
          `[SystemProducts] Produto "${sp.name}" criado com sucesso.`
        );
      }
    } catch (e: unknown) {
      console.error(
        `[SystemProducts] Erro ao processar "${sp.name}":`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

export async function ensurePhotoColumns() {
  const db = await getDb();
  if (!db) return;
  const columns = [
    { name: "photo1Url", def: "text" },
    { name: "photo1Key", def: "varchar(512)" },
    { name: "photo2Url", def: "text" },
    { name: "photo2Key", def: "varchar(512)" },
    { name: "attachmentExtras", def: "jsonb" },
    { name: "photoExtras", def: "jsonb" },
  ];
  for (const col of columns) {
    try {
      await db.execute(
        sql`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS ${sql.raw(`"${col.name}" ${col.def}`)}`
      );
    } catch (e: unknown) {
      console.warn(
        `[PhotoColumns] Aviso ao adicionar ${col.name}:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }
  console.log("[PhotoColumns] Colunas de foto verificadas/criadas.");
}

export async function ensureMonthlyGoalColumn() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyGoal" numeric(12,2)`
    );
    console.log("[MonthlyGoal] Coluna monthlyGoal verificada/criada.");
  } catch (e: unknown) {
    console.warn(
      "[MonthlyGoal] Aviso ao adicionar coluna:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export interface ClientForSaleInput {
  clientId?: number;
  fullName: string;
  birthDate?: ClientIdentityDate;
  phone?: string | null;
}

export interface ResolvedClient {
  id: number;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
}

export type ClientResolutionDatabase = NonNullable<
  Awaited<ReturnType<typeof getDb>>
>;

const clientIdentityProjection = {
  id: clients.id,
  fullName: clients.fullName,
  birthDate: clients.birthDate,
  phone: clients.phone,
};

export async function resolveClientForSale(
  data: ClientForSaleInput,
  actor: ClientAccessActor
): Promise<ResolvedClient> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return resolveClientForSaleWithDb(db, data, actor);
}

export async function resolveClientForSaleWithDb(
  db: ClientResolutionDatabase,
  data: ClientForSaleInput,
  actor: ClientAccessActor
): Promise<ResolvedClient> {
  const requestedIdentity = {
    id: data.clientId,
    fullName: data.fullName,
    birthDate: data.birthDate,
    phone: data.phone,
  };

  const resolveExisting = async (
    existing: ResolvedClient
  ): Promise<ResolvedClient> => {
    let current = existing;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const enrichment = getSafeClientEnrichment(current, requestedIdentity);
      if (Object.keys(enrichment).length === 0) return current;

      const updateConditions: SQL[] = [eq(clients.id, current.id)];
      if ("birthDate" in enrichment) {
        updateConditions.push(isNull(clients.birthDate));
      }
      if ("phone" in enrichment) {
        updateConditions.push(isNull(clients.phone));
      }
      const updateScope = buildClientAccessCondition(db, actor);
      if (updateScope) updateConditions.push(updateScope);

      const updated = await db
        .update(clients)
        .set(enrichment)
        .where(and(...updateConditions))
        .returning(clientIdentityProjection);
      if (updated[0]) return updated[0];

      const refreshScope = buildClientAccessCondition(db, actor);
      const refreshCondition = refreshScope
        ? and(eq(clients.id, current.id), refreshScope)
        : eq(clients.id, current.id);
      const refreshed = await db
        .select(clientIdentityProjection)
        .from(clients)
        .where(refreshCondition)
        .limit(1);
      if (!refreshed[0]) throw new ClientNotFoundError(current.id);
      current = refreshed[0];
    }

    const remaining = getSafeClientEnrichment(current, requestedIdentity);
    if (Object.keys(remaining).length === 0) return current;
    throw new Error("Client changed concurrently; retry the operation");
  };
  if (data.clientId !== undefined) {
    const clientScope = buildClientAccessCondition(db, actor);
    const conditions = clientScope
      ? and(eq(clients.id, data.clientId), clientScope)
      : eq(clients.id, data.clientId);
    const existing = await db
      .select(clientIdentityProjection)
      .from(clients)
      .where(conditions)
      .limit(1);

    if (!existing[0]) {
      throw new ClientNotFoundError(data.clientId);
    }

    return resolveExisting(existing[0]);
  }

  const normalizedPhone = normalizeClientPhone(data.phone);
  if (normalizedPhone) {
    const storedPhoneValue = sql<string>`btrim(coalesce(${clients.phone}, ''))`;
    const storedPhoneDigits = sql<string>`regexp_replace(
      ${storedPhoneValue},
      '[^0-9]',
      '',
      'g'
    )`;
    const normalizedStoredPhone = sql<string>`case
      when left(${storedPhoneDigits}, 4) = '0055'
        and length(${storedPhoneDigits}) in (14, 15)
        then substring(${storedPhoneDigits} from 5)
      when left(${storedPhoneDigits}, 2) = '55'
        and length(${storedPhoneDigits}) in (12, 13)
        then substring(${storedPhoneDigits} from 3)
      when left(${storedPhoneValue}, 2) = '00'
        then '+' || substring(${storedPhoneDigits} from 3)
      when left(${storedPhoneValue}, 1) = '+'
        or length(${storedPhoneDigits}) > 11
        then '+' || ${storedPhoneDigits}
      else ${storedPhoneDigits}
    end`;

    const phoneMatch = sql`${normalizedStoredPhone} = ${normalizedPhone}`;
    const clientScope = buildClientAccessCondition(db, actor);
    const candidates = await db
      .select(clientIdentityProjection)
      .from(clients)
      .where(clientScope ? and(phoneMatch, clientScope) : phoneMatch)
      .orderBy(asc(clients.id))
      .limit(20);

    let firstConflict: ClientIdentityConflictError | undefined;
    for (const candidate of candidates) {
      try {
        return await resolveExisting(candidate);
      } catch (error) {
        if (error instanceof ClientIdentityConflictError) {
          firstConflict ??= error;
          continue;
        }
        throw error;
      }
    }

    if (firstConflict) throw firstConflict;
  }

  normalizeClientName(data.fullName);
  const fullName = data.fullName.normalize("NFKC").trim().replace(/\s+/g, " ");
  const birthDate = normalizeClientBirthDate(data.birthDate);
  const result = await db
    .insert(clients)
    .values({
      fullName,
      birthDate,
      phone: normalizedPhone,
    })
    .returning(clientIdentityProjection);

  if (!result[0]) {
    throw new Error("Client insert did not return a row");
  }

  return result[0];
}
// ─── Sales ────────────────────────────────────────────────────────────────────

export interface SaleFilters {
  startDate?: Date;
  endDate?: Date;
  sellerId?: number;
  productName?: string;
  limit?: number;
  offset?: number;
}

// Retorna a empresa ativa no momento (para carimbar vendas)
export async function getActiveCompany(): Promise<
  "mundo_da_magia" | "mundo_cigano"
> {
  const db = await getDb();
  if (!db) return "mundo_da_magia";
  const rows = await withRetry(() =>
    db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "active_company"))
      .limit(1)
  );
  if (rows.length === 0) return "mundo_da_magia";
  return rows[0].value as "mundo_da_magia" | "mundo_cigano";
}

export class ConsultationSlotUnavailableError extends Error {
  constructor() {
    super("Consultation slot is no longer available");
    this.name = "ConsultationSlotUnavailableError";
  }
}

type SaleWithoutResolvedClient = Omit<
  InsertSale,
  "clientId" | "clientName" | "clientBirthDate" | "clientPhone"
>;
export interface CreateSaleAuditContext {
  userId: number;
  userName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateSaleWithResolvedClientInput {
  client: ClientForSaleInput;
  actor: ClientAccessActor;
  sale: SaleWithoutResolvedClient;
  consultationSlotId?: number;
  audit: CreateSaleAuditContext;
}

export async function createSaleWithResolvedClient(
  data: CreateSaleWithResolvedClientInput
): Promise<{ saleId: number; client: ResolvedClient }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const company = data.sale.company ?? (await getActiveCompany());

  return createSaleWithResolvedClientWithDb(db, data, company);
}

export async function createSaleWithResolvedClientWithDb(
  db: ClientResolutionDatabase,
  data: CreateSaleWithResolvedClientInput,
  company: "mundo_da_magia" | "mundo_cigano"
): Promise<{ saleId: number; client: ResolvedClient }> {
  return db.transaction(async transaction => {
    const normalizedPhone = normalizeClientPhone(data.client.phone);
    if (data.client.clientId === undefined && normalizedPhone) {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(
          hashtextextended(${`client-phone:${normalizedPhone}`}, 0)
        )`
      );
    }

    const client = await resolveClientForSaleWithDb(
      transaction as unknown as ClientResolutionDatabase,
      data.client,
      data.actor
    );

    const insertedSale = await transaction
      .insert(sales)
      .values({
        ...data.sale,
        company,
        clientId: client.id,
        clientName: client.fullName,
        clientBirthDate: client.birthDate,
        clientPhone: client.phone,
      })
      .returning({ id: sales.id });
    const saleId = insertedSale[0]?.id;
    if (!saleId) throw new Error("Sale insert did not return a row");

    if (data.consultationSlotId !== undefined) {
      const { date: today, time: nowTime } = getSaoPauloDateTimeParts();
      const updatedSlot = await transaction
        .update(consultationSlots)
        .set({ sold: true, saleId })
        .where(
          and(
            eq(consultationSlots.id, data.consultationSlotId),
            eq(consultationSlots.sold, false),
            isNull(consultationSlots.saleId),
            eq(consultationSlots.status, "pendente"),
            or(
              gt(consultationSlots.consultationDate, today),
              and(
                eq(consultationSlots.consultationDate, today),
                gt(consultationSlots.consultationTime, nowTime)
              )
            )
          )
        )
        .returning({ id: consultationSlots.id });
      if (updatedSlot.length === 0) {
        throw new ConsultationSlotUnavailableError();
      }
    }

    await transaction.insert(auditLogs).values({
      userId: data.audit.userId,
      userName: data.audit.userName,
      action: "Criou Venda",
      details: JSON.stringify({
        saleId,
        clientName: client.fullName,
        productName: data.sale.productName,
        amount: Number(data.sale.amount),
      }),
      ipAddress: data.audit.ipAddress ?? null,
      userAgent: data.audit.userAgent ?? null,
    });

    return { saleId, client };
  });
}

export async function getSales(filters: SaleFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (filters.startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${filters.startDate.toISOString().split("T")[0]}`
    );
  if (filters.endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${filters.endDate.toISOString().split("T")[0]}`
    );
  if (filters.sellerId) conditions.push(eq(sales.sellerId, filters.sellerId));
  if (filters.productName) {
    const escaped = filters.productName.replace(/[%_\\]/g, "\\$&");
    conditions.push(
      sql`${sales.productName} LIKE ${"%" + escaped + "%"} ESCAPE '\\'`
    );
  }

  const base = db
    .select({
      sale: sales,
      // Usa snapshot sellerName se disponível (vendedor excluído), senão busca do JOIN
      seller: {
        id: users.id,
        name: sql<string>`COALESCE(${sales.sellerName}, ${users.name})`,
        displayName: users.displayName,
      },
    })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id));

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered
    .orderBy(desc(sales.saleDate), desc(sales.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
}

export async function getSaleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), isNull(sales.deletedAt)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSalesBySeller(sellerId: number, fromDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(sales.sellerId, sellerId), isNull(sales.deletedAt)];
  if (fromDate) {
    conditions.push(
      sql`${sales.saleDate} >= ${fromDate.toISOString().split("T")[0]}`
    );
  }
  return db
    .select()
    .from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.saleDate));
}

export async function updateSale(id: number, data: Partial<InsertSale>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sales).set(data).where(eq(sales.id, id));
}

export async function deleteSale(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Libera o horário de consulta caso essa venda seja de uma "Consulta Cartas"
  await db
    .update(consultationSlots)
    .set({ sold: false, saleId: null, status: "pendente" })
    .where(eq(consultationSlots.saleId, id));

  // M1: soft delete — preserva o registro no banco
  await db.update(sales).set({ deletedAt: new Date() }).where(eq(sales.id, id));
}

// ─── Lixeira (Trash) ─────────────────────────────────────────────────────────

export async function getDeletedSales() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      sale: sales,
      sellerName: sql<string>`COALESCE(${sales.sellerName}, ${users.name})`,
      sellerDisplayName: users.displayName,
    })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id))
    .where(isNotNull(sales.deletedAt))
    .orderBy(desc(sales.deletedAt));
}

export async function restoreSale(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Restaura a venda (remove deletedAt)
  await db.update(sales).set({ deletedAt: null }).where(eq(sales.id, id));
}

export async function permanentDeleteSale(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Libera o horário de consulta se houver
  await db
    .update(consultationSlots)
    .set({ sold: false, saleId: null, status: "pendente" })
    .where(eq(consultationSlots.saleId, id));

  // Delete permanente real
  await db.delete(sales).where(eq(sales.id, id));
}

export async function cleanupExpiredTrash(daysOld = 30) {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  // Libera slots de consulta de todas as vendas expiradas numa única query
  await db.execute(
    sql`UPDATE consultation_slots SET sold = false, "saleId" = NULL, status = 'pendente'
        WHERE "saleId" IN (SELECT id FROM sales WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${cutoff.toISOString()})`
  );

  // Seleciona IDs antes de deletar para retornar contagem
  const expiredSales = await db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        isNotNull(sales.deletedAt),
        sql`${sales.deletedAt} < ${cutoff.toISOString()}`
      )
    );

  // Delete permanente
  await db
    .delete(sales)
    .where(
      and(
        isNotNull(sales.deletedAt),
        sql`${sales.deletedAt} < ${cutoff.toISOString()}`
      )
    );

  return expiredSales.length;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getReportSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalAmount: 0, totalSales: 0 };

  const conditions: SQL[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${startDate.toISOString().split("T")[0]}`
    );
  if (endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${endDate.toISOString().split("T")[0]}`
    );

  const base = db
    .select({
      totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
      totalSales: sql<number>`COUNT(*)`,
    })
    .from(sales);

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  const result = await filtered;

  return result[0] ?? { totalAmount: 0, totalSales: 0 };
}

export async function getReportSummaryByCompany(
  startDate?: Date,
  endDate?: Date
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [isNull(sales.deletedAt)];
  if (startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${startDate.toISOString().split("T")[0]}`
    );
  if (endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${endDate.toISOString().split("T")[0]}`
    );

  const base = db
    .select({
      company: sales.company,
      totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
      totalSales: sql<number>`COUNT(*)`,
    })
    .from(sales);

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered.groupBy(sales.company);
}

export async function getTopSellers(
  startDate?: Date,
  endDate?: Date,
  limit = 10
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${startDate.toISOString().split("T")[0]}`
    );
  if (endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${endDate.toISOString().split("T")[0]}`
    );

  const base = db
    .select({
      sellerId: sales.sellerId,
      // Usa snapshot sellerName se disponível, senão faz JOIN com users
      sellerName: sql<string>`COALESCE(${sales.sellerName}, ${users.name})`,
      sellerDisplayName: users.displayName,
      totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
      totalSales: sql<number>`COUNT(*)`,
    })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id));

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered
    .groupBy(
      sales.sellerId,
      sql`COALESCE(${sales.sellerName}, ${users.name})`,
      users.displayName
    )
    .orderBy(desc(sql`SUM(${sales.amount})`))
    .limit(limit);
}

export async function getTopClients(
  startDate?: Date,
  endDate?: Date,
  limit = 10
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${startDate.toISOString().split("T")[0]}`
    );
  if (endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${endDate.toISOString().split("T")[0]}`
    );

  const base = db
    .select({
      clientName: sales.clientName,
      clientPhone: sales.clientPhone,
      totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
      totalSales: sql<number>`COUNT(*)`,
    })
    .from(sales);

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered
    .groupBy(sales.clientName, sales.clientPhone)
    .orderBy(desc(sql`SUM(${sales.amount})`))
    .limit(limit);
}

export async function getTopProducts(
  startDate?: Date,
  endDate?: Date,
  limit = 10
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate)
    conditions.push(
      sql`${sales.saleDate} >= ${startDate.toISOString().split("T")[0]}`
    );
  if (endDate)
    conditions.push(
      sql`${sales.saleDate} <= ${endDate.toISOString().split("T")[0]}`
    );

  const base = db
    .select({
      productName: sales.productName,
      totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
      totalSales: sql<number>`COUNT(*)`,
    })
    .from(sales);

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered
    .groupBy(sales.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}

export async function getSalesByMonth(year: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(
    sql`SELECT EXTRACT(MONTH FROM "saleDate")::int AS month, COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE EXTRACT(YEAR FROM "saleDate") = ${year} AND "deletedAt" IS NULL GROUP BY EXTRACT(MONTH FROM "saleDate") ORDER BY EXTRACT(MONTH FROM "saleDate")`
  );
  const rows = extractRows(result);
  return rows.map(r => ({
    month: Number(r.month),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));
}

export async function getSalesByMonthByCompany(year: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(
    sql`SELECT EXTRACT(MONTH FROM "saleDate")::int AS month, COALESCE(company, 'mundo_da_magia') AS company, COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE EXTRACT(YEAR FROM "saleDate") = ${year} AND "deletedAt" IS NULL GROUP BY EXTRACT(MONTH FROM "saleDate"), company ORDER BY EXTRACT(MONTH FROM "saleDate")`
  );
  const rows = extractRows(result);
  return rows.map(r => ({
    month: Number(r.month),
    company: String(r.company),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));
}

export async function getSalesLast14Days() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(
    sql`SELECT "saleDate"::date AS day, COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE "saleDate" >= CURRENT_DATE - INTERVAL '13 days' AND "deletedAt" IS NULL GROUP BY "saleDate"::date ORDER BY "saleDate"::date`
  );
  const rows = extractRows(result);
  return rows.map(r => ({
    day: String(r.day).slice(0, 10),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));
}

// Agrega vendas por dia ou mês, em qualquer janela de datas.
// Quando startDate é omitido, usa a data da venda mais antiga (caso "Total").
// Retorna também o total da janela anterior de mesmo tamanho (para o delta);
// null quando não há janela anterior comparável (caso "Total").
export async function getSalesByPeriod(params: {
  startDate?: Date;
  endDate?: Date;
  granularity: "day" | "month";
  // Quando o período atual ainda está em andamento (ex: "Este mês" no dia 10),
  // o cliente passa compareEndDate = hoje para que `current` (e a comparação)
  // reflita só os dias já decorridos — evitando comparações injustas tipo
  // "mês passado fez R$ 80k vs este mês ainda só R$ 10k".
  compareEndDate?: Date;
  // Janela explícita do período anterior. Quando ausente, cai no comportamento
  // antigo (mesmo número de dias imediatamente antes do período atual).
  previousStartDate?: Date;
  previousEndDate?: Date;
}) {
  const db = await getDb();
  if (!db)
    return {
      buckets: [] as { key: string; totalAmount: number; totalSales: number }[],
      previousBuckets: [] as {
        key: string;
        totalAmount: number;
        totalSales: number;
      }[],
      previous: null as { totalAmount: number; totalSales: number } | null,
      current: null as { totalAmount: number; totalSales: number } | null,
    };

  let startStr = params.startDate?.toISOString().split("T")[0];
  const endStr = params.endDate?.toISOString().split("T")[0];

  if (!startStr) {
    const earliest = await db.execute(
      sql`SELECT MIN("saleDate")::date AS "minDate" FROM sales WHERE "deletedAt" IS NULL`
    );
    const earliestRows = extractRows(earliest);
    const minDate = earliestRows[0]?.minDate
      ? String(earliestRows[0].minDate).slice(0, 10)
      : null;
    if (!minDate)
      return {
        buckets: [],
        previousBuckets: [],
        previous: null,
        current: null,
      };
    startStr = minDate;
  }

  // Expressão de agrupamento: TO_CHAR é usado para gerar a chave (formato literal,
  // não parametrizado) e também como GROUP BY/ORDER BY para evitar parametrizar
  // a unidade de DATE_TRUNC (Postgres não resolve a função quando o 1º arg é $param
  // e a coluna é date).
  const keyExpr =
    params.granularity === "month"
      ? sql`TO_CHAR("saleDate", 'YYYY-MM')`
      : sql`TO_CHAR("saleDate", 'YYYY-MM-DD')`;

  let where = sql`"deletedAt" IS NULL AND "saleDate" >= ${startStr}`;
  if (endStr) where = sql`${where} AND "saleDate" <= ${endStr}`;

  const result = await db.execute(
    sql`SELECT ${keyExpr} AS "key", COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE ${where} GROUP BY ${keyExpr} ORDER BY ${keyExpr}`
  );
  const rows = extractRows(result);
  const buckets = rows.map(r => ({
    key: String(r.key),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));

  // ── Janela "atual decorrida" ───────────────────────────────────────────────
  // Se o cliente passou compareEndDate (período em andamento), some apenas até
  // essa data para a comparação justa.
  let current: { totalAmount: number; totalSales: number } | null = null;
  if (params.compareEndDate && params.startDate) {
    const compareEndStr = params.compareEndDate.toISOString().split("T")[0];
    const curResult = await db.execute(
      sql`SELECT COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE "deletedAt" IS NULL AND "saleDate" >= ${startStr} AND "saleDate" <= ${compareEndStr}`
    );
    const curRows = extractRows(curResult);
    current = {
      totalAmount: Number(curRows[0]?.totalAmount ?? 0),
      totalSales: Number(curRows[0]?.totalSales ?? 0),
    };
  }

  // ── Janela anterior ────────────────────────────────────────────────────────
  // Se o cliente passou previousStartDate/EndDate explícitos (preset
  // alinhado, ex: 1º a 10 do mês passado), usa essa janela. Senão, mantém o
  // comportamento antigo (mesmo nº de dias imediatamente antes do atual).
  let previous: { totalAmount: number; totalSales: number } | null = null;
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  if (params.previousStartDate && params.previousEndDate) {
    prevStart = new Date(params.previousStartDate);
    prevEnd = new Date(params.previousEndDate);
  } else if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (days - 1));
  }

  let previousBuckets: {
    key: string;
    totalAmount: number;
    totalSales: number;
  }[] = [];
  if (prevStart && prevEnd) {
    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevEndStr = prevEnd.toISOString().split("T")[0];
    const prevResult = await db.execute(
      sql`SELECT COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE "deletedAt" IS NULL AND "saleDate" >= ${prevStartStr} AND "saleDate" <= ${prevEndStr}`
    );
    const prevRows = extractRows(prevResult);
    previous = {
      totalAmount: Number(prevRows[0]?.totalAmount ?? 0),
      totalSales: Number(prevRows[0]?.totalSales ?? 0),
    };

    // Buckets anteriores agregados, mesma granularidade — usado para sobrepor
    // linha do "período anterior" no gráfico.
    const prevBucketResult = await db.execute(
      sql`SELECT ${keyExpr} AS "key", COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE "deletedAt" IS NULL AND "saleDate" >= ${prevStartStr} AND "saleDate" <= ${prevEndStr} GROUP BY ${keyExpr} ORDER BY ${keyExpr}`
    );
    previousBuckets = extractRows(prevBucketResult).map(r => ({
      key: String(r.key),
      totalAmount: Number(r.totalAmount),
      totalSales: Number(r.totalSales),
    }));
  }

  return { buckets, previousBuckets, previous, current };
}

// ─── Report Schedules ─────────────────────────────────────────────────────────

export async function getReportSchedules() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reportSchedules)
    .orderBy(asc(reportSchedules.frequency));
}

export async function createReportSchedule(data: InsertReportSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reportSchedules).values(data);
}

export async function updateReportSchedule(
  id: number,
  data: Partial<InsertReportSchedule>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(reportSchedules).set(data).where(eq(reportSchedules.id, id));
}

export async function deleteReportSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
}

// ─── User Sessions (Sessões Ativas) ─────────────────────────────────────────

export async function createUserSession(data: {
  userId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  const result = await db
    .insert(userSessions)
    .values({
      userId: data.userId,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      lastActive: new Date(),
      expiresAt: data.expiresAt,
    })
    .returning({ id: userSessions.id });
  return result[0]?.id;
}

export async function updateUserSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userSessions)
    .set({ lastActive: new Date() })
    .where(eq(userSessions.id, id));
}

export async function deleteUserSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userSessions).where(eq(userSessions.id, id));
}

export async function deleteUserSessionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        sql`${userSessions.expiresAt} > NOW()`
      )
    )
    .orderBy(desc(userSessions.lastActive));
}

export async function getAllUserSessions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      session: userSessions,
      userName: sql<string>`COALESCE(${users.displayName}, ${users.name}, ${users.username})`,
      userRole: users.role,
    })
    .from(userSessions)
    .leftJoin(users, eq(userSessions.userId, users.id))
    .where(sql`${userSessions.expiresAt} > NOW()`)
    .orderBy(desc(userSessions.lastActive));
}

// ─── Audit Logs (Histórico de Atividades) ────────────────────────────────────

export async function createAuditLog(data: {
  userId?: number | null;
  userName?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    userId: data.userId ?? null,
    userName: data.userName ?? null,
    action: data.action,
    details: data.details ?? null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });
}

export async function getAuditLogs(
  filters: {
    userId?: number;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters.action) {
    const escaped = filters.action.replace(/[%_\\]/g, "\\$&");
    conditions.push(
      sql`${auditLogs.action} LIKE ${"%" + escaped + "%"} ESCAPE '\\'`
    );
  }

  const base = db.select().from(auditLogs);

  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;

  return filtered
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
}

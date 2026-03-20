import { and, asc, desc, eq, isNull, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { clients, consultationSlots, InsertClient, InsertProduct, InsertReportSchedule, InsertSale, InsertUser, products, reportSchedules, sales, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

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
    ssl: connStr.includes('railway') ? { rejectUnauthorized: false } : undefined,
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
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

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
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  // Retorna apenas dados seguros, blindando o passwordHash e sessionVersion
  return db.select({
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
    lastSignedIn: users.lastSignedIn
  }).from(users).where(isNull(users.deletedAt)).orderBy(asc(users.name));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
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
  // Soft delete: salva snapshot do nome nas vendas e marca deletedAt
  // 1. Buscar dados do usuário antes de deletar
  const user = await getUserById(id);
  if (!user) return;
  const snapshotName = user.displayName || user.name || user.username || `Usuário #${id}`;
  // 2. Atualizar sellerName nas vendas que ainda não têm snapshot
  await db.update(sales).set({ sellerName: snapshotName }).where(
    and(eq(sales.sellerId, id), sql`${sales.sellerName} IS NULL`)
  );
  // 3. Marcar como deletado, inativo, invalidar sessões e liberar username/openId para reutilização
  const deletedAt = new Date();
  const suffix = `_deleted_${deletedAt.getTime()}`;
  await db.update(users).set({
    active: false,
    deletedAt,
    username: user.username ? `${user.username}${suffix}` : user.username,
    openId: `${user.openId}${suffix}`,
    sessionVersion: sql`${users.sessionVersion} + 1`
  }).where(eq(users.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  // Sempre filtra produtos com soft delete (deletedAt IS NULL)
  if (includeInactive) return db.select().from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name));
  return db.select().from(products).where(and(eq(products.active, true), isNull(products.deletedAt))).orderBy(asc(products.name));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
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
  if (product?.isSystem) throw new Error("Produto do sistema não pode ser excluído.");
  // Soft delete: marca deletedAt e desativa — productName já é snapshot nas vendas
  await db.update(products).set({ active: false, deletedAt: new Date() }).where(eq(products.id, id));
}

// ─── Garante que produtos do sistema existam no banco ─────────────────────────
export const SYSTEM_PRODUCTS = [
  {
    name: "Consulta Cartas",
    description: "Consulta espiritual com horário agendado (produto do sistema)",
    isSystem: true,
    active: true,
  },
] as const;

export async function ensureSystemProducts() {
  const db = await getDb();
  if (!db) {
    console.warn("[SystemProducts] Banco não disponível, pulando criação de produtos do sistema.");
    return;
  }
  for (const sp of SYSTEM_PRODUCTS) {
    // Verifica se já existe (incluindo soft-deleted)
    const existing = await db.select().from(products).where(eq(products.name, sp.name)).limit(1);
    if (existing.length > 0) {
      // Garante que está ativo, não deletado e marcado como sistema
      const p = existing[0];
      if (!p.isSystem || !p.active || p.deletedAt) {
        await db.update(products).set({
          isSystem: true,
          active: true,
          deletedAt: null,
        }).where(eq(products.id, p.id));
        console.log(`[SystemProducts] Produto "${sp.name}" restaurado/atualizado (id=${p.id}).`);
      } else {
        console.log(`[SystemProducts] Produto "${sp.name}" já existe (id=${p.id}). OK.`);
      }
    } else {
      // Cria o produto do sistema
      await db.insert(products).values({
        name: sp.name,
        description: sp.description,
        active: true,
        isSystem: true,
      });
      console.log(`[SystemProducts] Produto "${sp.name}" criado com sucesso.`);
    }
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function upsertClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Try to find existing client by phone
  if (data.phone) {
    const existing = await db.select().from(clients).where(eq(clients.phone, data.phone)).limit(1);
    if (existing.length > 0) {
      await db.update(clients).set({ fullName: data.fullName, birthDate: data.birthDate }).where(eq(clients.id, existing[0].id));
      return existing[0].id;
    }
  }
  // PostgreSQL: usar .returning() para obter o ID gerado
  const result = await db.insert(clients).values(data).returning({ id: clients.id });
  return result[0].id;
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

export async function createSale(data: InsertSale) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // PostgreSQL: usar .returning() para obter o ID gerado
  const result = await db.insert(sales).values(data).returning({ id: sales.id });
  return result[0].id;
}

export async function getSales(filters: SaleFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (filters.startDate) conditions.push(sql`${sales.saleDate} >= ${filters.startDate.toISOString().split('T')[0]}`);
  if (filters.endDate) conditions.push(sql`${sales.saleDate} <= ${filters.endDate.toISOString().split('T')[0]}`);
  if (filters.sellerId) conditions.push(eq(sales.sellerId, filters.sellerId));
  if (filters.productName) conditions.push(like(sales.productName, `%${filters.productName}%`));

  const query = db.select({
    sale: sales,
    // Usa snapshot sellerName se disponível (vendedor excluído), senão busca do JOIN
    seller: {
      id: users.id,
      name: sql<string>`COALESCE(${sales.sellerName}, ${users.name})`,
      displayName: users.displayName,
    },
  })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id))
    .orderBy(desc(sales.saleDate), desc(sales.createdAt));

  if (conditions.length > 0) {
    return (query as any).where(and(...conditions)).limit(filters.limit ?? 100).offset(filters.offset ?? 0);
  }
  return (query as any).limit(filters.limit ?? 100).offset(filters.offset ?? 0);
}

export async function getSaleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sales).where(and(eq(sales.id, id), isNull(sales.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSalesBySeller(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).where(and(eq(sales.sellerId, sellerId), isNull(sales.deletedAt))).orderBy(desc(sales.saleDate));
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
  await db.update(consultationSlots)
    .set({ sold: false, saleId: null, status: "pendente" })
    .where(eq(consultationSlots.saleId, id));

  // M1: soft delete — preserva o registro no banco
  await db.update(sales)
    .set({ deletedAt: new Date() })
    .where(eq(sales.id, id));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getReportSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalAmount: 0, totalSales: 0 };

  const conditions: any[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate) conditions.push(sql`${sales.saleDate} >= ${startDate.toISOString().split('T')[0]}`);
  if (endDate) conditions.push(sql`${sales.saleDate} <= ${endDate.toISOString().split('T')[0]}`);

  const query = db.select({
    totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
    totalSales: sql<number>`COUNT(*)`,
  }).from(sales);

  const result = conditions.length > 0
    ? await (query as any).where(and(...conditions))
    : await query;

  return result[0] ?? { totalAmount: 0, totalSales: 0 };
}

export async function getTopSellers(startDate?: Date, endDate?: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate) conditions.push(sql`${sales.saleDate} >= ${startDate.toISOString().split('T')[0]}`);
  if (endDate) conditions.push(sql`${sales.saleDate} <= ${endDate.toISOString().split('T')[0]}`);

  const query = db.select({
    sellerId: sales.sellerId,
    // Usa snapshot sellerName se disponível, senão faz JOIN com users
    sellerName: sql<string>`COALESCE(${sales.sellerName}, ${users.name})`,
    sellerDisplayName: users.displayName,
    totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
    totalSales: sql<number>`COUNT(*)`,
  })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id))
    .groupBy(sales.sellerId, sql`COALESCE(${sales.sellerName}, ${users.name})`, users.displayName)
    .orderBy(desc(sql`SUM(${sales.amount})`))
    .limit(limit);

  return conditions.length > 0 ? (query as any).where(and(...conditions)) : query;
}

export async function getTopClients(startDate?: Date, endDate?: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate) conditions.push(sql`${sales.saleDate} >= ${startDate.toISOString().split('T')[0]}`);
  if (endDate) conditions.push(sql`${sales.saleDate} <= ${endDate.toISOString().split('T')[0]}`);

  const query = db.select({
    clientName: sales.clientName,
    clientPhone: sales.clientPhone,
    totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
    totalSales: sql<number>`COUNT(*)`,
  })
    .from(sales)
    .groupBy(sales.clientName, sales.clientPhone)
    .orderBy(desc(sql`SUM(${sales.amount})`))
    .limit(limit);

  return conditions.length > 0 ? (query as any).where(and(...conditions)) : query;
}

export async function getTopProducts(startDate?: Date, endDate?: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [isNull(sales.deletedAt)]; // M1: filtra vendas ativas
  if (startDate) conditions.push(sql`${sales.saleDate} >= ${startDate.toISOString().split('T')[0]}`);
  if (endDate) conditions.push(sql`${sales.saleDate} <= ${endDate.toISOString().split('T')[0]}`);

  const query = db.select({
    productName: sales.productName,
    totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
    totalSales: sql<number>`COUNT(*)`,
  })
    .from(sales)
    .groupBy(sales.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  return conditions.length > 0 ? (query as any).where(and(...conditions)) : query;
}

export async function getSalesByMonth(year: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(
    sql`SELECT EXTRACT(MONTH FROM "saleDate")::int AS month, COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE EXTRACT(YEAR FROM "saleDate") = ${year} AND "deletedAt" IS NULL GROUP BY EXTRACT(MONTH FROM "saleDate") ORDER BY EXTRACT(MONTH FROM "saleDate")`
  );
  const rows = Array.isArray((result as any).rows) ? (result as any).rows : (Array.isArray((result as any)[0]) ? (result as any)[0] : result);
  return (rows as any[]).map((r: any) => ({
    month: Number(r.month),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));
}

// ─── Report Schedules ─────────────────────────────────────────────────────────

export async function getReportSchedules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportSchedules).orderBy(asc(reportSchedules.frequency));
}

export async function createReportSchedule(data: InsertReportSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reportSchedules).values(data);
}

export async function updateReportSchedule(id: number, data: Partial<InsertReportSchedule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reportSchedules).set(data).where(eq(reportSchedules.id, id));
}

export async function deleteReportSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
}

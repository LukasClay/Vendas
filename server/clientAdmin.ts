import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { auditLogs, clients, sales, users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  normalizeClientBirthDate,
  normalizeClientName,
  normalizeClientPhone,
} from "./clientIdentity";

const ADMIN_CLIENT_HISTORY_LIMIT = 100;

export type ClientAdminDatabase = NonNullable<
  Awaited<ReturnType<typeof getDb>>
>;

export interface AdminClientListInput {
  query?: string;
  page: number;
  pageSize: number;
}

export interface AdminClientUpdateInput {
  id: number;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  expectedUpdatedAt: string;
}

export interface ClientAdminAuditContext {
  userId: number;
  userName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class ClientAdminNotFoundError extends Error {
  constructor(readonly clientId: number) {
    super("Cliente n\u00e3o encontrado.");
    this.name = "ClientAdminNotFoundError";
  }
}

export class ClientAdminConflictError extends Error {
  constructor(readonly clientId: number) {
    super(
      "Este cadastro foi alterado por outra pessoa. Recarregue os dados antes de salvar novamente."
    );
    this.name = "ClientAdminConflictError";
  }
}

const adminClientProjection = {
  id: clients.id,
  fullName: clients.fullName,
  birthDate: clients.birthDate,
  phone: clients.phone,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
};

function requireDatabase(
  db: ClientAdminDatabase | null
): asserts db is ClientAdminDatabase {
  if (!db) throw new Error("Database not available");
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function buildAdminClientSearchCondition(query?: string): SQL | undefined {
  const term = query?.trim();
  if (!term) return undefined;

  const like = `%${escapeLike(term)}%`;
  const conditions: SQL[] = [
    sql`${clients.fullName} ILIKE ${like} ESCAPE '\\'`,
    sql`${clients.phone} ILIKE ${like} ESCAPE '\\'`,
  ];
  const rawDigits = term.replace(/\D/g, "");
  let normalizedPhoneDigits = rawDigits;
  try {
    const normalizedPhone = normalizeClientPhone(term);
    normalizedPhoneDigits = normalizedPhone?.replace(/\D/g, "") ?? rawDigits;
  } catch {
    // Text searches do not need to be valid phone numbers.
  }
  if (normalizedPhoneDigits.length >= 2) {
    conditions.push(
      sql`regexp_replace(coalesce(${clients.phone}, ''), '[^0-9]', '', 'g') LIKE ${`%${normalizedPhoneDigits}%`}`
    );
  }

  return or(...conditions);
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listAdminClients(input: AdminClientListInput) {
  const db = await getDb();
  requireDatabase(db);
  return listAdminClientsWithDb(db, input);
}

export async function listAdminClientsWithDb(
  db: ClientAdminDatabase,
  input: AdminClientListInput
) {
  const condition = buildAdminClientSearchCondition(input.query);
  const offset = (input.page - 1) * input.pageSize;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        ...adminClientProjection,
        salesCount: count(sales.id),
        totalSpent: sql<string>`coalesce(sum(${sales.amount}), 0)`,
        lastSaleDate: sql<string | null>`max(${sales.saleDate})`,
      })
      .from(clients)
      .leftJoin(
        sales,
        and(eq(sales.clientId, clients.id), isNull(sales.deletedAt))
      )
      .where(condition)
      .groupBy(
        clients.id,
        clients.fullName,
        clients.birthDate,
        clients.phone,
        clients.createdAt,
        clients.updatedAt
      )
      .orderBy(asc(clients.fullName), asc(clients.id))
      .limit(input.pageSize)
      .offset(offset),
    db.select({ total: count() }).from(clients).where(condition),
  ]);

  const total = totalRows[0]?.total ?? 0;
  return {
    items: rows.map(row => ({
      ...row,
      salesCount: toNumber(row.salesCount),
      totalSpent: toNumber(row.totalSpent),
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
  };
}

export function buildAdminClientHistoryQuery(
  db: ClientAdminDatabase,
  clientId: number
) {
  return db
    .select({
      id: sales.id,
      saleDate: sales.saleDate,
      productName: sales.productName,
      productCategory: sales.productCategory,
      amount: sales.amount,
      workStatus: sales.workStatus,
      sellerName: sql<string | null>`coalesce(
        ${sales.sellerName},
        ${users.displayName},
        ${users.name},
        ${users.username}
      )`,
      clientName: sales.clientName,
      clientBirthDate: sales.clientBirthDate,
      clientPhone: sales.clientPhone,
    })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id))
    .where(and(eq(sales.clientId, clientId), isNull(sales.deletedAt)))
    .orderBy(desc(sales.saleDate), desc(sales.createdAt), desc(sales.id))
    .limit(ADMIN_CLIENT_HISTORY_LIMIT);
}

export async function getAdminClientDetail(id: number) {
  const db = await getDb();
  requireDatabase(db);
  return getAdminClientDetailWithDb(db, id);
}

export async function getAdminClientDetailWithDb(
  db: ClientAdminDatabase,
  id: number
) {
  const clientRows = await db
    .select(adminClientProjection)
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  const client = clientRows[0];
  if (!client) throw new ClientAdminNotFoundError(id);

  const [summaryRows, historyRows] = await Promise.all([
    db
      .select({
        salesCount: count(sales.id),
        totalSpent: sql<string>`coalesce(sum(${sales.amount}), 0)`,
        firstSaleDate: sql<string | null>`min(${sales.saleDate})`,
        lastSaleDate: sql<string | null>`max(${sales.saleDate})`,
      })
      .from(sales)
      .where(and(eq(sales.clientId, id), isNull(sales.deletedAt))),
    buildAdminClientHistoryQuery(db, id),
  ]);
  const summary = summaryRows[0];

  return {
    client,
    summary: {
      salesCount: toNumber(summary?.salesCount),
      totalSpent: toNumber(summary?.totalSpent),
      firstSaleDate: summary?.firstSaleDate ?? null,
      lastSaleDate: summary?.lastSaleDate ?? null,
    },
    history: historyRows.map(row => ({
      ...row,
      amount: toNumber(row.amount),
    })),
  };
}

function normalizeAdminClientUpdate(input: AdminClientUpdateInput) {
  normalizeClientName(input.fullName);
  const fullName = input.fullName.normalize("NFKC").trim().replace(/\s+/g, " ");
  const birthDate = normalizeClientBirthDate(input.birthDate);
  const phone = normalizeClientPhone(input.phone);

  if (fullName.length > 256) {
    throw new TypeError(
      "Nome do cliente deve ter no m\u00e1ximo 256 caracteres."
    );
  }
  if (phone && phone.length > 32) {
    throw new TypeError("Telefone deve ter no m\u00e1ximo 32 caracteres.");
  }

  return { fullName, birthDate, phone };
}

function sameTimestamp(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

export async function updateAdminClient(
  input: AdminClientUpdateInput,
  audit: ClientAdminAuditContext
) {
  const db = await getDb();
  requireDatabase(db);
  return updateAdminClientWithDb(db, input, audit);
}

export async function updateAdminClientWithDb(
  db: ClientAdminDatabase,
  input: AdminClientUpdateInput,
  audit: ClientAdminAuditContext
) {
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    throw new TypeError("Vers\u00e3o do cadastro inv\u00e1lida.");
  }
  const nextValues = normalizeAdminClientUpdate(input);

  return db.transaction(async transaction => {
    await transaction.execute(
      sql`select ${clients.id} from ${clients} where ${clients.id} = ${input.id} for update`
    );
    const currentRows = await transaction
      .select(adminClientProjection)
      .from(clients)
      .where(eq(clients.id, input.id))
      .limit(1);
    const current = currentRows[0];
    if (!current) throw new ClientAdminNotFoundError(input.id);
    if (!sameTimestamp(current.updatedAt, expectedUpdatedAt)) {
      throw new ClientAdminConflictError(input.id);
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of ["fullName", "birthDate", "phone"] as const) {
      if (current[field] !== nextValues[field]) {
        changes[field] = {
          before: current[field],
          after: nextValues[field],
        };
      }
    }

    const nextUpdatedAt = new Date(
      Math.max(Date.now(), current.updatedAt.getTime() + 1)
    );
    const updatedRows = await transaction
      .update(clients)
      .set({ ...nextValues, updatedAt: nextUpdatedAt })
      .where(eq(clients.id, input.id))
      .returning(adminClientProjection);
    const updated = updatedRows[0];
    if (!updated) throw new ClientAdminConflictError(input.id);

    if (Object.keys(changes).length > 0) {
      await transaction.insert(auditLogs).values({
        userId: audit.userId,
        userName: audit.userName,
        action: "Editou Cliente",
        details: JSON.stringify({ clientId: input.id, changes }),
        ipAddress: audit.ipAddress ?? null,
        userAgent: audit.userAgent ?? null,
      });
    }

    return updated;
  });
}

interface DuplicateCandidateSource {
  id: number;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  updatedAt: Date;
  salesCount: number | string;
  lastSaleDate: string | null;
}

type DuplicateCriterion = "phone" | "name_birth_date";

export function buildDuplicateGroups(rows: DuplicateCandidateSource[]) {
  const phoneBuckets = new Map<string, DuplicateCandidateSource[]>();
  const identityBuckets = new Map<string, DuplicateCandidateSource[]>();
  for (const row of rows) {
    try {
      const phone = normalizeClientPhone(row.phone);
      if (phone) {
        const bucket = phoneBuckets.get(phone) ?? [];
        bucket.push(row);
        phoneBuckets.set(phone, bucket);
      }
    } catch {
      // Cadastro legado inv\u00e1lido n\u00e3o deve derrubar a revis\u00e3o inteira.
    }
    if (row.birthDate) {
      let normalizedName: string;
      try {
        normalizedName = normalizeClientName(row.fullName);
      } catch {
        continue;
      }
      const identity = `${normalizedName}|${row.birthDate}`;
      const bucket = identityBuckets.get(identity) ?? [];
      bucket.push(row);
      identityBuckets.set(identity, bucket);
    }
  }

  const groups = new Map<
    string,
    {
      candidates: DuplicateCandidateSource[];
      criteria: Set<DuplicateCriterion>;
    }
  >();
  const collectBuckets = (
    buckets: Map<string, DuplicateCandidateSource[]>,
    criterion: DuplicateCriterion
  ) => {
    for (const bucket of Array.from(buckets.values())) {
      if (bucket.length < 2) continue;
      const candidates = [...bucket].sort((left, right) => left.id - right.id);
      const key = candidates.map(candidate => candidate.id).join("-");
      const group = groups.get(key) ?? {
        candidates,
        criteria: new Set<DuplicateCriterion>(),
      };
      group.criteria.add(criterion);
      groups.set(key, group);
    }
  };
  collectBuckets(phoneBuckets, "phone");
  collectBuckets(identityBuckets, "name_birth_date");

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const { criteria } = group;
      const hasPhone = criteria.has("phone");
      const hasIdentity = criteria.has("name_birth_date");
      const criterion =
        hasPhone && hasIdentity
          ? ("phone_and_name_birth_date" as const)
          : hasPhone
            ? ("phone" as const)
            : ("name_birth_date" as const);
      const candidates = group.candidates
        .map(member => ({
          id: member.id,
          fullName: member.fullName,
          birthDate: member.birthDate,
          phone: member.phone,
          updatedAt: member.updatedAt,
          salesCount: toNumber(member.salesCount),
          lastSaleDate: member.lastSaleDate,
        }))
        .sort((left, right) => left.id - right.id);

      return {
        id: `${criterion}:${key}`,
        criterion,
        score: hasPhone && hasIdentity ? 100 : hasPhone ? 90 : 80,
        candidates,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidates[0].id - right.candidates[0].id
    );
}

export async function getDuplicateGroups() {
  const db = await getDb();
  requireDatabase(db);
  const rows = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      birthDate: clients.birthDate,
      phone: clients.phone,
      updatedAt: clients.updatedAt,
      salesCount: count(sales.id),
      lastSaleDate: sql<string | null>`max(${sales.saleDate})`,
    })
    .from(clients)
    .leftJoin(
      sales,
      and(eq(sales.clientId, clients.id), isNull(sales.deletedAt))
    )
    .groupBy(
      clients.id,
      clients.fullName,
      clients.birthDate,
      clients.phone,
      clients.updatedAt
    )
    .orderBy(asc(clients.id));

  return buildDuplicateGroups(rows);
}

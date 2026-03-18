import { and, asc, desc, eq, like, lte, gte, ne, or, sql } from "drizzle-orm";
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

// Mantido para compatibilidade com chamadas existentes — Postgres é estável, sem retry necessário
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
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
  // Filtra usuários excluídos (soft delete) — deletedAt IS NULL
  return db.select().from(users).where(sql`${users.deletedAt} IS NULL`).orderBy(asc(users.name));
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
  // 3. Marcar como deletado e inativo
  await db.update(users).set({ active: false, deletedAt: new Date() }).where(eq(users.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  // Sempre filtra produtos com soft delete (deletedAt IS NULL)
  if (includeInactive) return db.select().from(products).where(sql`${products.deletedAt} IS NULL`).orderBy(asc(products.name));
  return db.select().from(products).where(and(eq(products.active, true), sql`${products.deletedAt} IS NULL`)).orderBy(asc(products.name));
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
  // Soft delete: marca deletedAt e desativa — productName já é snapshot nas vendas
  await db.update(products).set({ active: false, deletedAt: new Date() }).where(eq(products.id, id));
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function searchClients(query: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients)
    .where(or(like(clients.fullName, `%${query}%`), like(clients.phone, `%${query}%`)))
    .limit(10);
}

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
  const result = await db.insert(clients).values(data);
  const rawC = (result as any);
  const rawCId = Array.isArray(rawC) ? rawC[0]?.insertId : rawC.insertId;
  return parseInt(String(rawCId), 10);
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
  const result = await db.insert(sales).values(data);
  // O drizzle com mysql2 retorna [ResultSetHeader, fields] — insertId está em result[0].insertId
  // Pode ser bigint, number ou string dependendo da versão do driver
  const raw = (result as any);
  const rawId = Array.isArray(raw) ? raw[0]?.insertId : raw.insertId;
  return parseInt(String(rawId), 10);
}

export async function getSales(filters: SaleFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
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
  const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSalesBySeller(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).where(eq(sales.sellerId, sellerId)).orderBy(desc(sales.saleDate));
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

  // Remove a venda
  await db.delete(sales).where(eq(sales.id, id));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getReportSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalAmount: 0, totalSales: 0 };

  const conditions = [];
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

  const conditions = [];
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

  const conditions = [];
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

  const conditions = [];
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
    sql`SELECT EXTRACT(MONTH FROM "saleDate")::int AS month, COALESCE(SUM(amount), 0) AS "totalAmount", COUNT(*)::int AS "totalSales" FROM sales WHERE EXTRACT(YEAR FROM "saleDate") = ${year} GROUP BY EXTRACT(MONTH FROM "saleDate") ORDER BY EXTRACT(MONTH FROM "saleDate")`
  );
  const rows = Array.isArray((result as any).rows) ? (result as any).rows : (Array.isArray((result as any)[0]) ? (result as any)[0] : result);
  return (rows as any[]).map((r: any) => ({
    month: Number(r.month),
    totalAmount: Number(r.totalAmount),
    totalSales: Number(r.totalSales),
  }));
}

// ─── Consultora ─────────────────────────────────────────────────────────────────

/**
 * Retorna vendas pendentes (sem completedAt) ordenadas por prioridade:
 * prazo de 7 dias úteis a partir da data de venda.
 * Mais urgentes (mais próximos do vencimento) primeiro.
 */
export async function getPendingSales(productNameFilter?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [sql`${sales.completedAt} IS NULL`];
  if (productNameFilter) conditions.push(like(sales.productName, `%${productNameFilter}%`));

  const result = await (db.select({
    id: sales.id,
    clientName: sales.clientName,
    clientBirthDate: sales.clientBirthDate,
    clientPhone: sales.clientPhone,
    productName: sales.productName,
    saleDate: sales.saleDate,
    notes: sales.notes,
    createdAt: sales.createdAt,
  }).from(sales) as any)
    .where(and(...conditions))
    .orderBy(asc(sales.saleDate), asc(sales.createdAt))
    .limit(200);

  return result as Array<{
    id: number;
    clientName: string;
    clientBirthDate: Date | null;
    clientPhone: string | null;
    productName: string;
    saleDate: Date;
    notes: string | null;
    createdAt: Date;
  }>;
}

/**
 * Marca uma venda como concluída.
 */
export async function completeSale(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(sales).set({ completedAt: new Date() }).where(eq(sales.id, id));
}

/**
 * Retorna quantas vezes um cliente (por nome) já comprou, sem expor valores.
 */
export async function getClientPurchaseHistory(clientName: string) {
  const db = await getDb();
  if (!db) return { totalPurchases: 0, purchases: [] };

  const rows = await db.select({
    id: sales.id,
    productName: sales.productName,
    saleDate: sales.saleDate,
    completedAt: sales.completedAt,
  }).from(sales)
    .where(like(sales.clientName, `%${clientName}%`))
    .orderBy(desc(sales.saleDate))
    .limit(50);

  return {
    totalPurchases: rows.length,
    purchases: rows,
  };
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

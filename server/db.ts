import { and, asc, desc, eq, like, lte, gte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clients, InsertClient, InsertProduct, InsertReportSchedule, InsertSale, InsertUser, products, reportSchedules, sales, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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
  return db.select().from(users).orderBy(asc(users.name));
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
  await db.update(users).set({ active: false }).where(eq(users.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  if (includeInactive) return db.select().from(products).orderBy(asc(products.name));
  return db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name));
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
  await db.update(products).set({ active: false }).where(eq(products.id, id));
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
  return (result as any).insertId as number;
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
  return (result as any).insertId as number;
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
    seller: { id: users.id, name: users.name, displayName: users.displayName },
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
    sellerName: users.name,
    sellerDisplayName: users.displayName,
    totalAmount: sql<number>`COALESCE(SUM(${sales.amount}), 0)`,
    totalSales: sql<number>`COUNT(*)`,
  })
    .from(sales)
    .leftJoin(users, eq(sales.sellerId, users.id))
    .groupBy(sales.sellerId, users.name, users.displayName)
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
    sql`SELECT MONTH(saleDate) as month, COALESCE(SUM(amount), 0) as totalAmount, COUNT(*) as totalSales FROM sales WHERE YEAR(saleDate) = ${year} GROUP BY MONTH(saleDate) ORDER BY MONTH(saleDate)`
  );
  // mysql2 returns [rows, fields]; drizzle execute returns rows directly
  const rows = Array.isArray((result as any)[0]) ? (result as any)[0] : result;
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

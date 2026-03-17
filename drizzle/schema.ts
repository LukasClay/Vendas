import {
  bigint,
  decimal,
  date,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "consultora"]).default("user").notNull(),
  // Extra fields for seller profile
  displayName: varchar("displayName", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  // Own auth (username/password login)
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Products (Trabalhos Espirituais) ─────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 256 }).notNull(),
  birthDate: date("birthDate"),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Sales ────────────────────────────────────────────────────────────────────
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),        // FK → users.id
  clientId: int("clientId"),                  // FK → clients.id (nullable for flexibility)
  productId: int("productId"),                // FK → products.id (nullable for flexibility)
  // Denormalized snapshot fields (in case product/client is deleted later)
  clientName: varchar("clientName", { length: 256 }).notNull(),
  clientBirthDate: date("clientBirthDate"),
  clientPhone: varchar("clientPhone", { length: 32 }),
  productName: varchar("productName", { length: 256 }).notNull(),
  saleDate: date("saleDate").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  // Attachment
  attachmentUrl: text("attachmentUrl"),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentMime: varchar("attachmentMime", { length: 64 }),
  // Workflow de 3 etapas da consultora
  workStatus: mysqlEnum("workStatus", ["para_escrever", "pendente", "feito"]).default("para_escrever").notNull(),
  writtenAt: timestamp("writtenAt"),    // quando passou de para_escrever → pendente
  completedAt: timestamp("completedAt"), // quando passou de pendente → feito
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// ─── Email Report Schedule ────────────────────────────────────────────────────
export const reportSchedules = mysqlTable("report_schedules", {
  id: int("id").autoincrement().primaryKey(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"]).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  active: boolean("active").default(true).notNull(),
  lastSentAt: timestamp("lastSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;

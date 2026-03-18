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
  deletedAt: timestamp("deletedAt"),  // soft delete: preenchido quando excluído
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
  deletedAt: timestamp("deletedAt"),  // soft delete: preenchido quando excluído
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
  // Denormalized snapshot fields (in case product/client/seller is deleted later)
  sellerName: varchar("sellerName", { length: 256 }),  // snapshot do nome do vendedor
  clientName: varchar("clientName", { length: 256 }).notNull(),
  clientBirthDate: date("clientBirthDate"),
  clientPhone: varchar("clientPhone", { length: 32 }),
  productName: varchar("productName", { length: 256 }).notNull(),
  productCategory: mysqlEnum("productCategory", ["individual", "promocao", "coletivo"]).default("individual"),
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

// ─── Consultation Slots (Consulta Cartas) ───────────────────────────────────
export const consultationSlots = mysqlTable("consultation_slots", {
  id: int("id").autoincrement().primaryKey(),
  // varchar em vez de date para evitar conversão de fuso horário pelo MySQL/Drizzle
  consultationDate: varchar("consultationDate", { length: 10 }).notNull(), // ex: "2026-03-24"
  consultationTime: varchar("consultationTime", { length: 5 }).notNull(),  // ex: "09:00"
  sold: boolean("sold").default(false).notNull(),        // true quando vendido
  saleId: int("saleId"),                                 // FK → sales.id (null = disponível)
  // Status: pendente (agendado), realizada (automático +50min), cancelada (manual)
  status: mysqlEnum("status", ["pendente", "realizada", "cancelada"]).default("pendente").notNull(),
  cancelledBy: int("cancelledBy"),                       // FK → users.id (quem cancelou)
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),                    // Motivo opcional do cancelamento
  createdBy: int("createdBy").notNull(),                 // FK → users.id (quem criou)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConsultationSlot = typeof consultationSlots.$inferSelect;
export type InsertConsultationSlot = typeof consultationSlots.$inferInsert;

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

import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  date,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin", "consultora"]);
export const productCategoryEnum = pgEnum("productCategory", ["individual", "promocao", "coletivo"]);
export const workStatusEnum = pgEnum("workStatus", ["para_escrever", "pendente", "feito"]);
export const consultationStatusEnum = pgEnum("consultationStatus", ["pendente", "realizada", "cancelada"]);
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly"]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  // Extra fields for seller profile
  displayName: varchar("displayName", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),  // soft delete: preenchido quando excluído
  // Own auth (username/password login)
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // A2: versão de sessão — incrementada no logout para invalidar todos os JWTs anteriores
  sessionVersion: integer("sessionVersion").default(1).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Products (Trabalhos Espirituais) ─────────────────────────────────────────
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),  // true = produto do sistema, não pode ser excluído/editado
  deletedAt: timestamp("deletedAt"),  // soft delete: preenchido quando excluído
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  fullName: varchar("fullName", { length: 256 }).notNull(),
  birthDate: date("birthDate"),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Sales ────────────────────────────────────────────────────────────────────
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  sellerId: integer("sellerId").notNull(),        // FK → users.id
  clientId: integer("clientId"),                  // FK → clients.id (nullable for flexibility)
  productId: integer("productId"),                // FK → products.id (nullable for flexibility)
  // Denormalized snapshot fields (in case product/client/seller is deleted later)
  sellerName: varchar("sellerName", { length: 256 }),  // snapshot do nome do vendedor
  clientName: varchar("clientName", { length: 256 }).notNull(),
  clientBirthDate: date("clientBirthDate"),
  clientPhone: varchar("clientPhone", { length: 32 }),
  productName: varchar("productName", { length: 256 }).notNull(),
  productCategory: productCategoryEnum("productCategory").default("individual"),
  saleDate: date("saleDate").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  // Attachment
  attachmentUrl: text("attachmentUrl"),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentMime: varchar("attachmentMime", { length: 64 }),
  // Workflow de 3 etapas da consultora
  workStatus: workStatusEnum("workStatus").default("para_escrever").notNull(),
  writtenAt: timestamp("writtenAt"),    // quando passou de para_escrever → pendente
  completedAt: timestamp("completedAt"), // quando passou de pendente → feito
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  // M1: soft delete — null = ativa, preenchido = deletada
  deletedAt: timestamp("deletedAt"),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// ─── Consultation Slots (Consulta Cartas) ───────────────────────────────────
export const consultationSlots = pgTable("consultation_slots", {
  id: serial("id").primaryKey(),
  // varchar em vez de date para evitar conversão de fuso horário
  consultationDate: varchar("consultationDate", { length: 10 }).notNull(), // ex: "2026-03-24"
  consultationTime: varchar("consultationTime", { length: 5 }).notNull(),  // ex: "09:00"
  sold: boolean("sold").default(false).notNull(),        // true quando vendido
  saleId: integer("saleId"),                             // FK → sales.id (null = disponível)
  // Status: pendente (agendado), realizada (automático +50min), cancelada (manual)
  status: consultationStatusEnum("status").default("pendente").notNull(),
  cancelledBy: integer("cancelledBy"),                   // FK → users.id (quem cancelou)
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),                    // Motivo opcional do cancelamento
  createdBy: integer("createdBy").notNull(),             // FK → users.id (quem criou)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ConsultationSlot = typeof consultationSlots.$inferSelect;
export type InsertConsultationSlot = typeof consultationSlots.$inferInsert;

// ─── Email Report Schedule ────────────────────────────────────────────────────
export const reportSchedules = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  frequency: frequencyEnum("frequency").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  active: boolean("active").default(true).notNull(),
  lastSentAt: timestamp("lastSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;

// ─── Push Subscriptions (Web Push / PWA) ─────────────────────────────────────
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),                   // FK → users.id
  endpoint: text("endpoint").notNull(),                  // URL do push service
  p256dh: text("p256dh").notNull(),                      // chave pública do cliente
  auth: text("auth").notNull(),                          // segredo de autenticação
  userAgent: text("userAgent"),                          // browser/device info
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

CREATE TYPE "public"."consultationStatus" AS ENUM('pendente', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."productCategory" AS ENUM('individual', 'promocao', 'coletivo');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'consultora');--> statement-breakpoint
CREATE TYPE "public"."workStatus" AS ENUM('para_escrever', 'pendente', 'feito');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"fullName" varchar(256) NOT NULL,
	"birthDate" date,
	"phone" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultationDate" varchar(10) NOT NULL,
	"consultationTime" varchar(5) NOT NULL,
	"sold" boolean DEFAULT false NOT NULL,
	"saleId" integer,
	"status" "consultationStatus" DEFAULT 'pendente' NOT NULL,
	"cancelledBy" integer,
	"cancelledAt" timestamp,
	"cancelReason" text,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"frequency" "frequency" NOT NULL,
	"recipientEmail" varchar(320) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lastSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"sellerId" integer NOT NULL,
	"clientId" integer,
	"productId" integer,
	"sellerName" varchar(256),
	"clientName" varchar(256) NOT NULL,
	"clientBirthDate" date,
	"clientPhone" varchar(32),
	"productName" varchar(256) NOT NULL,
	"productCategory" "productCategory" DEFAULT 'individual',
	"saleDate" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"attachmentUrl" text,
	"attachmentKey" varchar(512),
	"attachmentMime" varchar(64),
	"workStatus" "workStatus" DEFAULT 'para_escrever' NOT NULL,
	"writtenAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"displayName" varchar(128),
	"phone" varchar(32),
	"active" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp,
	"username" varchar(64),
	"passwordHash" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false;

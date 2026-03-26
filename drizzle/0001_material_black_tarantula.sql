CREATE TYPE "public"."company" AS ENUM('mundo_da_magia', 'mundo_cigano');--> statement-breakpoint
CREATE TYPE "public"."refundStatus" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "consultation_slots" ADD COLUMN "refundStatus" "refundStatus" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "consultation_slots" ADD COLUMN "refundRequestedAt" timestamp;--> statement-breakpoint
ALTER TABLE "consultation_slots" ADD COLUMN "refundRequestedBy" integer;--> statement-breakpoint
ALTER TABLE "consultation_slots" ADD COLUMN "refundResolvedAt" timestamp;--> statement-breakpoint
ALTER TABLE "consultation_slots" ADD COLUMN "refundResolvedBy" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "isSystem" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "company" "company" DEFAULT 'mundo_da_magia';--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessionVersion" integer DEFAULT 1 NOT NULL;
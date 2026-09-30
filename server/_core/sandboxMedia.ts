import type { Express } from "express";
import { and, eq, or, sql } from "drizzle-orm";
import { sales, type Sale, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { getStoredAttachmentExtras, getStoredPhotoExtras } from "../saleMedia";
import { StorageObjectNotFoundError, storageDownload } from "../storage";
import { createContext } from "./context";
import { isSandboxMode } from "./sandbox";

type MediaSale = Pick<
  Sale,
  | "sellerId"
  | "deletedAt"
  | "attachmentKey"
  | "attachmentExtras"
  | "photo1Key"
  | "photo2Key"
  | "photoExtras"
>;

export function canReadSandboxSaleMedia(
  user: Pick<User, "id" | "role">,
  sale: MediaSale,
  key: string
): boolean {
  const isPhoto =
    sale.photo1Key === key ||
    sale.photo2Key === key ||
    getStoredPhotoExtras(sale).some(file => file.key === key);
  const isAttachment =
    sale.attachmentKey === key ||
    getStoredAttachmentExtras(sale).some(file => file.key === key);
  if (!isPhoto && !isAttachment) return false;
  if (user.role === "admin") return true;
  if (sale.deletedAt) return false;
  if (user.role === "consultora") return isPhoto;
  return user.role === "user" && sale.sellerId === user.id;
}

/** Private media delivery exists only on the explicitly configured test service. */
export function registerSandboxMediaRoute(app: Express): void {
  if (!isSandboxMode()) return;

  app.get<{ 0: string }>("/api/sandbox/media/*", async (req, res, next) => {
    try {
      if (!isSandboxMode()) {
        res.sendStatus(404);
        return;
      }
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user) {
        res.sendStatus(401);
        return;
      }
      const key = req.params[0];
      if (
        !key ||
        key.length > 512 ||
        !/^(fotos|comprovantes)\//.test(key) ||
        /[\\\u0000-\u001f]/.test(key) ||
        key.split("/").some(part => !part || part === "." || part === "..")
      ) {
        res.sendStatus(400);
        return;
      }

      const db = await getDb();
      if (!db) {
        res.sendStatus(503);
        return;
      }
      const matchingKey = or(
        eq(sales.attachmentKey, key),
        eq(sales.photo1Key, key),
        eq(sales.photo2Key, key),
        sql`${sales.attachmentExtras} @> ${JSON.stringify([{ key }])}::jsonb`,
        sql`${sales.photoExtras} @> ${JSON.stringify([{ key }])}::jsonb`
      );
      const [sale] = await db
        .select({
          sellerId: sales.sellerId,
          deletedAt: sales.deletedAt,
          attachmentKey: sales.attachmentKey,
          attachmentExtras: sales.attachmentExtras,
          photo1Key: sales.photo1Key,
          photo2Key: sales.photo2Key,
          photoExtras: sales.photoExtras,
        })
        .from(sales)
        .where(
          ctx.user.role === "user"
            ? and(matchingKey, eq(sales.sellerId, ctx.user.id))
            : matchingKey
        )
        .limit(1);

      if (!sale || !canReadSandboxSaleMedia(ctx.user, sale, key)) {
        res.sendStatus(404);
        return;
      }

      const file = await storageDownload(key);
      const safeTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
      ]);
      const contentType = file.contentType?.split(";")[0].trim().toLowerCase();
      const inline = contentType && safeTypes.has(contentType);
      res.setHeader(
        "Content-Type",
        inline ? contentType : "application/octet-stream"
      );
      res.setHeader("Content-Disposition", inline ? "inline" : "attachment");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Vary", "Cookie");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.status(200).send(file.body);
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        res.sendStatus(404);
        return;
      }
      next(error);
    }
  });
}

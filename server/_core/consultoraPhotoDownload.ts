import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Express } from "express";
import { z } from "zod";
import { createContext } from "./context";
import {
  resolveConsultoraPhotoDownload,
} from "../routers/consultora";
import { StorageObjectNotFoundError, storageDownload } from "../storage";

const paramsSchema = z.object({
  saleId: z.coerce.number().int().positive(),
  photoId: z.string().min(1).max(128),
});

function buildAttachmentDisposition(filename: string): string {
  const safeFilename = filename.replace(/[^\w.-]/g, "-");
  return `attachment; filename="${safeFilename}"`;
}

export function registerConsultoraPhotoDownloadRoute(app: Express) {
  app.get(
    "/api/consultora/photos/:saleId/:photoId/download",
    async (req, res, next) => {
      try {
        const params = paramsSchema.parse(req.params);
        const ctx = await createContext({ req, res } as any);
        const photo = await resolveConsultoraPhotoDownload(ctx.user, params);
        const file = await storageDownload(photo.key);

        res.setHeader(
          "Content-Type",
          file.contentType ?? "application/octet-stream"
        );
        if (file.contentLength !== null) {
          res.setHeader("Content-Length", String(file.contentLength));
        }
        res.setHeader(
          "Content-Disposition",
          buildAttachmentDisposition(photo.filename)
        );
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");

        res.status(200).send(file.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Parâmetros inválidos para download." });
          return;
        }
        if (error instanceof StorageObjectNotFoundError) {
          res.status(404).json({ message: "Arquivo não encontrado." });
          return;
        }
        if (error instanceof TRPCError) {
          res
            .status(getHTTPStatusCodeFromError(error))
            .json({ message: error.message });
          return;
        }
        next(error);
      }
    }
  );
}

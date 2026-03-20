/**
 * Storage helpers — compatível com Manus proxy e S3/R2 direto.
 *
 * Modo 1 (Manus): usa BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY
 * Modo 2 (Railway/S3): usa S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL
 *
 * Se nenhum estiver configurado, o upload falha com mensagem clara.
 */

import { ENV } from './_core/env';

// ─── Manus Proxy ─────────────────────────────────────────────────────────────

function getManusConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

async function manusPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const config = getManusConfig()!;
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", config.baseUrl + "/");
  uploadUrl.searchParams.set("path", key);

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status}): ${message}`);
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function manusGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getManusConfig()!;
  const key = normalizeKey(relKey);
  const downloadUrl = new URL("v1/storage/downloadUrl", config.baseUrl + "/");
  downloadUrl.searchParams.set("path", key);
  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  return { key, url: (await response.json()).url };
}

// ─── S3/R2 Direto ────────────────────────────────────────────────────────────

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const publicUrl = process.env.S3_PUBLIC_URL; // URL pública do bucket (ex: https://bucket.r2.dev)
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint, bucket, accessKey, secretKey, publicUrl };
}

/**
 * Upload S3-compatível usando fetch + assinatura simples.
 * Para produção real, recomenda-se usar @aws-sdk/client-s3.
 * Esta implementação usa presigned URLs ou PUT direto dependendo do provider.
 */
async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  // Importação dinâmica do SDK S3 — só carrega se necessário
  let S3Client: any, PutObjectCommand: any;
  try {
    const s3module = await import("@aws-sdk/client-s3");
    S3Client = s3module.S3Client;
    PutObjectCommand = s3module.PutObjectCommand;
  } catch {
    throw new Error(
      "Para usar S3 no Railway, instale o SDK: npm install @aws-sdk/client-s3"
    );
  }

  const config = getS3Config()!;
  const key = normalizeKey(relKey);

  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  const body = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // URL pública do arquivo
  const publicBase = config.publicUrl || `${config.endpoint}/${config.bucket}`;
  const url = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return { key, url };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const config = getS3Config()!;
  const key = normalizeKey(relKey);
  const publicBase = config.publicUrl || `${config.endpoint}/${config.bucket}`;
  return { key, url: `${publicBase.replace(/\/+$/, "")}/${key}` };
}

// ─── API Pública ─────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (getManusConfig()) return manusPut(relKey, data, contentType);
  if (getS3Config()) return s3Put(relKey, data, contentType);
  throw new Error(
    "Nenhum serviço de storage configurado. " +
    "Configure BUILT_IN_FORGE_API_URL (Manus) ou S3_ENDPOINT + S3_BUCKET + S3_ACCESS_KEY + S3_SECRET_KEY (Railway)."
  );
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  if (getManusConfig()) return manusGet(relKey);
  if (getS3Config()) return s3Get(relKey);
  throw new Error("Nenhum serviço de storage configurado.");
}

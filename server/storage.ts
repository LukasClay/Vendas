/**
 * Storage helpers — compatível com Manus proxy e S3/R2 direto.
 *
 * Modo 1 (Manus): usa BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY
 * Modo 2 (Railway/S3): usa S3_ENDPOINT, S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL
 *
 * Se nenhum estiver configurado, o upload falha com mensagem clara.
 */

import { ENV } from "./_core/env";

export class StorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = "StorageObjectNotFoundError";
  }
}

export type StorageDownloadResult = {
  key: string;
  body: Buffer;
  contentType: string | null;
  contentLength: number | null;
};

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
  if (response.status === 404) {
    throw new StorageObjectNotFoundError(key);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage download URL failed (${response.status}): ${message}`
    );
  }
  return { key, url: (await response.json()).url };
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  if (typeof (body as any).transformToByteArray === "function") {
    const bytes = await (body as any).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (typeof (body as any).arrayBuffer === "function") {
    const arrayBuffer = await (body as any).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (typeof (body as any)?.[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<
      Uint8Array | Buffer | string
    >) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk)
      );
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported storage body format.");
}

async function manusDownload(relKey: string): Promise<StorageDownloadResult> {
  const { key, url } = await manusGet(relKey);
  const response = await fetch(url);
  if (response.status === 404) {
    throw new StorageObjectNotFoundError(key);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage download failed (${response.status}): ${message}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    key,
    body: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type"),
    contentLength: parseContentLength(response.headers.get("content-length")),
  };
}

// ─── S3/R2 Direto ────────────────────────────────────────────────────────────

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
  const secretKey =
    process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
  const publicUrl = process.env.S3_PUBLIC_URL; // URL pública do bucket (ex: https://bucket.r2.dev)
  const region = process.env.S3_REGION || "auto";
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint, bucket, accessKey, secretKey, publicUrl, region };
}

// Singleton do S3Client para reutilizar conexões TCP
let _s3Client: any = null;
let _PutObjectCommand: any = null;
let _DeleteObjectCommand: any = null;
let _GetObjectCommand: any = null;

async function getS3Client() {
  if (_s3Client) {
    return {
      client: _s3Client,
      PutObjectCommand: _PutObjectCommand,
      DeleteObjectCommand: _DeleteObjectCommand,
      GetObjectCommand: _GetObjectCommand,
    };
  }
  try {
    const s3module = await import("@aws-sdk/client-s3");
    const config = getS3Config()!;
    _s3Client = new s3module.S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
    _PutObjectCommand = s3module.PutObjectCommand;
    _DeleteObjectCommand = s3module.DeleteObjectCommand;
    _GetObjectCommand = s3module.GetObjectCommand;
    return {
      client: _s3Client,
      PutObjectCommand: _PutObjectCommand,
      DeleteObjectCommand: _DeleteObjectCommand,
      GetObjectCommand: _GetObjectCommand,
    };
  } catch {
    throw new Error(
      "Para usar S3 no Railway, instale o SDK: npm install @aws-sdk/client-s3"
    );
  }
}

/**
 * Upload S3-compatível usando @aws-sdk/client-s3 com singleton.
 */
async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { client, PutObjectCommand } = await getS3Client();
  const config = getS3Config()!;
  const key = normalizeKey(relKey);

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

async function s3Download(relKey: string): Promise<StorageDownloadResult> {
  const { client, GetObjectCommand } = await getS3Client();
  const config = getS3Config()!;
  const key = normalizeKey(relKey);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );

    return {
      key,
      body: await bodyToBuffer(response.Body),
      contentType: response.ContentType ?? null,
      contentLength:
        typeof response.ContentLength === "number"
          ? response.ContentLength
          : null,
    };
  } catch (error: any) {
    if (
      error?.name === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      throw new StorageObjectNotFoundError(key);
    }
    throw error;
  }
}

async function s3Delete(relKey: string): Promise<void> {
  const { client, DeleteObjectCommand } = await getS3Client();
  const config = getS3Config()!;
  const key = normalizeKey(relKey);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
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
      "Configure BUILT_IN_FORGE_API_URL (Manus) ou S3_ENDPOINT + S3_BUCKET_NAME + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY (Railway)."
  );
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  if (getManusConfig()) return manusGet(relKey);
  if (getS3Config()) return s3Get(relKey);
  throw new Error("Nenhum serviço de storage configurado.");
}

export async function storageDelete(relKey: string): Promise<void> {
  if (getManusConfig()) return;
  if (getS3Config()) return s3Delete(relKey);
}

export async function storageDownload(
  relKey: string
): Promise<StorageDownloadResult> {
  if (getManusConfig()) return manusDownload(relKey);
  if (getS3Config()) return s3Download(relKey);
  throw new Error("Nenhum serviço de storage configurado.");
}

import type { Request } from "express";

type KnownHttpErrorKind =
  | "request_aborted"
  | "entity_too_large"
  | "body_parse_failed";

type KnownHttpError = {
  kind: KnownHttpErrorKind;
  status: number;
  message: string;
};

type ErrorWithMeta = {
  type?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  expose?: unknown;
};

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function readHeader(headers: Request["headers"], name: string): string | null {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export function classifyKnownHttpError(error: unknown): KnownHttpError | null {
  if (!error || typeof error !== "object") return null;

  const meta = error as ErrorWithMeta;
  const type = typeof meta.type === "string" ? meta.type : null;
  const message = typeof meta.message === "string" ? meta.message : "";

  if (type === "request.aborted" || message === "request aborted") {
    return {
      kind: "request_aborted",
      status: 400,
      message: "Request aborted by client",
    };
  }

  if (type === "entity.too.large") {
    return {
      kind: "entity_too_large",
      status: 413,
      message: "Request body too large",
    };
  }

  if (type === "entity.parse.failed") {
    return {
      kind: "body_parse_failed",
      status: 400,
      message: "Invalid request body",
    };
  }

  return null;
}

export function formatHttpRequestContext(req: Request): string {
  const method = req.method;
  const path = req.originalUrl || req.url || "/";
  const ip =
    req.ip ||
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null) ||
    req.socket?.remoteAddress ||
    "-";
  const contentType = readHeader(req.headers, "content-type") ?? "-";
  const userAgent = truncate(readHeader(req.headers, "user-agent") ?? "-", 120);
  const uptimeSeconds = Math.round(process.uptime());

  return `method=${method} path=${path} ip=${ip} contentType="${contentType}" userAgent="${userAgent}" uptime=${uptimeSeconds}s`;
}

export function logKnownHttpError(
  req: Request,
  error: unknown
): KnownHttpError | null {
  const knownError = classifyKnownHttpError(error);
  if (!knownError) return null;

  const label =
    knownError.kind === "request_aborted"
      ? "Request aborted"
      : knownError.kind === "entity_too_large"
        ? "Request body too large"
        : "Invalid request body";

  console.warn(`[HTTP] ${label} ${formatHttpRequestContext(req)}`);
  return knownError;
}

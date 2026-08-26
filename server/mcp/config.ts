import { SALES_INSIGHTS_SELF_SCOPE } from "./scopes";

type Environment = Record<string, string | undefined>;

export interface McpDisabledConfig {
  enabled: false;
}

export interface McpEnabledConfig {
  enabled: true;
  resourceUrl: string;
  resourceMetadataUrl: string;
  issuer: string;
  jwksUrl: string;
  userIdClaim: string;
  requiredScopes: readonly [typeof SALES_INSIGHTS_SELF_SCOPE];
  rateLimitPerMinute: number;
}

export type McpConfig = McpDisabledConfig | McpEnabledConfig;

function readEnabled(value: string | undefined): boolean {
  if (value === undefined || value.trim() === "") return false;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error("MCP_ENABLED must be either true or false");
}

function requireValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required when MCP_ENABLED=true`);
  return value;
}

function requireUrl(
  environment: Environment,
  name: string,
  requireHttps: boolean
): URL {
  const rawValue = requireValue(environment, name);
  let value: URL;

  try {
    value = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }

  if (requireHttps && value.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS outside local tests`);
  }

  if (value.username || value.password || value.search || value.hash) {
    throw new Error(`${name} must not contain credentials, query, or fragment`);
  }

  return value;
}

function readRateLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 60;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error("MCP_RATE_LIMIT_PER_MINUTE must be a positive integer");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 600) {
    throw new Error("MCP_RATE_LIMIT_PER_MINUTE must be between 1 and 600");
  }

  return parsed;
}

export function readMcpConfig(
  environment: Environment = process.env
): McpConfig {
  if (!readEnabled(environment.MCP_ENABLED)) return { enabled: false };

  const requireHttps = environment.NODE_ENV !== "test";
  const resourceUrl = requireUrl(environment, "MCP_RESOURCE_URL", requireHttps);
  const issuerUrl = requireUrl(environment, "MCP_AUTH_ISSUER", requireHttps);
  const jwksUrl = requireUrl(environment, "MCP_AUTH_JWKS_URL", requireHttps);
  const userIdClaim = requireValue(environment, "MCP_AUTH_USER_ID_CLAIM");

  if (resourceUrl.pathname !== "/mcp") {
    throw new Error("MCP_RESOURCE_URL must point to the /mcp endpoint");
  }

  if (/\s/.test(userIdClaim)) {
    throw new Error("MCP_AUTH_USER_ID_CLAIM must not contain whitespace");
  }

  const resourceMetadataUrl = new URL(
    "/.well-known/oauth-protected-resource",
    resourceUrl
  ).href;

  return {
    enabled: true,
    resourceUrl: resourceUrl.href,
    resourceMetadataUrl,
    issuer: issuerUrl.href,
    jwksUrl: jwksUrl.href,
    userIdClaim,
    requiredScopes: [SALES_INSIGHTS_SELF_SCOPE],
    rateLimitPerMinute: readRateLimit(environment.MCP_RATE_LIMIT_PER_MINUTE),
  };
}

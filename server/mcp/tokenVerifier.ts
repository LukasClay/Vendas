import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
} from "jose";
import type { McpEnabledConfig } from "./config";
import {
  databaseMcpIdentityRepository,
  McpIdentityDataSourceUnavailableError,
  type McpIdentityRepository,
  type McpUserIdentity,
} from "./identity";

export interface McpAuthContext {
  userId: number;
  role: McpUserIdentity["role"];
}

function parseUserId(payload: JWTPayload, claimName: string): number {
  const rawValue = payload[claimName];
  const userId =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" && /^\d+$/.test(rawValue)
        ? Number(rawValue)
        : Number.NaN;

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new InvalidTokenError("Access token has no valid linked user");
  }

  return userId;
}

function parseScopes(payload: JWTPayload): string[] {
  if (typeof payload.scope !== "string") return [];
  return Array.from(
    new Set(payload.scope.split(/\s+/).filter(scope => scope.length > 0))
  );
}

function parseClientId(payload: JWTPayload): string {
  const candidate = payload.azp ?? payload.client_id;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : payload.sub!;
}

export function readMcpAuthContext(
  authInfo: AuthInfo | undefined
): McpAuthContext {
  const context = authInfo?.extra?.salesInsightsActor;
  if (!context || typeof context !== "object") {
    throw new InvalidTokenError("Authenticated user context is unavailable");
  }

  const { userId, role } = context as Partial<McpAuthContext>;
  if (
    !Number.isSafeInteger(userId) ||
    userId! <= 0 ||
    (role !== "user" && role !== "admin" && role !== "consultora")
  ) {
    throw new InvalidTokenError("Authenticated user context is invalid");
  }

  return { userId: userId!, role };
}

export class McpJwtTokenVerifier implements OAuthTokenVerifier {
  private readonly remoteJwks;

  constructor(
    private readonly config: McpEnabledConfig,
    private readonly identities: McpIdentityRepository = databaseMcpIdentityRepository
  ) {
    this.remoteJwks = createRemoteJWKSet(new URL(config.jwksUrl));
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: JWTPayload;

    try {
      const result = await jwtVerify(token, this.remoteJwks, {
        algorithms: ["RS256"],
        audience: this.config.resourceUrl,
        issuer: this.config.issuer,
        requiredClaims: ["sub", "exp"],
        clockTolerance: 5,
      });
      payload = result.payload;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ServerError("Authorization signing keys are unavailable");
      }
      if (error instanceof joseErrors.JOSEError) {
        throw new InvalidTokenError("Access token is invalid");
      }
      throw error;
    }

    const userId = parseUserId(payload, this.config.userIdClaim);
    let identity: McpUserIdentity | null;

    try {
      identity = await this.identities.getActiveUser(userId);
    } catch (error) {
      if (
        error instanceof McpIdentityDataSourceUnavailableError ||
        error instanceof Error
      ) {
        throw new ServerError("Identity data source is unavailable");
      }
      throw new ServerError("Identity data source failed unexpectedly");
    }

    if (!identity) {
      throw new InvalidTokenError(
        "Token subject is not linked to an active user"
      );
    }

    return {
      token,
      clientId: parseClientId(payload),
      scopes: parseScopes(payload),
      expiresAt: payload.exp,
      resource: new URL(this.config.resourceUrl),
      extra: {
        salesInsightsActor: {
          userId: identity.userId,
          role: identity.role,
        } satisfies McpAuthContext,
      },
    };
  }
}

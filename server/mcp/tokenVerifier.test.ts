import {
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { McpEnabledConfig } from "./config";
import type { McpIdentityRepository } from "./identity";
import { McpJwtTokenVerifier } from "./tokenVerifier";

const userIdClaim = "https://vendas.example.com/user_id";
let jwksServer: Server;
let privateKey: KeyLike;
let config: McpEnabledConfig;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid: "test-key", use: "sig" });

  jwksServer = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((resolve, reject) => {
    jwksServer.once("error", reject);
    jwksServer.listen(0, "127.0.0.1", resolve);
  });

  const address = jwksServer.address() as AddressInfo;
  config = {
    enabled: true,
    resourceUrl: "http://127.0.0.1:3000/mcp",
    resourceMetadataUrl:
      "http://127.0.0.1:3000/.well-known/oauth-protected-resource",
    issuer: "https://tenant.example.com/",
    jwksUrl: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
    userIdClaim,
    requiredScopes: ["sales:read:self"],
    rateLimitPerMinute: 60,
  };
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    jwksServer.close(error => (error ? reject(error) : resolve()));
  });
});

async function signToken(
  overrides: {
    audience?: string;
    expiresAt?: number;
    userId?: number | string | null;
    scope?: string;
  } = {}
): Promise<string> {
  const payload: Record<string, unknown> = {
    azp: "chatgpt-test-client",
    scope: overrides.scope ?? "sales:read:self",
  };
  if (overrides.userId !== null) {
    payload[userIdClaim] = overrides.userId ?? 7;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(config.issuer)
    .setAudience(overrides.audience ?? config.resourceUrl)
    .setSubject("auth0|lucas")
    .setIssuedAt()
    .setExpirationTime(
      overrides.expiresAt ?? Math.floor(Date.now() / 1_000) + 300
    )
    .sign(privateKey);
}

function identities(
  result: Awaited<ReturnType<McpIdentityRepository["getActiveUser"]>> = {
    userId: 7,
    role: "user",
  }
): McpIdentityRepository {
  return { getActiveUser: vi.fn(async () => result) };
}

describe("MCP JWT verifier", () => {
  it("verifies signature, issuer, audience, expiry and the active user link", async () => {
    const repository = identities();
    const verifier = new McpJwtTokenVerifier(config, repository);
    const result = await verifier.verifyAccessToken(await signToken());

    expect(result).toMatchObject({
      clientId: "chatgpt-test-client",
      scopes: ["sales:read:self"],
      resource: new URL(config.resourceUrl),
      extra: { salesInsightsActor: { userId: 7, role: "user" } },
    });
    expect(repository.getActiveUser).toHaveBeenCalledWith(7);
  });

  it("rejects a token minted for another resource", async () => {
    const verifier = new McpJwtTokenVerifier(config, identities());
    await expect(
      verifier.verifyAccessToken(
        await signToken({ audience: "https://other.example.com/mcp" })
      )
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects expired tokens and missing user links", async () => {
    const verifier = new McpJwtTokenVerifier(config, identities());
    await expect(
      verifier.verifyAccessToken(
        await signToken({ expiresAt: Math.floor(Date.now() / 1_000) - 30 })
      )
    ).rejects.toBeInstanceOf(InvalidTokenError);

    await expect(
      verifier.verifyAccessToken(await signToken({ userId: null }))
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects tokens linked to inactive or deleted users", async () => {
    const verifier = new McpJwtTokenVerifier(config, identities(null));
    await expect(
      verifier.verifyAccessToken(await signToken())
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("treats an unavailable identity data source as a server failure", async () => {
    const verifier = new McpJwtTokenVerifier(config, {
      getActiveUser: vi.fn(async () => {
        const { McpIdentityDataSourceUnavailableError } = await import(
          "./identity"
        );
        throw new McpIdentityDataSourceUnavailableError();
      }),
    });

    await expect(
      verifier.verifyAccessToken(await signToken())
    ).rejects.toBeInstanceOf(ServerError);
  });

  it("does not leak unexpected database errors through token validation", async () => {
    const verifier = new McpJwtTokenVerifier(config, {
      getActiveUser: vi.fn(async () => {
        throw new Error("sensitive database connection details");
      }),
    });

    await expect(
      verifier.verifyAccessToken(await signToken())
    ).rejects.toMatchObject({
      constructor: ServerError,
      message: "Identity data source is unavailable",
    });
  });
});

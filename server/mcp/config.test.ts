import { describe, expect, it } from "vitest";
import { readMcpConfig } from "./config";

const enabledEnvironment = {
  NODE_ENV: "test",
  MCP_ENABLED: "true",
  MCP_RESOURCE_URL: "http://127.0.0.1:3000/mcp",
  MCP_AUTH_ISSUER: "https://tenant.example.com/",
  MCP_AUTH_JWKS_URL: "http://127.0.0.1:4000/.well-known/jwks.json",
  MCP_AUTH_USER_ID_CLAIM: "https://vendas.example.com/user_id",
};

describe("MCP configuration", () => {
  it("stays disabled by default without requiring OAuth variables", () => {
    expect(readMcpConfig({})).toEqual({ enabled: false });
  });

  it("rejects ambiguous enable flags", () => {
    expect(() => readMcpConfig({ MCP_ENABLED: "1" })).toThrow(
      "MCP_ENABLED must be either true or false"
    );
  });

  it("loads an explicit local test configuration", () => {
    expect(readMcpConfig(enabledEnvironment)).toEqual({
      enabled: true,
      resourceUrl: "http://127.0.0.1:3000/mcp",
      resourceMetadataUrl:
        "http://127.0.0.1:3000/.well-known/oauth-protected-resource",
      issuer: "https://tenant.example.com/",
      jwksUrl: "http://127.0.0.1:4000/.well-known/jwks.json",
      userIdClaim: "https://vendas.example.com/user_id",
      requiredScopes: ["sales:read:self"],
      rateLimitPerMinute: 60,
    });
  });

  it("requires HTTPS and the exact /mcp resource in deployment modes", () => {
    expect(() =>
      readMcpConfig({ ...enabledEnvironment, NODE_ENV: "production" })
    ).toThrow("MCP_RESOURCE_URL must use HTTPS outside local tests");

    expect(() =>
      readMcpConfig({
        ...enabledEnvironment,
        MCP_RESOURCE_URL: "http://127.0.0.1:3000/not-mcp",
      })
    ).toThrow("MCP_RESOURCE_URL must point to the /mcp endpoint");
  });

  it("fails closed when an enabled configuration is incomplete", () => {
    expect(() =>
      readMcpConfig({ NODE_ENV: "test", MCP_ENABLED: "true" })
    ).toThrow("MCP_RESOURCE_URL is required when MCP_ENABLED=true");
  });
});

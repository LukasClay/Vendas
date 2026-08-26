import { metadataHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express, type Request, type Response } from "express";
import { readMcpConfig, type McpConfig } from "./config";
import { createMcpRateLimit } from "./rateLimit";
import {
  createSalesInsightsMcpServer,
  type SalesInsightsMcpService,
} from "./server";
import { McpJwtTokenVerifier } from "./tokenVerifier";

interface RegisterMcpRoutesOptions {
  config?: McpConfig;
  verifier?: OAuthTokenVerifier;
  service?: SalesInsightsMcpService;
}

function methodNotAllowed(_request: Request, response: Response): void {
  response.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
}

export function registerMcpRoutes(
  app: Express,
  options: RegisterMcpRoutesOptions = {}
): McpConfig {
  const config = options.config ?? readMcpConfig();

  if (!config.enabled) {
    app.all("/mcp", (_request, response) => {
      response.status(404).json({ error: "not_found" });
    });
    app.get(
      [
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/mcp",
      ],
      (_request, response) => {
        response.status(404).json({ error: "not_found" });
      }
    );
    return config;
  }

  const metadata = {
    resource: config.resourceUrl,
    authorization_servers: [config.issuer],
    scopes_supported: [...config.requiredScopes],
    bearer_methods_supported: ["header"],
    resource_name: "Vendas Sales Insights",
  };
  const handleMetadata = metadataHandler(metadata);
  app.use("/.well-known/oauth-protected-resource", handleMetadata);
  app.use("/.well-known/oauth-protected-resource/mcp", handleMetadata);

  const verifier = options.verifier ?? new McpJwtTokenVerifier(config);
  const rateLimit = createMcpRateLimit(config.rateLimitPerMinute);
  const bearerAuth = requireBearerAuth({
    verifier,
    requiredScopes: [...config.requiredScopes],
    resourceMetadataUrl: config.resourceMetadataUrl,
  });

  app.use("/mcp", rateLimit, bearerAuth);
  app.post(
    "/mcp",
    express.json({ limit: "256kb", strict: true }),
    async (request, response) => {
      const server = createSalesInsightsMcpServer(config, options.service);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      const close = async () => {
        await transport.close().catch(() => undefined);
        await server.close().catch(() => undefined);
      };
      response.on("close", () => void close());

      try {
        await server.connect(transport);
        await transport.handleRequest(request, response, request.body);
      } catch (error) {
        console.error(
          `[MCP] Falha de transporte: ${error instanceof Error ? error.name : "UnknownError"}`
        );
        if (!response.headersSent) {
          response.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
        await close();
      }
    }
  );
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);
  app.all("/mcp", methodNotAllowed);

  return config;
}

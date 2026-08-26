import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpEnabledConfig } from "./config";
import { registerMcpRoutes } from "./routes";
import type { SalesInsightsMcpService } from "./server";

const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) => {
          server.close(error => (error ? reject(error) : resolve()));
        })
    )
  );
});

async function listen(app: Express): Promise<string> {
  const server = createServer(app);
  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function enabledConfig(baseUrl: string): McpEnabledConfig {
  return {
    enabled: true,
    resourceUrl: `${baseUrl}/mcp`,
    resourceMetadataUrl: `${baseUrl}/.well-known/oauth-protected-resource`,
    issuer: "https://tenant.example.com/",
    jwksUrl: "https://tenant.example.com/.well-known/jwks.json",
    userIdClaim: "https://vendas.example.com/user_id",
    requiredScopes: ["sales:read:self"],
    rateLimitPerMinute: 60,
  };
}

function verifier(scopes = ["sales:read:self"]): OAuthTokenVerifier {
  return {
    verifyAccessToken: vi.fn(async token => {
      if (token === "invalid") throw new InvalidTokenError("Invalid token");
      return {
        token,
        clientId: "chatgpt-test-client",
        scopes,
        expiresAt: Math.floor(Date.now() / 1_000) + 300,
        extra: {
          salesInsightsActor: { userId: 7, role: "user" },
        },
      };
    }),
  };
}

const snapshotResult = {
  dataClassification: "aggregated_sales_only",
  asOf: {
    instant: "2026-08-25T13:00:00.000Z",
    timeZone: "America/Sao_Paulo",
    localDate: "2026-08-25",
    localTime: "10:00",
    dayStatus: "in_progress",
    workPeriod: "weekday_full",
  },
  seller: { id: 7, name: "Vendedor de teste" },
  totals: {
    todayAmount: "500.00",
    todaySales: 1,
    monthAmount: "10500.00",
    monthSales: 12,
  },
  calendar: {
    monthStart: "2026-08-01",
    monthEnd: "2026-08-31",
    totalPrimaryWeekdays: 21,
    completedPrimaryWeekdaysBeforeToday: 16,
    remainingPrimaryWeekdays: 5,
    primaryWeekdaysAfterToday: 4,
    futureSaturdaysAreSupplemental: true,
    saturdayClosesAt: "12:00",
  },
  officialTarget: null,
  simulations: [],
  projection: {
    projectedMonthAmount: "15000.00",
    completedAveragePerWorkPeriod: "625.00",
    completedAveragePerFullDayEquivalent: "645.16",
    completedWorkPeriods: 16,
    completedCapacityUnits: 15.5,
    currentDayExtrapolated: false,
    method: "completed_work_capacity_average",
  },
  limitations: [
    "weekday_hours_not_configured",
    "current_incomplete_day_not_extrapolated",
  ],
} as const;

const performanceResult = {
  dataClassification: "aggregated_sales_only",
  asOf: {
    instant: "2026-08-25T13:00:00.000Z",
    timeZone: "America/Sao_Paulo",
  },
  seller: { id: 7, name: "Vendedor de teste" },
  period: {
    startDate: "2026-08-24",
    endDate: "2026-08-25",
    totalAmount: "600.00",
    totalSales: 2,
  },
  completedPerformance: {
    workPeriods: 1,
    capacityUnits: 1,
    averagePerWorkPeriod: "100.00",
    averagePerFullDayEquivalent: "100.00",
    bestDay: {
      date: "2026-08-24",
      amount: "100.00",
      sales: 1,
      status: "completed",
      workPeriod: "weekday_full",
      capacityUnits: 1,
    },
    worstDay: {
      date: "2026-08-24",
      amount: "100.00",
      sales: 1,
      status: "completed",
      workPeriod: "weekday_full",
      capacityUnits: 1,
    },
  },
  series: [
    {
      date: "2026-08-24",
      amount: "100.00",
      sales: 1,
      status: "completed",
      workPeriod: "weekday_full",
      capacityUnits: 1,
    },
    {
      date: "2026-08-25",
      amount: "500.00",
      sales: 1,
      status: "in_progress",
      workPeriod: "weekday_full",
      capacityUnits: 1,
    },
  ],
  limitations: ["current_incomplete_day_excluded_from_completed_averages"],
} as const;

function service() {
  return {
    getSalesSnapshot: vi.fn(async () => snapshotResult),
    getSalesPerformance: vi.fn(async () => performanceResult),
  } as unknown as SalesInsightsMcpService;
}

describe("MCP HTTP routes", () => {
  it("returns 404 while the integration is disabled", async () => {
    const app = express();
    registerMcpRoutes(app, { config: { enabled: false } });
    const baseUrl = await listen(app);

    expect((await fetch(`${baseUrl}/mcp`)).status).toBe(404);
    expect(
      (await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)).status
    ).toBe(404);
  });

  it("publishes protected-resource metadata without exposing the MCP data", async () => {
    const app = express();
    const baseUrl = await listen(app);
    const config = enabledConfig(baseUrl);
    registerMcpRoutes(app, {
      config,
      verifier: verifier(),
      service: service(),
    });

    const response = await fetch(config.resourceMetadataUrl);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        resource: config.resourceUrl,
        authorization_servers: [config.issuer],
        scopes_supported: ["sales:read:self"],
      })
    );

    const pathSpecificResponse = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`
    );
    expect(pathSpecificResponse.status).toBe(200);
    expect(await pathSpecificResponse.json()).toEqual(
      expect.objectContaining({ resource: config.resourceUrl })
    );
  });

  it("rejects missing, invalid and insufficiently scoped tokens", async () => {
    const app = express();
    const baseUrl = await listen(app);
    const config = enabledConfig(baseUrl);
    registerMcpRoutes(app, {
      config,
      verifier: verifier(),
      service: service(),
    });

    const missing = await fetch(config.resourceUrl, { method: "POST" });
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain(
      `resource_metadata="${config.resourceMetadataUrl}"`
    );
    expect(missing.headers.get("www-authenticate")).toContain(
      'scope="sales:read:self"'
    );

    const invalid = await fetch(config.resourceUrl, {
      method: "POST",
      headers: { Authorization: "Bearer invalid" },
    });
    expect(invalid.status).toBe(401);

    const noScopeApp = express();
    const noScopeBaseUrl = await listen(noScopeApp);
    const noScopeConfig = enabledConfig(noScopeBaseUrl);
    registerMcpRoutes(noScopeApp, {
      config: noScopeConfig,
      verifier: verifier([]),
      service: service(),
    });
    const insufficient = await fetch(noScopeConfig.resourceUrl, {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
    });
    expect(insufficient.status).toBe(403);
    expect(insufficient.headers.get("www-authenticate")).toContain(
      'error="insufficient_scope"'
    );
  });

  it("lists and calls only self-service read-only tools over Streamable HTTP", async () => {
    const app = express();
    const baseUrl = await listen(app);
    const config = enabledConfig(baseUrl);
    const testService = service();
    registerMcpRoutes(app, {
      config,
      verifier: verifier(),
      service: testService,
    });

    const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(config.resourceUrl),
      { requestInit: { headers: { Authorization: "Bearer valid" } } }
    );

    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual([
        "get_sales_snapshot",
        "get_sales_performance",
      ]);
      for (const tool of tools.tools) {
        expect(tool.annotations).toMatchObject({
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        });
        expect(tool._meta?.securitySchemes).toEqual([
          { type: "oauth2", scopes: ["sales:read:self"] },
        ]);
        expect(tool.inputSchema.properties).not.toHaveProperty("sellerId");
      }

      const result = await client.callTool({
        name: "get_sales_snapshot",
        arguments: { targets: [20_000] },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        dataClassification: "aggregated_sales_only",
        seller: { id: 7 },
        totals: { todayAmount: "500.00", monthAmount: "10500.00" },
      });
      expect(testService.getSalesSnapshot).toHaveBeenCalledWith(
        { userId: 7, role: "user", scopes: ["sales:read:self"] },
        { targets: [20_000] }
      );

      const crossSellerAttempt = await client.callTool({
        name: "get_sales_snapshot",
        arguments: { sellerId: 99 },
      });
      expect(crossSellerAttempt.isError).toBe(true);
      expect(testService.getSalesSnapshot).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });
});

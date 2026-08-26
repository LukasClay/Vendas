import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  SalesInsightsAuthorizationError,
  SalesInsightsSellerNotFoundError,
  salesInsightsService,
  type SalesInsightsActor,
} from "../salesInsights/service";
import type { McpEnabledConfig } from "./config";
import {
  salesPerformanceOutputSchema,
  salesPerformanceToolInputSchema,
  salesSnapshotOutputSchema,
  salesSnapshotToolInputSchema,
} from "./schemas";
import { SALES_INSIGHTS_SELF_SCOPE } from "./scopes";
import { readMcpAuthContext } from "./tokenVerifier";

export type SalesInsightsMcpService = Pick<
  typeof salesInsightsService,
  "getSalesPerformance" | "getSalesSnapshot"
>;

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const oauthSecuritySchemes = [
  { type: "oauth2", scopes: [SALES_INSIGHTS_SELF_SCOPE] },
] as const;

function createActor(authInfo: AuthInfo | undefined): SalesInsightsActor {
  const context = readMcpAuthContext(authInfo);
  const scopes = authInfo?.scopes.includes(SALES_INSIGHTS_SELF_SCOPE)
    ? [SALES_INSIGHTS_SELF_SCOPE]
    : [];

  return {
    userId: context.userId,
    role: context.role,
    scopes,
  };
}

function buildAuthChallenge(config: McpEnabledConfig): string {
  return `Bearer resource_metadata="${config.resourceMetadataUrl}", scope="${SALES_INSIGHTS_SELF_SCOPE}", error="insufficient_scope", error_description="Authorization with sales:read:self is required"`;
}

function toolError(error: unknown, config: McpEnabledConfig): CallToolResult {
  if (error instanceof SalesInsightsAuthorizationError) {
    return {
      content: [
        {
          type: "text",
          text: "A autorização não permite consultar estes dados de vendas.",
        },
      ],
      _meta: { "mcp/www_authenticate": [buildAuthChallenge(config)] },
      isError: true,
    };
  }

  if (error instanceof SalesInsightsSellerNotFoundError) {
    return {
      content: [
        {
          type: "text",
          text: "O usuário vinculado não está disponível para consulta.",
        },
      ],
      isError: true,
    };
  }

  console.error(
    `[MCP] Falha ao executar ferramenta: ${error instanceof Error ? error.name : "UnknownError"}`
  );
  return {
    content: [
      {
        type: "text",
        text: "Não foi possível consultar os dados agregados de vendas.",
      },
    ],
    isError: true,
  };
}

export function createSalesInsightsMcpServer(
  config: McpEnabledConfig,
  service: SalesInsightsMcpService = salesInsightsService
): McpServer {
  const server = new McpServer(
    { name: "vendas-sales-insights", version: "2.18.0" },
    {
      instructions:
        "Consulte apenas os dados agregados de vendas do usuário autenticado. As ferramentas são somente leitura, não retornam dados pessoais de clientes e usam America/Sao_Paulo. Não suponha horários de expediente de segunda a sexta.",
    }
  );

  server.registerTool(
    "get_sales_snapshot",
    {
      title: "Consultar resumo das minhas vendas",
      description:
        "Use quando o usuário perguntar quanto vendeu hoje ou no mês, quanto falta para uma meta, ritmo necessário ou projeção mensal. Retorna somente agregados do usuário autenticado.",
      inputSchema: salesSnapshotToolInputSchema,
      outputSchema: salesSnapshotOutputSchema,
      annotations: readOnlyAnnotations,
      _meta: { securitySchemes: oauthSecuritySchemes },
    },
    async (input, extra) => {
      try {
        const result = await service.getSalesSnapshot(
          createActor(extra.authInfo),
          input
        );
        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Dados agregados em ${result.asOf.localDate}: R$ ${result.totals.todayAmount} hoje e R$ ${result.totals.monthAmount} no mês.`,
            },
          ],
        };
      } catch (error) {
        return toolError(error, config);
      }
    }
  );

  server.registerTool(
    "get_sales_performance",
    {
      title: "Consultar meu desempenho por período",
      description:
        "Use para analisar as próprias vendas entre duas datas, incluindo totais, médias concluídas, melhores e piores dias. Retorna somente agregados do usuário autenticado.",
      inputSchema: salesPerformanceToolInputSchema,
      outputSchema: salesPerformanceOutputSchema,
      annotations: readOnlyAnnotations,
      _meta: { securitySchemes: oauthSecuritySchemes },
    },
    async (input, extra) => {
      try {
        const result = await service.getSalesPerformance(
          createActor(extra.authInfo),
          input
        );
        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Dados agregados de ${result.period.startDate} a ${result.period.endDate}: R$ ${result.period.totalAmount} em ${result.period.totalSales} vendas.`,
            },
          ],
        };
      } catch (error) {
        return toolError(error, config);
      }
    }
  );

  return server;
}

import type { SalesInsightsScope } from "../salesInsights/service";

export const SALES_INSIGHTS_SELF_SCOPE =
  "sales:read:self" as const satisfies SalesInsightsScope;

export const SALES_INSIGHTS_TEAM_SCOPE =
  "sales:read:team" as const satisfies SalesInsightsScope;

export const SALES_INSIGHTS_MCP_SCOPES = [
  SALES_INSIGHTS_SELF_SCOPE,
  SALES_INSIGHTS_TEAM_SCOPE,
] as const;

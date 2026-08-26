import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

export interface McpUserIdentity {
  userId: number;
  role: "user" | "admin" | "consultora";
}

export interface McpIdentityRepository {
  getActiveUser(userId: number): Promise<McpUserIdentity | null>;
}

export class McpIdentityDataSourceUnavailableError extends Error {
  constructor() {
    super("MCP identity data source is unavailable");
    this.name = "McpIdentityDataSourceUnavailableError";
  }
}

type McpIdentityDatabase<TSchema extends Record<string, unknown>> =
  NodePgDatabase<TSchema>;

export function buildMcpIdentityQuery<TSchema extends Record<string, unknown>>(
  database: McpIdentityDatabase<TSchema>,
  userId: number
) {
  return database
    .select({ userId: users.id, role: users.role })
    .from(users)
    .where(
      and(eq(users.id, userId), eq(users.active, true), isNull(users.deletedAt))
    )
    .limit(1);
}

export const databaseMcpIdentityRepository: McpIdentityRepository = {
  async getActiveUser(userId) {
    const database = await getDb();
    if (!database) throw new McpIdentityDataSourceUnavailableError();

    const [identity] = await buildMcpIdentityQuery(database, userId);
    return identity ?? null;
  },
};

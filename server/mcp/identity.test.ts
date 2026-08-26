import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { buildMcpIdentityQuery } from "./identity";

const database = drizzle.mock();

describe("MCP identity query", () => {
  it("selects only id and role while requiring an active non-deleted user", () => {
    const query = buildMcpIdentityQuery(database, 42).toSQL();
    const statement = query.sql.replace(/\s+/g, " ").trim();

    expect(statement).toContain('select "id", "role" from "users"');
    expect(statement).toContain('"users"."active" =');
    expect(statement).toContain('"users"."deletedAt" is null');
    expect(query.params).toContain(42);
    expect(statement).not.toContain('"email"');
    expect(statement).not.toContain('"phone"');
    expect(statement).not.toContain('"passwordHash"');
    expect(statement).not.toContain('"sessionVersion"');
  });
});

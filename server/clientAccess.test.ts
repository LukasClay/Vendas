import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  buildAccessibleClientSearchQuery,
  CLIENT_SEARCH_LIMIT,
  type ClientAccessActor,
} from "./clientAccess";

const db = drizzle.mock();

function compile(actor: ClientAccessActor, term = "Maria") {
  return buildAccessibleClientSearchQuery(db, actor, term).toSQL();
}

function compactSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("buildAccessibleClientSearchQuery", () => {
  it("restringe vendedor às próprias vendas históricas não excluídas", () => {
    const query = compile({ id: 42, role: "user" });
    const statement = compactSql(query.sql);

    expect(statement).toContain('exists (select 1 from "sales"');
    expect(statement).toContain('"sales"."clientId" = "clients"."id"');
    expect(statement).toContain('"sales"."deletedAt" is null');
    expect(statement).toContain('"sales"."sellerId" = $3');
    expect(statement).not.toContain('"sales"."saleDate"');
    expect(query.params).toContain(42);
  });

  it("permite à consultora clientes de qualquer vendedor, mas só com venda não excluída", () => {
    const query = compile({ id: 7, role: "consultora" });
    const statement = compactSql(query.sql);

    expect(statement).toContain('exists (select 1 from "sales"');
    expect(statement).toContain('"sales"."clientId" = "clients"."id"');
    expect(statement).toContain('"sales"."deletedAt" is null');
    expect(statement).not.toContain('"sales"."sellerId"');
    expect(query.params).not.toContain(7);
  });

  it("mantém acesso global do admin sem subconsulta de vendas", () => {
    const query = compile({ id: 1, role: "admin" });
    const statement = compactSql(query.sql);

    expect(statement).not.toContain("exists (");
    expect(statement).not.toContain('from "sales"');
    expect(statement).not.toContain('"deletedAt"');
  });

  it("escapa curingas e mantém o limite fixo de oito resultados", () => {
    const query = compile({ id: 42, role: "user" }, "  Ma%_\\ria  ");
    const statement = compactSql(query.sql);

    expect(query.params).toContain("%Ma\\%\\_\\\\ria%");
    expect(statement).toContain("limit");
    expect(query.params).toContain(CLIENT_SEARCH_LIMIT);
  });

  it("rejeita termos fora dos limites antes de montar SQL", () => {
    expect(() => compile({ id: 42, role: "user" }, " M ")).toThrow(RangeError);
    expect(() => compile({ id: 42, role: "user" }, "x".repeat(101))).toThrow(
      RangeError
    );
  });
});

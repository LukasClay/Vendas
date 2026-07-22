import { and, asc, eq, exists, isNull, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { clients, sales } from "../drizzle/schema";

export const CLIENT_SEARCH_LIMIT = 8;

export type ClientAccessActor =
  | { id: number; role: "user" }
  | { id: number; role: "consultora" }
  | { id: number; role: "admin" };

export type ClientAccessDatabase<TSchema extends Record<string, unknown>> =
  NodePgDatabase<TSchema>;

function normalizeSearchTerm(term: string): string {
  const normalized = term.trim();
  if (normalized.length < 2 || normalized.length > 100) {
    throw new RangeError(
      "A busca de clientes deve ter entre 2 e 100 caracteres."
    );
  }
  return normalized.replace(/[%_\\]/g, "\\$&");
}

function getPhoneSearchDigits(term: string): string | null {
  const digits = term.replace(/\D/g, "");
  return digits.length >= 2 ? digits : null;
}

export function buildClientAccessCondition<
  TSchema extends Record<string, unknown>,
>(
  db: ClientAccessDatabase<TSchema>,
  actor: ClientAccessActor
): SQL | undefined {
  if (actor.role === "admin") return undefined;

  const saleConditions: SQL[] = [
    eq(sales.clientId, clients.id),
    isNull(sales.deletedAt),
  ];

  if (actor.role === "user") {
    saleConditions.push(eq(sales.sellerId, actor.id));
  }

  return exists(
    db
      .select({ one: sql<number>`1` })
      .from(sales)
      .where(and(...saleConditions))
  );
}

/**
 * Monta a busca já limitada ao conjunto de clientes autorizado para o ator.
 *
 * - vendedor: clientes ligados a qualquer venda histórica não excluída própria;
 * - consultora: clientes ligados a qualquer venda não excluída;
 * - admin: todos os clientes, inclusive registros ainda sem venda vinculada.
 */
export function buildAccessibleClientSearchQuery<
  TSchema extends Record<string, unknown>,
>(db: ClientAccessDatabase<TSchema>, actor: ClientAccessActor, term: string) {
  const escapedTerm = normalizeSearchTerm(term);
  const like = `%${escapedTerm}%`;
  const phoneSearchDigits = getPhoneSearchDigits(term);
  const textMatches: SQL[] = [
    sql`${clients.fullName} ILIKE ${like} ESCAPE '\\'`,
    sql`${clients.phone} ILIKE ${like} ESCAPE '\\'`,
  ];
  if (phoneSearchDigits) {
    // Canonical phones are stored as digits/E.164, but legacy rows can still
    // contain masks. Comparing digits lets the masked mobile input find both.
    textMatches.push(
      sql`regexp_replace(coalesce(${clients.phone}, ''), '[^0-9]', '', 'g') LIKE ${`%${phoneSearchDigits}%`}`
    );
  }
  const textMatch = or(...textMatches);
  const clientScope = buildClientAccessCondition(db, actor);

  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      birthDate: clients.birthDate,
      phone: clients.phone,
    })
    .from(clients)
    .where(clientScope ? and(textMatch, clientScope) : textMatch)
    .orderBy(asc(clients.fullName))
    .limit(CLIENT_SEARCH_LIMIT);
}

export async function searchAccessibleClients<
  TSchema extends Record<string, unknown>,
>(db: ClientAccessDatabase<TSchema>, actor: ClientAccessActor, term: string) {
  return await buildAccessibleClientSearchQuery(db, actor, term);
}

export type ClientIdentityDate = string | Date | null | undefined;

export interface ClientIdentityInput {
  id?: number;
  fullName: string;
  birthDate?: ClientIdentityDate;
  phone?: string | null;
}

export interface NormalizedClientIdentity {
  id?: number;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
}

export type ClientIdentityField = "fullName" | "birthDate" | "phone";
export type ClientIdentityErrorCode = "CONFLICT" | "NOT_FOUND";

export interface ClientIdentityCompatibility {
  existing: NormalizedClientIdentity;
  requested: NormalizedClientIdentity;
}

/**
 * Patch intentionally excludes `fullName`: resolving a sale must never rename
 * an existing canonical client. Optional canonical data may only be filled when
 * the stored value is currently null.
 */
export type SafeClientEnrichment = Partial<
  Pick<NormalizedClientIdentity, "birthDate" | "phone">
>;

export class ClientIdentityConflictError extends Error {
  readonly code = "CONFLICT" as const;

  constructor(readonly fields: readonly ClientIdentityField[]) {
    const labels: Record<ClientIdentityField, string> = {
      fullName: "nome",
      birthDate: "data de nascimento",
      phone: "telefone",
    };
    super(
      `Os dados informados divergem do cadastro existente: ${fields
        .map(field => labels[field])
        .join(", ")}.`
    );
    this.name = "ClientIdentityConflictError";
  }
}

export class ClientNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;

  constructor(readonly clientId?: number) {
    super("Cliente não encontrado.");
    this.name = "ClientNotFoundError";
  }
}

export function normalizeClientName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

  if (!normalized) {
    throw new TypeError("Nome do cliente não pode ser vazio.");
  }

  return normalized;
}

export function normalizeClientBirthDate(
  value: ClientIdentityDate
): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Data de nascimento inválida.");
    }
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(trimmed);
  if (!match) {
    throw new TypeError("Data de nascimento deve estar no formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError("Data de nascimento inválida.");
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function normalizeClientPhone(
  value: string | null | undefined
): string | null {
  if (value == null || !value.trim()) return null;

  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    throw new TypeError("Telefone deve conter dígitos.");
  }

  // Brazilian numbers are stored in both local form and with country code in
  // legacy data. Strip +55/55 only when the remaining local part has a valid
  // Brazilian length, so a local number whose DDD is 55 is not misclassified.
  if (digits.startsWith("0055") && [10, 11].includes(digits.length - 4)) {
    return digits.slice(4);
  }
  if (digits.startsWith("55") && [10, 11].includes(digits.length - 2)) {
    return digits.slice(2);
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (trimmed.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }

  return digits.length > 11 ? `+${digits}` : digits;
}

function normalizedPhonesMatch(
  existing: string | null,
  requested: string | null
): boolean {
  return existing === requested;
}

export function normalizeClientIdentity(
  identity: ClientIdentityInput
): NormalizedClientIdentity {
  return {
    id: identity.id,
    fullName: normalizeClientName(identity.fullName),
    birthDate: normalizeClientBirthDate(identity.birthDate),
    phone: normalizeClientPhone(identity.phone),
  };
}

/**
 * Ensures a request still represents the selected canonical client.
 * Null canonical optional fields may be enriched, but a populated canonical
 * field can never be changed or omitted by this workflow.
 */
export function assertClientIdentityCompatible(
  existing: ClientIdentityInput | null | undefined,
  requested: ClientIdentityInput
): ClientIdentityCompatibility {
  if (!existing) {
    throw new ClientNotFoundError(requested.id);
  }

  const normalizedExisting = normalizeClientIdentity(existing);
  const normalizedRequested = normalizeClientIdentity(requested);
  const conflicts: ClientIdentityField[] = [];

  if (normalizedExisting.fullName !== normalizedRequested.fullName) {
    conflicts.push("fullName");
  }
  if (
    normalizedExisting.birthDate !== null &&
    normalizedExisting.birthDate !== normalizedRequested.birthDate
  ) {
    conflicts.push("birthDate");
  }
  if (
    normalizedExisting.phone !== null &&
    !normalizedPhonesMatch(normalizedExisting.phone, normalizedRequested.phone)
  ) {
    conflicts.push("phone");
  }

  if (conflicts.length > 0) {
    throw new ClientIdentityConflictError(conflicts);
  }

  return {
    existing: normalizedExisting,
    requested: normalizedRequested,
  };
}

/**
 * Returns the only safe update for an existing canonical client. The result
 * contains values exclusively for optional fields that are null in storage.
 */
export function getSafeClientEnrichment(
  existing: ClientIdentityInput | null | undefined,
  requested: ClientIdentityInput
): SafeClientEnrichment {
  const compatible = assertClientIdentityCompatible(existing, requested);
  const enrichment: SafeClientEnrichment = {};

  if (
    compatible.existing.birthDate === null &&
    compatible.requested.birthDate !== null
  ) {
    enrichment.birthDate = compatible.requested.birthDate;
  }
  if (
    compatible.existing.phone === null &&
    compatible.requested.phone !== null
  ) {
    enrichment.phone = compatible.requested.phone;
  }

  return enrichment;
}

import { describe, expect, it } from "vitest";
import {
  ClientIdentityConflictError,
  ClientNotFoundError,
  assertClientIdentityCompatible,
  getSafeClientEnrichment,
  normalizeClientBirthDate,
  normalizeClientIdentity,
  normalizeClientName,
  normalizeClientPhone,
} from "./clientIdentity";

describe("client identity normalization", () => {
  it("normalizes name whitespace and case without removing accents", () => {
    expect(normalizeClientName("  MARIA   da\nSILVA  ")).toBe("maria da silva");
    expect(normalizeClientName("  JOÃO  ")).toBe("joão");
  });

  it("rejects an empty normalized name", () => {
    expect(() => normalizeClientName(" \n\t ")).toThrow(TypeError);
  });

  it("normalizes dates to YYYY-MM-DD and validates calendar dates", () => {
    expect(normalizeClientBirthDate("1990-05-20T12:30:00.000Z")).toBe(
      "1990-05-20"
    );
    expect(normalizeClientBirthDate(new Date("2001-09-08T18:00:00.000Z"))).toBe(
      "2001-09-08"
    );
    expect(normalizeClientBirthDate("  ")).toBeNull();
    expect(() => normalizeClientBirthDate("2023-02-29")).toThrow(TypeError);
    expect(() => normalizeClientBirthDate("20/05/1990")).toThrow(TypeError);
  });

  it("treats Brazilian phones with and without country code as equivalent", () => {
    expect(normalizeClientPhone("(11) 99999-8888")).toBe("11999998888");
    expect(normalizeClientPhone("+55 (11) 99999-8888")).toBe("11999998888");
    expect(normalizeClientPhone("55 11 99999-8888")).toBe("11999998888");
    expect(normalizeClientPhone("0055 11 99999-8888")).toBe("11999998888");
  });

  it.each([
    ["+1 (212) 555-1234", "+12125551234"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["+34 612 345 678", "+34612345678"],
    ["0033 6 12 34 56 78", "+33612345678"],
  ])(
    "preserves explicit non-Brazilian numbers in E.164 format",
    (input, expected) => {
      expect(normalizeClientPhone(input)).toBe(expected);
    }
  );

  it("does not strip a legitimate local Brazilian DDD 55", () => {
    expect(normalizeClientPhone("(55) 99999-8888")).toBe("55999998888");
  });

  it("normalizes an entire identity", () => {
    expect(
      normalizeClientIdentity({
        id: 7,
        fullName: "  Maria   DA Silva ",
        birthDate: "1990-05-20T00:00:00.000Z",
        phone: "+55 11 99999-8888",
      })
    ).toEqual({
      id: 7,
      fullName: "maria da silva",
      birthDate: "1990-05-20",
      phone: "11999998888",
    });
  });
});

describe("assertClientIdentityCompatible", () => {
  const existing = {
    id: 3,
    fullName: "Maria da Silva",
    birthDate: "1990-05-20",
    phone: "11999998888",
  };

  it("accepts formatting-only differences and returns normalized identities", () => {
    const result = assertClientIdentityCompatible(existing, {
      id: 3,
      fullName: "  MARIA   DA SILVA ",
      birthDate: "1990-05-20T12:00:00.000Z",
      phone: "+55 (11) 99999-8888",
    });

    expect(result.existing).toEqual({
      id: 3,
      fullName: "maria da silva",
      birthDate: "1990-05-20",
      phone: "11999998888",
    });
    expect(result.requested).toEqual(result.existing);
  });

  it("rejects an ambiguous international phone without plus", () => {
    expect(() =>
      assertClientIdentityCompatible(
        { ...existing, phone: "12125551234" },
        { ...existing, phone: "+1 (212) 555-1234" }
      )
    ).toThrowError(
      expect.objectContaining({
        fields: ["phone"],
      })
    );
  });

  it("accepts an unambiguous legacy international phone over 11 digits", () => {
    const result = assertClientIdentityCompatible(
      { ...existing, phone: "351912345678" },
      { ...existing, phone: "+351 912 345 678" }
    );

    expect(result.existing.phone).toBe("+351912345678");
    expect(result.requested.phone).toBe("+351912345678");
  });

  it("rejects a name change with a typed CONFLICT error", () => {
    expect.assertions(4);

    try {
      assertClientIdentityCompatible(existing, {
        ...existing,
        fullName: "Joana da Silva",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ClientIdentityConflictError);
      expect(error).toMatchObject({ code: "CONFLICT", fields: ["fullName"] });
      expect((error as Error).message).toContain("nome");
      expect((error as Error).message).not.toContain("Maria");
    }
  });

  it("rejects changed or omitted populated canonical fields", () => {
    expect(() =>
      assertClientIdentityCompatible(existing, {
        ...existing,
        birthDate: "1991-05-20",
        phone: null,
      })
    ).toThrowError(
      expect.objectContaining({
        code: "CONFLICT",
        fields: ["birthDate", "phone"],
      })
    );
  });

  it("allows requested data to enrich canonical null fields", () => {
    expect(() =>
      assertClientIdentityCompatible(
        { ...existing, birthDate: null, phone: null },
        existing
      )
    ).not.toThrow();
  });

  it("reports a missing canonical client with a typed NOT_FOUND error", () => {
    expect(() =>
      assertClientIdentityCompatible(null, {
        ...existing,
        id: 99,
      })
    ).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND", clientId: 99 })
    );

    try {
      assertClientIdentityCompatible(undefined, existing);
    } catch (error) {
      expect(error).toBeInstanceOf(ClientNotFoundError);
    }
  });
});

describe("getSafeClientEnrichment", () => {
  it("fills only null canonical fields with normalized requested values", () => {
    const existing = {
      id: 3,
      fullName: "Maria da Silva",
      birthDate: null,
      phone: null,
    };

    expect(
      getSafeClientEnrichment(existing, {
        ...existing,
        birthDate: "1990-05-20T12:00:00.000Z",
        phone: "+55 (11) 99999-8888",
      })
    ).toEqual({
      birthDate: "1990-05-20",
      phone: "11999998888",
    });
  });

  it("preserves E.164 when enriching an empty international phone", () => {
    const existing = {
      id: 3,
      fullName: "Maria da Silva",
      birthDate: "1990-05-20",
      phone: null,
    };

    expect(
      getSafeClientEnrichment(existing, {
        ...existing,
        phone: "+33 6 12 34 56 78",
      })
    ).toEqual({ phone: "+33612345678" });
  });

  it("never includes populated canonical fields in the update patch", () => {
    const existing = {
      id: 3,
      fullName: "Maria da Silva",
      birthDate: "1990-05-20",
      phone: "11999998888",
    };

    const enrichment = getSafeClientEnrichment(existing, {
      ...existing,
      fullName: "  MARIA DA SILVA ",
      phone: "+55 11 99999-8888",
    });

    expect(enrichment).toEqual({});
    expect(enrichment).not.toHaveProperty("fullName");
  });

  it("rejects conflicts instead of returning an unsafe overwrite", () => {
    expect(() =>
      getSafeClientEnrichment(
        {
          fullName: "Maria",
          birthDate: "1990-05-20",
          phone: "11999998888",
        },
        {
          fullName: "Joana",
          birthDate: "1990-05-20",
          phone: "11999998888",
        }
      )
    ).toThrow(ClientIdentityConflictError);
  });
});

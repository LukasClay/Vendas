import { describe, expect, it } from "vitest";
import { z } from "zod";

// Replica do schema interno de `server/storage.ts` para fixar contrato.
// Se o schema la mudar sem ajustar estes testes, diff fica obvio.
const ManusUrlResponse = z.object({ url: z.string().url() });

describe("Manus storage response schema", () => {
  it("aceita payload valido com URL absoluta", () => {
    const parsed = ManusUrlResponse.parse({
      url: "https://cdn.example.com/fotos/abc.jpg",
    });
    expect(parsed.url).toBe("https://cdn.example.com/fotos/abc.jpg");
  });

  it("aceita campos extras sem quebrar (compat futura)", () => {
    const parsed = ManusUrlResponse.parse({
      url: "https://cdn.example.com/abc",
      etag: "xyz",
      size: 1024,
    });
    expect(parsed.url).toBe("https://cdn.example.com/abc");
  });

  it("rejeita payload sem url", () => {
    expect(() => ManusUrlResponse.parse({ error: "upload failed" })).toThrow();
  });

  it("rejeita url vazia", () => {
    expect(() => ManusUrlResponse.parse({ url: "" })).toThrow();
  });

  it("rejeita url nao-absoluta", () => {
    expect(() => ManusUrlResponse.parse({ url: "/relative/path" })).toThrow();
  });

  it("rejeita url undefined", () => {
    expect(() => ManusUrlResponse.parse({ url: undefined })).toThrow();
  });

  it("rejeita resposta que nao e objeto", () => {
    expect(() => ManusUrlResponse.parse(null)).toThrow();
    expect(() => ManusUrlResponse.parse("https://foo")).toThrow();
  });
});

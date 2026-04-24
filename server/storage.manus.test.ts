import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Testes de integracao: exercem o fluxo real do storage com `fetch` stubado.
// Complementa os testes de contrato acima, pegando regressoes que a simples
// verificacao do schema isolado nao cobriria (ex.: alguem remover o
// `.parse(...)` mas manter o schema declarado).
describe("storage Manus (integracao via fetch stub)", () => {
  const ORIGINAL_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
  const ORIGINAL_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

  function restoreForgeEnv() {
    if (ORIGINAL_FORGE_API_URL === undefined) {
      delete process.env.BUILT_IN_FORGE_API_URL;
    } else {
      process.env.BUILT_IN_FORGE_API_URL = ORIGINAL_FORGE_API_URL;
    }
    if (ORIGINAL_FORGE_API_KEY === undefined) {
      delete process.env.BUILT_IN_FORGE_API_KEY;
    } else {
      process.env.BUILT_IN_FORGE_API_KEY = ORIGINAL_FORGE_API_KEY;
    }
  }

  async function importStorageFresh() {
    vi.resetModules();
    // Importa via caminho relativo pois `import` dentro do teste precisa ser
    // redirecionado apos `resetModules`.
    return import("./storage");
  }

  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.test";
    process.env.BUILT_IN_FORGE_API_KEY = "test-api-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreForgeEnv();
  });

  it("retorna a URL validada no upload quando Manus responde payload valido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://cdn.test/foto.png" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const { storagePut } = await importStorageFresh();
    await expect(
      storagePut("fotos/1/foto.png", Buffer.from("file"), "image/png")
    ).resolves.toEqual({
      key: "fotos/1/foto.png",
      url: "https://cdn.test/foto.png",
    });
  });

  it("rejeita com ZodError quando Manus responde payload sem url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "missing url" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const { storageGet } = await importStorageFresh();
    await expect(storageGet("fotos/1/foto.png")).rejects.toBeInstanceOf(
      z.ZodError
    );
  });
});

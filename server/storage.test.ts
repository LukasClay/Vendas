import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const ORIGINAL_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const ORIGINAL_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const ORIGINAL_S3_ENDPOINT = process.env.S3_ENDPOINT;
const ORIGINAL_S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const ORIGINAL_S3_BUCKET = process.env.S3_BUCKET;
const ORIGINAL_S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const ORIGINAL_S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const ORIGINAL_S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const ORIGINAL_S3_SECRET_KEY = process.env.S3_SECRET_KEY;

function restoreEnv() {
  setEnv("BUILT_IN_FORGE_API_URL", ORIGINAL_FORGE_API_URL);
  setEnv("BUILT_IN_FORGE_API_KEY", ORIGINAL_FORGE_API_KEY);
  setEnv("S3_ENDPOINT", ORIGINAL_S3_ENDPOINT);
  setEnv("S3_BUCKET_NAME", ORIGINAL_S3_BUCKET_NAME);
  setEnv("S3_BUCKET", ORIGINAL_S3_BUCKET);
  setEnv("S3_ACCESS_KEY_ID", ORIGINAL_S3_ACCESS_KEY_ID);
  setEnv("S3_ACCESS_KEY", ORIGINAL_S3_ACCESS_KEY);
  setEnv("S3_SECRET_ACCESS_KEY", ORIGINAL_S3_SECRET_ACCESS_KEY);
  setEnv("S3_SECRET_KEY", ORIGINAL_S3_SECRET_KEY);
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function importStorage() {
  vi.resetModules();
  return import("./storage");
}

describe("storage Manus proxy", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.test";
    process.env.BUILT_IN_FORGE_API_KEY = "test-api-key";
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  it("retorna a URL validada no upload via Manus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://cdn.test/foto.png" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const { storagePut } = await importStorage();

    await expect(
      storagePut("fotos/1/foto.png", Buffer.from("file"), "image/png")
    ).resolves.toEqual({
      key: "fotos/1/foto.png",
      url: "https://cdn.test/foto.png",
    });
  });

  it("rejeita payload Manus sem URL valida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "missing url" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const { storageGet } = await importStorage();

    await expect(storageGet("fotos/1/foto.png")).rejects.toBeInstanceOf(
      z.ZodError
    );
  });
});

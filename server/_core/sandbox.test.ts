import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSandboxDatabase,
  assertSandboxStorage,
  isSandboxMode,
} from "./sandbox";

const sandboxEnv = {
  VENDAS_SANDBOX_MODE: "1",
  VENDAS_SANDBOX_DATABASE_HOST: "postgres-copy.railway.internal",
  VENDAS_SANDBOX_STORAGE_BUCKET: "vendas-test-files",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sandbox resource isolation", () => {
  it("requires an explicit opt-in and preserves the existing production configuration", () => {
    expect(isSandboxMode({ NODE_ENV: "production" })).toBe(false);
    expect(() =>
      assertSandboxDatabase("existing-connection", {})
    ).not.toThrow();
    expect(() => assertSandboxStorage("existing-bucket", {})).not.toThrow();
  });

  it("accepts the configured clone and rejects a production connection without disclosing credentials", () => {
    expect(() =>
      assertSandboxDatabase(
        "postgresql://user:private-password@postgres-copy.railway.internal:5432/railway",
        sandboxEnv
      )
    ).not.toThrow();
    expect(() =>
      assertSandboxDatabase(
        "postgresql://user:private-password@postgres.railway.internal:5432/railway",
        sandboxEnv
      )
    ).toThrow("banco fora do host de teste");
  });

  it("fails closed when the expected database or storage is missing", () => {
    const incompleteEnv = { VENDAS_SANDBOX_MODE: "1" };
    expect(() =>
      assertSandboxDatabase("postgresql://localhost/test", incompleteEnv)
    ).toThrow("host exclusivo");
    expect(() =>
      assertSandboxStorage("production-files", incompleteEnv)
    ).toThrow("bucket exclusivo");
    expect(() =>
      assertSandboxStorage("production-files", sandboxEnv)
    ).toThrow();
    expect(() =>
      assertSandboxStorage("vendas-test-files", sandboxEnv)
    ).not.toThrow();
  });
});

describe("sandbox external sends", () => {
  it("blocks owner notifications even when real-looking integration credentials are configured", async () => {
    vi.stubEnv("VENDAS_SANDBOX_MODE", "1");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://notifications.example.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "test-integration-key");
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const { notifyOwner } = await import("./notification");
      expect(await notifyOwner({ title: "Test", content: "Test" })).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

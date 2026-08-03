import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { startConfiguredServer } from "./startup";

const SYNTHETIC_HASH = createHash("sha256")
  .update("s05-b-startup-test-only")
  .digest("hex");

describe("master password startup gate", () => {
  it.each([
    ["missing", undefined],
    ["invalid", "not-a-sha-256-hash"],
  ] as const)(
    "does not load the operational server when configuration is %s",
    (_, configuredHash) => {
      const loadServer = vi.fn(async () => {});

      expect(() => startConfiguredServer(configuredHash, loadServer)).toThrow(
        "MASTER_PASSWORD_HASH"
      );
      expect(loadServer).not.toHaveBeenCalled();
    }
  );

  it("loads the operational server only after valid configuration", async () => {
    const loadServer = vi.fn(async () => {});

    await expect(
      startConfiguredServer(SYNTHETIC_HASH, loadServer)
    ).resolves.toBeUndefined();
    expect(loadServer).toHaveBeenCalledOnce();
  });
});

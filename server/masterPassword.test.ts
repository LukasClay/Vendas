import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  assertMasterPasswordConfigured,
  parseMasterPasswordHash,
  verifyMasterPassword,
} from "./masterPassword";

const SYNTHETIC_PASSWORD = "s05-b-test-only-password";
const SYNTHETIC_HASH = createHash("sha256")
  .update(SYNTHETIC_PASSWORD)
  .digest("hex");

describe("master password configuration", () => {
  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["leading whitespace", ` ${SYNTHETIC_HASH}`],
    ["trailing whitespace", `${SYNTHETIC_HASH}\n`],
    ["too short", "a".repeat(63)],
    ["too long", "a".repeat(65)],
    ["non-hexadecimal", "g".repeat(64)],
  ] as const)("rejects a %s hash without exposing it", (_, configuredHash) => {
    let thrownError: unknown;

    try {
      parseMasterPasswordHash(configuredHash);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toContain("MASTER_PASSWORD_HASH");
    if (configuredHash) {
      expect((thrownError as Error).message).not.toContain(configuredHash);
    }
  });

  it("accepts lowercase and uppercase hexadecimal hashes as the same 32 bytes", () => {
    const expectedBytes = Buffer.from(SYNTHETIC_HASH, "hex");

    expect(parseMasterPasswordHash(SYNTHETIC_HASH)).toEqual(expectedBytes);
    expect(parseMasterPasswordHash(SYNTHETIC_HASH.toUpperCase())).toEqual(
      expectedBytes
    );
  });

  it("accepts the configured synthetic hash during startup validation", () => {
    expect(() => assertMasterPasswordConfigured(SYNTHETIC_HASH)).not.toThrow();
  });

  it("compares the decoded SHA-256 bytes in constant-length buffers", () => {
    expect(verifyMasterPassword(SYNTHETIC_PASSWORD, SYNTHETIC_HASH)).toBe(true);
    expect(verifyMasterPassword("incorrect", SYNTHETIC_HASH)).toBe(false);
    expect(
      verifyMasterPassword(SYNTHETIC_PASSWORD, SYNTHETIC_HASH.toUpperCase())
    ).toBe(true);
  });

  it("does not log the password or hash while validating and comparing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(verifyMasterPassword(SYNTHETIC_PASSWORD, SYNTHETIC_HASH)).toBe(
        true
      );
      expect(() => assertMasterPasswordConfigured("invalid")).toThrow();

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

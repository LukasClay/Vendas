import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import { assertMasterPasswordConfigured } from "./routers/security";

describe("assertMasterPasswordConfigured", () => {
  const original = process.env.MASTER_PASSWORD_HASH;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MASTER_PASSWORD_HASH;
    } else {
      process.env.MASTER_PASSWORD_HASH = original;
    }
  });

  it("lança erro quando MASTER_PASSWORD_HASH está ausente", () => {
    delete process.env.MASTER_PASSWORD_HASH;
    expect(() => assertMasterPasswordConfigured()).toThrow(
      /MASTER_PASSWORD_HASH/
    );
  });

  it("lança erro quando MASTER_PASSWORD_HASH é string vazia", () => {
    process.env.MASTER_PASSWORD_HASH = "";
    expect(() => assertMasterPasswordConfigured()).toThrow(
      /MASTER_PASSWORD_HASH/
    );
  });

  it("não lança quando MASTER_PASSWORD_HASH está definida", () => {
    process.env.MASTER_PASSWORD_HASH = crypto
      .createHash("sha256")
      .update("senha-qualquer")
      .digest("hex");
    expect(() => assertMasterPasswordConfigured()).not.toThrow();
  });
});

import { createHash, timingSafeEqual } from "node:crypto";

const MASTER_PASSWORD_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;
const INVALID_MASTER_PASSWORD_HASH_MESSAGE =
  "FATAL: MASTER_PASSWORD_HASH deve conter exatamente 64 caracteres hexadecimais (SHA-256).";

export function parseMasterPasswordHash(
  configuredHash: string | undefined
): Buffer {
  if (
    typeof configuredHash !== "string" ||
    !MASTER_PASSWORD_HASH_PATTERN.test(configuredHash)
  ) {
    throw new Error(INVALID_MASTER_PASSWORD_HASH_MESSAGE);
  }

  const decodedHash = Buffer.from(configuredHash, "hex");
  if (decodedHash.length !== 32) {
    throw new Error(INVALID_MASTER_PASSWORD_HASH_MESSAGE);
  }

  return decodedHash;
}

export function assertMasterPasswordConfigured(
  configuredHash: string | undefined
): void {
  parseMasterPasswordHash(configuredHash);
}

export function verifyMasterPassword(
  password: string,
  configuredHash: string | undefined
): boolean {
  const expectedHash = parseMasterPasswordHash(configuredHash);
  const receivedHash = createHash("sha256").update(password).digest();

  return timingSafeEqual(receivedHash, expectedHash);
}

import { defineConfig } from "vitest/config";
import path from "path";
import { createHash } from "node:crypto";

const templateRoot = path.resolve(import.meta.dirname);
const syntheticMasterPasswordHash = createHash("sha256")
  .update("vitest-only-master-password")
  .digest("hex");

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
      "shared/**/*.spec.ts",
    ],
    env: {
      // Fixture de teste; nunca usar credencial de outro ambiente.
      MASTER_PASSWORD_HASH: syntheticMasterPasswordHash,
      // JWT_SECRET mínimo de 32 chars para o ambiente de teste
      JWT_SECRET: "test-secret-key-for-vitest-minimum-32-chars-ok",
    },
  },
});

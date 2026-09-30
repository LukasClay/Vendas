/** Explicit isolation for the Railway test service. Production defaults stay unchanged. */
export function isSandboxMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VENDAS_SANDBOX_MODE === "1";
}

export function assertSandboxDatabase(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!isSandboxMode(env)) return;

  const expectedHost = env.VENDAS_SANDBOX_DATABASE_HOST?.trim();
  if (!expectedHost) {
    throw new Error("[Sandbox] Configure o host exclusivo do banco de teste.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("[Sandbox] A conexão do banco de teste é inválida.");
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.hostname !== expectedHost
  ) {
    throw new Error(
      "[Sandbox] Conexão bloqueada: banco fora do host de teste."
    );
  }
}

export function assertSandboxStorage(
  bucket: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!isSandboxMode(env)) return;

  const expectedBucket = env.VENDAS_SANDBOX_STORAGE_BUCKET?.trim();
  if (!expectedBucket || bucket !== expectedBucket) {
    throw new Error(
      "[Sandbox] Storage bloqueado: configure o bucket exclusivo de teste."
    );
  }
}

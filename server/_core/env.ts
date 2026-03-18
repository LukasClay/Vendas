export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error(
        "FATAL: JWT_SECRET não definido ou muito curto (mínimo 16 caracteres). " +
        "Defina a variável de ambiente antes de iniciar o servidor."
      );
    }
    return secret;
  })(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

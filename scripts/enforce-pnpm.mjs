const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.includes("pnpm/")) {
  console.error("This repository is standardized on pnpm.");
  console.error("Use `pnpm install` instead of npm/yarn.");
  process.exit(1);
}

export type LocalLoginHealth =
  | "ok"
  | "missing_username"
  | "missing_password_hash"
  | "inactive"
  | "deleted";

export interface LocalLoginHealthInput {
  active: boolean;
  deletedAt: Date | string | null | undefined;
  username: string | null | undefined;
  passwordHash: string | null | undefined;
}

export interface LocalLoginHealthResult {
  canUseLocalLogin: boolean;
  localLoginHealth: LocalLoginHealth;
  localLoginMessage: string;
}

const HEALTH_MESSAGES: Record<LocalLoginHealth, string> = {
  ok: "Login local disponível.",
  missing_username: "Conta ativa sem nome de usuário. Edite o funcionário.",
  missing_password_hash: 'Conta ativa sem senha local. Use "Redefinir senha".',
  inactive: "Conta desativada.",
  deleted: "Conta excluída.",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function getLocalLoginHealth(
  input: LocalLoginHealthInput
): LocalLoginHealthResult {
  let localLoginHealth: LocalLoginHealth;

  if (input.deletedAt) {
    localLoginHealth = "deleted";
  } else if (!input.active) {
    localLoginHealth = "inactive";
  } else if (!hasText(input.username)) {
    localLoginHealth = "missing_username";
  } else if (!hasText(input.passwordHash)) {
    localLoginHealth = "missing_password_hash";
  } else {
    localLoginHealth = "ok";
  }

  return {
    canUseLocalLogin: localLoginHealth === "ok",
    localLoginHealth,
    localLoginMessage: HEALTH_MESSAGES[localLoginHealth],
  };
}

import { describe, expect, it } from "vitest";
import { getLocalLoginHealth } from "./_core/localLoginHealth";

describe("getLocalLoginHealth", () => {
  it("returns ok for active user with username and passwordHash", () => {
    const result = getLocalLoginHealth({
      active: true,
      deletedAt: null,
      username: "maria",
      passwordHash: "hash",
    });

    expect(result).toEqual({
      canUseLocalLogin: true,
      localLoginHealth: "ok",
      localLoginMessage: "Login local disponível.",
    });
  });

  it("returns missing_username for active user without username", () => {
    const result = getLocalLoginHealth({
      active: true,
      deletedAt: null,
      username: "   ",
      passwordHash: "hash",
    });

    expect(result).toEqual({
      canUseLocalLogin: false,
      localLoginHealth: "missing_username",
      localLoginMessage:
        "Conta ativa sem nome de usuário. Edite o funcionário.",
    });
  });

  it("returns missing_password_hash for active user without passwordHash", () => {
    const result = getLocalLoginHealth({
      active: true,
      deletedAt: null,
      username: "maria",
      passwordHash: null,
    });

    expect(result).toEqual({
      canUseLocalLogin: false,
      localLoginHealth: "missing_password_hash",
      localLoginMessage: 'Conta ativa sem senha local. Use "Redefinir senha".',
    });
  });

  it("returns inactive for inactive user", () => {
    const result = getLocalLoginHealth({
      active: false,
      deletedAt: null,
      username: "maria",
      passwordHash: "hash",
    });

    expect(result).toEqual({
      canUseLocalLogin: false,
      localLoginHealth: "inactive",
      localLoginMessage: "Conta desativada.",
    });
  });

  it("returns deleted for deleted user", () => {
    const result = getLocalLoginHealth({
      active: true,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      username: "maria",
      passwordHash: "hash",
    });

    expect(result).toEqual({
      canUseLocalLogin: false,
      localLoginHealth: "deleted",
      localLoginMessage: "Conta excluída.",
    });
  });

  it("applies precedence deleted before inactive and missing fields", () => {
    const result = getLocalLoginHealth({
      active: false,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      username: "",
      passwordHash: null,
    });

    expect(result).toEqual({
      canUseLocalLogin: false,
      localLoginHealth: "deleted",
      localLoginMessage: "Conta excluída.",
    });
  });
});

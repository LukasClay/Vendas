import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getSessionCookieFromRequest: vi.fn(),
}));

vi.mock("./sdk", () => ({
  sdk: {
    authenticateRequest: mocks.authenticateRequest,
    getSessionCookieFromRequest: mocks.getSessionCookieFromRequest,
  },
}));

const { createContext } = await import("./context");

describe("createContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionCookieFromRequest.mockReturnValue(null);
    mocks.authenticateRequest.mockResolvedValue(null);
  });

  it("não tenta autenticar quando a request não traz cookie de sessão", async () => {
    const ctx = await createContext({
      req: {
        headers: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: {} as any,
    });

    expect(mocks.getSessionCookieFromRequest).toHaveBeenCalledTimes(1);
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
    expect(ctx.user).toBeNull();
  });

  it("autentica quando há cookie de sessão", async () => {
    const user = { id: 1, role: "admin" };
    mocks.getSessionCookieFromRequest.mockReturnValue("session-token");
    mocks.authenticateRequest.mockResolvedValue(user);

    const ctx = await createContext({
      req: {
        headers: { cookie: "app_session_id=session-token" },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: {} as any,
    });

    expect(mocks.authenticateRequest).toHaveBeenCalledWith(
      expect.anything(),
      "session-token",
    );
    expect(ctx.user).toBe(user);
  });

  it("mantém autenticação opcional quando o cookie é inválido", async () => {
    mocks.getSessionCookieFromRequest.mockReturnValue("invalid-token");
    mocks.authenticateRequest.mockRejectedValue(new Error("invalid session"));

    const ctx = await createContext({
      req: {
        headers: { cookie: "app_session_id=invalid-token" },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: {} as any,
    });

    expect(mocks.authenticateRequest).toHaveBeenCalledTimes(1);
    expect(ctx.user).toBeNull();
  });
});

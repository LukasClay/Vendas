import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: mocks.send,
    };
  },
}));

const originalApiKey = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = "re_test";

const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const { sendEmail } = await import("./email");

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({
      data: { id: "email-test-id" },
      error: null,
    });
  });

  afterAll(() => {
    consoleLog.mockRestore();
    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  it("mantem compatibilidade quando nenhuma chave idempotente e informada", async () => {
    await expect(
      sendEmail({
        to: "destinatario@example.com",
        subject: "Assunto",
        html: "<p>Conteudo</p>",
      })
    ).resolves.toBe(true);

    expect(mocks.send).toHaveBeenCalledWith(
      {
        from: "Mundo Da Magia <onboarding@resend.dev>",
        to: ["destinatario@example.com"],
        subject: "Assunto",
        html: "<p>Conteudo</p>",
      },
      undefined
    );
  });

  it("encaminha a chave idempotente como opcao do SDK", async () => {
    await expect(
      sendEmail({
        to: "destinatario@example.com",
        subject: "Assunto",
        html: "<p>Conteudo</p>",
        idempotencyKey: "scheduled-report/7/2026-07-29",
      })
    ).resolves.toBe(true);

    expect(mocks.send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "scheduled-report/7/2026-07-29",
    });
  });
});

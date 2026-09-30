import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  resendConstructor: vi.fn(),
  sendEmail: vi.fn(),
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.sendEmail };
    constructor(key: string) {
      mocks.resendConstructor(key);
    }
  },
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-email-key");
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sandbox email and push isolation", () => {
  it("does not configure providers or read copied subscriptions when sends are blocked", async () => {
    vi.stubEnv("VENDAS_SANDBOX_MODE", "1");
    const email = await import("../email");
    const push = await import("../webpush");

    expect(email.isEmailConfigured()).toBe(false);
    expect(
      await email.sendEmail({
        to: "test@example.test",
        subject: "Test",
        html: "Test",
      })
    ).toBe(false);
    await push.sendPushToUser(1, { title: "Test", body: "Test" });
    await push.sendPushToRoles(["admin", "consultora"], {
      title: "Test",
      body: "Test",
    });

    expect(mocks.resendConstructor).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.setVapidDetails).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("preserves provider configuration and email sending when sandbox mode is off", async () => {
    vi.stubEnv("VENDAS_SANDBOX_MODE", "0");
    mocks.sendEmail.mockResolvedValue({
      data: { id: "test-email" },
      error: null,
    });
    const email = await import("../email");
    await import("../webpush");

    expect(email.isEmailConfigured()).toBe(true);
    expect(
      await email.sendEmail({
        to: "test@example.test",
        subject: "Test",
        html: "Test",
      })
    ).toBe(true);
    expect(mocks.resendConstructor).toHaveBeenCalledWith("test-email-key");
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.setVapidDetails).toHaveBeenCalledOnce();
  });
});

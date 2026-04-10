import { describe, expect, it, vi, afterEach } from "vitest";
import type { Request } from "express";
import {
  classifyKnownHttpError,
  formatHttpRequestContext,
  logKnownHttpError,
} from "./httpRequestErrors";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    originalUrl: "/api/trpc/sales.create",
    url: "/api/trpc/sales.create",
    ip: "127.0.0.1",
    headers: {
      "content-type": "application/json",
      "user-agent": "Vitest Browser",
    },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as Request;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("classifyKnownHttpError", () => {
  it("classifica request aborted", () => {
    expect(
      classifyKnownHttpError({
        type: "request.aborted",
        message: "request aborted",
      }),
    ).toMatchObject({
      kind: "request_aborted",
      status: 400,
    });
  });

  it("classifica entity too large", () => {
    expect(
      classifyKnownHttpError({
        type: "entity.too.large",
      }),
    ).toMatchObject({
      kind: "entity_too_large",
      status: 413,
    });
  });

  it("ignora erros desconhecidos", () => {
    expect(classifyKnownHttpError(new Error("boom"))).toBeNull();
  });
});

describe("formatHttpRequestContext", () => {
  it("inclui contexto útil da request em uma linha curta", () => {
    const summary = formatHttpRequestContext(createRequest());

    expect(summary).toContain("method=POST");
    expect(summary).toContain("path=/api/trpc/sales.create");
    expect(summary).toContain('contentType="application/json"');
    expect(summary).toContain('userAgent="Vitest Browser"');
    expect(summary).toContain("uptime=");
  });
});

describe("logKnownHttpError", () => {
  it("loga request aborted sem stack trace", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = logKnownHttpError(
      createRequest(),
      { type: "request.aborted", message: "request aborted" },
    );

    expect(result).toMatchObject({ kind: "request_aborted", status: 400 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("[HTTP] Request aborted");
    expect(warn.mock.calls[0]?.[0]).toContain("method=POST");
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = {
    query: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    release: vi.fn(),
  };
  return {
    client,
    connect: vi.fn(async () => client),
  };
});

vi.mock("pg", () => ({
  Pool: class {
    connect = mocks.connect;
  },
}));

const originalRailwayDatabaseUrl = process.env.RAILWAY_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.RAILWAY_DATABASE_URL;
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { tryAcquireSessionAdvisoryLock } = await import("./db");

let errorListener: ((error: Error) => void) | null = null;
let endListener: (() => void) | null = null;

describe("tryAcquireSessionAdvisoryLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorListener = null;
    endListener = null;
    mocks.connect.mockResolvedValue(mocks.client);
    mocks.client.on.mockImplementation((event, listener) => {
      if (event === "error") {
        errorListener = listener as (error: Error) => void;
      } else if (event === "end") {
        endListener = listener as () => void;
      }
      return mocks.client;
    });
    mocks.client.removeListener.mockReturnValue(mocks.client);
  });

  afterAll(() => {
    if (originalRailwayDatabaseUrl === undefined) {
      delete process.env.RAILWAY_DATABASE_URL;
    } else {
      process.env.RAILWAY_DATABASE_URL = originalRailwayDatabaseUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("devolve a conexão ao pool quando outra réplica já possui o lock", async () => {
    mocks.client.query.mockResolvedValueOnce({
      rows: [{ acquired: false }],
    });

    await expect(
      tryAcquireSessionAdvisoryLock("jobs:test")
    ).resolves.toBeNull();

    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.client.release).toHaveBeenCalledWith(false);
    expect(mocks.client.removeListener).toHaveBeenCalledWith(
      "error",
      expect.any(Function)
    );
    expect(mocks.client.removeListener).toHaveBeenCalledWith(
      "end",
      expect.any(Function)
    );
    expect(mocks.client.query).toHaveBeenCalledWith(
      expect.objectContaining({ query_timeout: 5_000 })
    );
  });

  it("mantém heartbeat e unlock na mesma conexão dedicada", async () => {
    mocks.client.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ one: 1 }] })
      .mockResolvedValueOnce({ rows: [{ released: true }] });

    const lock = await tryAcquireSessionAdvisoryLock("jobs:test");
    expect(lock).not.toBeNull();

    await lock!.heartbeat();
    await lock!.release();
    await lock!.release();

    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.client.query).toHaveBeenCalledTimes(3);
    expect(mocks.client.release).toHaveBeenCalledOnce();
    expect(mocks.client.release).toHaveBeenCalledWith(false);
  });

  it("descarta a conexão quando ela informa perda durante a liderança", async () => {
    mocks.client.query.mockResolvedValueOnce({
      rows: [{ acquired: true }],
    });
    const lock = await tryAcquireSessionAdvisoryLock("jobs:test");
    const connectionError = new Error("connection lost");
    const onLost = vi.fn();
    const unsubscribe = lock!.onLost(onLost);

    expect(errorListener).not.toBeNull();
    errorListener!(connectionError);

    expect(onLost).toHaveBeenCalledOnce();
    expect(onLost).toHaveBeenCalledWith(connectionError);
    unsubscribe();

    await expect(lock!.heartbeat()).rejects.toBe(connectionError);
    await expect(lock!.release()).resolves.toBeUndefined();
    expect(mocks.client.release).toHaveBeenCalledWith(true);
  });

  it("notifica e descarta a conexao quando um heartbeat expira", async () => {
    const timeoutError = new Error("Query read timeout");
    mocks.client.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockRejectedValueOnce(timeoutError);

    const lock = await tryAcquireSessionAdvisoryLock("jobs:test");
    const onLost = vi.fn();
    lock!.onLost(onLost);

    await expect(lock!.heartbeat()).rejects.toBe(timeoutError);
    expect(onLost).toHaveBeenCalledWith(timeoutError);

    await expect(lock!.release()).resolves.toBeUndefined();
    expect(mocks.client.release).toHaveBeenCalledWith(true);
  });

  it("detecta encerramento da conexao sem aguardar o heartbeat", async () => {
    mocks.client.query.mockResolvedValueOnce({
      rows: [{ acquired: true }],
    });

    const lock = await tryAcquireSessionAdvisoryLock("jobs:test");
    const onLost = vi.fn();
    lock!.onLost(onLost);

    expect(endListener).not.toBeNull();
    endListener!();
    expect(onLost).toHaveBeenCalledOnce();

    await expect(lock!.release()).resolves.toBeUndefined();
    expect(mocks.client.release).toHaveBeenCalledWith(true);
  });

  it("descarta a conexão se o PostgreSQL não confirmar o unlock", async () => {
    mocks.client.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ released: false }] });

    const lock = await tryAcquireSessionAdvisoryLock("jobs:test");

    await expect(lock!.release()).rejects.toThrow(
      "PostgreSQL advisory lock was not owned"
    );
    expect(mocks.client.release).toHaveBeenCalledWith(true);
  });
});

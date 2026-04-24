import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  cleanupExpiredTrash: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
    cleanupExpiredTrash: mocks.cleanupExpiredTrash,
  };
});

const { runCleanupTrashJob } = await import("./jobs/cleanupJob");

function createDbMock(locked: boolean) {
  return {
    execute: vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked }] })
      .mockResolvedValueOnce({ rows: [{ unlocked: true }] }),
  };
}

describe("cleanupJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLEANUP_TRASH_DRY_RUN;
    mocks.cleanupExpiredTrash.mockResolvedValue({
      dryRun: true,
      expiredCount: 2,
      deletedCount: 0,
      storageObjectCount: 3,
    });
  });

  it("executa cleanup em dry-run por padrao com lock adquirido", async () => {
    const db = createDbMock(true);
    mocks.getDb.mockResolvedValue(db);

    const result = await runCleanupTrashJob();

    expect(mocks.cleanupExpiredTrash).toHaveBeenCalledWith(30, {
      dryRun: true,
    });
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      skipped: false,
      dryRun: true,
      expiredCount: 2,
      deletedCount: 0,
      storageObjectCount: 3,
    });
  });

  it("nao executa cleanup quando outra instancia segura o lock", async () => {
    const db = createDbMock(false);
    mocks.getDb.mockResolvedValue(db);

    await expect(runCleanupTrashJob()).resolves.toEqual({
      skipped: true,
      reason: "lock_unavailable",
    });
    expect(mocks.cleanupExpiredTrash).not.toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});

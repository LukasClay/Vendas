import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";
import {
  buildAdminClientHistoryQuery,
  ClientAdminConflictError,
  buildDuplicateGroups,
  type ClientAdminDatabase,
  updateAdminClientWithDb,
} from "./clientAdmin";

const now = new Date("2026-07-22T12:00:00.000Z");

function row(
  id: number,
  fullName: string,
  birthDate: string | null,
  phone: string | null,
  salesCount: number | string = 0
) {
  return {
    id,
    fullName,
    birthDate,
    phone,
    updatedAt: now,
    salesCount,
    lastSaleDate: null,
  };
}

describe("buildAdminClientHistoryQuery", () => {
  it("filters history strictly by clientId and ignores deleted sales", () => {
    const db = drizzle.mock();
    const query = buildAdminClientHistoryQuery(
      db as unknown as ClientAdminDatabase,
      42
    ).toSQL();
    const statement = query.sql.replace(/\s+/g, " ");

    expect(statement).toContain('"sales"."clientId" = $1');
    expect(statement).toContain('"sales"."deletedAt" is null');
    expect(statement).not.toContain('"sales"."clientName" =');
    expect(query.params).toContain(42);
    expect(query.params).toContain(100);
  });
});

describe("buildDuplicateGroups", () => {
  it("normalizes phone, name and birth date and combines criteria", () => {
    const groups = buildDuplicateGroups([
      row(1, "Maria da Silva", "1990-05-20", "+55 (11) 99999-8888", "2"),
      row(2, "  MARIA   DA SILVA ", "1990-05-20", "11999998888", 1),
      row(3, "No duplicate", null, null),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      criterion: "phone_and_name_birth_date",
      score: 100,
    });
    expect(groups[0].candidates.map(candidate => candidate.id)).toEqual([1, 2]);
    expect(groups[0].candidates[0].salesCount).toBe(2);
  });

  it("does not use name alone without a birth date", () => {
    expect(
      buildDuplicateGroups([
        row(1, "Ana", null, null),
        row(2, " ana ", null, null),
      ])
    ).toEqual([]);
  });

  it("detects isolated phone or name and birth-date criteria", () => {
    const groups = buildDuplicateGroups([
      row(1, "A", "1990-01-01", "11911112222"),
      row(2, "B", "1991-01-01", "+55 11 91111-2222"),
      row(3, "Carla Souza", "1980-02-03", "11933334444"),
      row(4, " carla  souza ", "1980-02-03", "11955556666"),
    ]);

    expect(groups.map(group => group.criterion).sort()).toEqual([
      "name_birth_date",
      "phone",
    ]);
  });

  it("keeps overlapping phone and identity matches in separate groups", () => {
    const groups = buildDuplicateGroups([
      row(1, "Ana Lima", "1990-01-01", "11911112222"),
      row(2, "Bruna Souza", "1991-02-02", "11911112222"),
      row(3, " bruna  souza ", "1991-02-02", "11933334444"),
    ]);

    expect(
      groups.map(group => ({
        criterion: group.criterion,
        ids: group.candidates.map(candidate => candidate.id),
      }))
    ).toEqual([
      { criterion: "phone", ids: [1, 2] },
      { criterion: "name_birth_date", ids: [2, 3] },
    ]);
  });
});
interface CanonicalClientRow {
  id: number;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createEditDatabase(
  current: CanonicalClientRow,
  returned: CanonicalClientRow[]
) {
  const limit = vi.fn().mockResolvedValue([current]);
  const returning = vi.fn().mockResolvedValue(returned);
  const set = vi.fn(() => ({
    where: vi.fn(() => ({ returning })),
  }));
  const update = vi.fn(() => ({ set }));
  const auditValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: auditValues }));
  const execute = vi.fn().mockResolvedValue({ rows: [{ id: current.id }] });
  const transaction = {
    execute,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit })),
      })),
    })),
    update,
    insert,
  };
  const database = {
    transaction: vi.fn(
      async (
        callback: (transactionValue: typeof transaction) => Promise<unknown>
      ) => callback(transaction)
    ),
  } as unknown as ClientAdminDatabase;

  return { database, execute, set, update, auditValues };
}

describe("updateAdminClientWithDb", () => {
  it("updates only the canonical client and audits in the same transaction", async () => {
    const current: CanonicalClientRow = {
      id: 3,
      fullName: "Maria",
      birthDate: "1990-05-20",
      phone: "11999998888",
      createdAt: now,
      updatedAt: now,
    };
    const updated = {
      ...current,
      fullName: "Maria Silva",
      updatedAt: new Date(now.getTime() + 1),
    };
    const mocks = createEditDatabase(current, [updated]);

    await expect(
      updateAdminClientWithDb(
        mocks.database,
        {
          id: 3,
          fullName: "  Maria  Silva ",
          birthDate: "1990-05-20",
          phone: "+55 11 99999-8888",
          expectedUpdatedAt: now.toISOString(),
        },
        { userId: 7, userName: "Admin" }
      )
    ).resolves.toEqual(updated);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Maria Silva",
        phone: "11999998888",
        updatedAt: expect.any(Date),
      })
    );
    expect(mocks.auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Editou Cliente",
        userId: 7,
      })
    );
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it("rejects a stale version before update and audit", async () => {
    const current: CanonicalClientRow = {
      id: 3,
      fullName: "Maria",
      birthDate: null,
      phone: null,
      createdAt: now,
      updatedAt: now,
    };
    const mocks = createEditDatabase(current, []);

    await expect(
      updateAdminClientWithDb(
        mocks.database,
        {
          id: 3,
          fullName: "Nova",
          birthDate: null,
          phone: null,
          expectedUpdatedAt: "2026-07-21T12:00:00.000Z",
        },
        { userId: 7, userName: "Admin" }
      )
    ).rejects.toBeInstanceOf(ClientAdminConflictError);

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditValues).not.toHaveBeenCalled();
  });
});

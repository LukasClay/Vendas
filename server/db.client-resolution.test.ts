import { describe, expect, it, vi } from "vitest";
import {
  ConsultationSlotUnavailableError,
  createSaleWithResolvedClientWithDb,
  resolveClientForSaleWithDb,
  type ClientResolutionDatabase,
  type ResolvedClient,
} from "./db";
import {
  ClientIdentityConflictError,
  ClientNotFoundError,
} from "./clientIdentity";

const adminActor = { id: 1, role: "admin" } as const;

function createDbMock(options?: {
  selected?: ResolvedClient[];
  selectedSequence?: ResolvedClient[][];
  updated?: ResolvedClient[];
  inserted?: ResolvedClient;
}) {
  const selectLimit = vi.fn();
  if (options?.selectedSequence?.length) {
    for (const result of options.selectedSequence) {
      selectLimit.mockResolvedValueOnce(result);
    }
    selectLimit.mockResolvedValue(
      options.selectedSequence[options.selectedSequence.length - 1]
    );
  } else {
    selectLimit.mockResolvedValue(options?.selected ?? []);
  }
  const orderBy = vi.fn((_order: unknown) => ({ limit: selectLimit }));
  const selectWhere = vi.fn((_condition: unknown) => ({
    limit: selectLimit,
    orderBy,
  }));
  const from = vi.fn((_table: unknown) => ({ where: selectWhere }));
  const select = vi.fn((_projection: unknown) => ({ from }));

  const updateReturning = vi
    .fn((_projection: unknown) => undefined)
    .mockResolvedValue(options?.updated ?? []);
  const updateWhere = vi.fn((_condition: unknown) => ({
    returning: updateReturning,
  }));
  const set = vi.fn((_values: unknown) => ({ where: updateWhere }));
  const update = vi.fn((_table: unknown) => ({ set }));
  const returning = vi
    .fn((_projection: unknown) => undefined)
    .mockResolvedValue(options?.inserted ? [options.inserted] : []);
  const values = vi.fn((_values: unknown) => ({ returning }));
  const insert = vi.fn((_table: unknown) => ({ values }));

  return {
    db: { select, update, insert } as unknown as ClientResolutionDatabase,
    spies: {
      select,
      updateReturning,
      selectLimit,
      orderBy,
      update,
      set,
      insert,
      values,
    },
  };
}

describe("resolveClientForSaleWithDb", () => {
  const maria: ResolvedClient = {
    id: 3,
    fullName: "Maria da Silva",
    birthDate: "1990-05-20",
    phone: "11999998888",
  };

  it("returns typed NOT_FOUND for an authorized but nonexistent id", async () => {
    const database = createDbMock({ selected: [] });

    try {
      await resolveClientForSaleWithDb(
        database.db,
        {
          clientId: 404,
          fullName: "Cliente inexistente",
          birthDate: "1990-05-20",
          phone: "11999998888",
        },
        adminActor
      );
      expect.fail("expected ClientNotFoundError");
    } catch (error) {
      expect(error).toBeInstanceOf(ClientNotFoundError);
      expect(error).toMatchObject({ code: "NOT_FOUND", clientId: 404 });
    }

    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).not.toHaveBeenCalled();
  });

  it("reuses a compatible id without issuing UPDATE", async () => {
    const database = createDbMock({ selected: [maria] });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          clientId: maria.id,
          fullName: "  MARIA   DA SILVA ",
          birthDate: "1990-05-20T12:00:00.000Z",
          phone: "+55 (11) 99999-8888",
        },
        adminActor
      )
    ).resolves.toEqual(maria);

    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).not.toHaveBeenCalled();
  });

  it("rejects a divergent id without updating the canonical client", async () => {
    const database = createDbMock({ selected: [maria] });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          clientId: maria.id,
          fullName: "Joana da Silva",
          birthDate: maria.birthDate,
          phone: maria.phone,
        },
        adminActor
      )
    ).rejects.toMatchObject({ code: "CONFLICT", fields: ["fullName"] });

    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).not.toHaveBeenCalled();
  });

  it("enriches only null canonical fields and never writes the name", async () => {
    const database = createDbMock({
      selected: [{ ...maria, birthDate: null, phone: null }],
      updated: [maria],
    });

    const resolved = await resolveClientForSaleWithDb(
      database.db,
      {
        clientId: maria.id,
        fullName: maria.fullName,
        birthDate: "1990-05-20T12:00:00.000Z",
        phone: "+55 (11) 99999-8888",
      },
      adminActor
    );

    expect(database.spies.set).toHaveBeenCalledOnce();
    expect(database.spies.set).toHaveBeenCalledWith({
      birthDate: "1990-05-20",
      phone: "11999998888",
    });
    expect(database.spies.set.mock.calls[0]?.[0]).not.toHaveProperty(
      "fullName"
    );
    expect(resolved).toEqual(maria);
  });

  it("does not overwrite a concurrent enrichment and reloads the winner", async () => {
    const withoutBirthDate = { ...maria, birthDate: null };
    const database = createDbMock({
      selectedSequence: [[withoutBirthDate], [maria]],
      updated: [],
    });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          clientId: maria.id,
          fullName: maria.fullName,
          birthDate: maria.birthDate,
          phone: maria.phone,
        },
        adminActor
      )
    ).resolves.toEqual(maria);

    expect(database.spies.updateReturning).toHaveBeenCalledOnce();
    expect(database.spies.set).toHaveBeenCalledWith({
      birthDate: maria.birthDate,
    });
  });
  it("reuses a compatible client found by normalized phone without an id", async () => {
    const database = createDbMock({ selected: [maria] });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          fullName: "maria da silva",
          birthDate: maria.birthDate,
          phone: "+55 (11) 99999-8888",
        },
        adminActor
      )
    ).resolves.toEqual(maria);

    expect(database.spies.orderBy).toHaveBeenCalledOnce();
    expect(database.spies.selectLimit).toHaveBeenCalledWith(20);
    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).not.toHaveBeenCalled();
  });

  it("rejects Maria/Joana sharing a phone without UPDATE or INSERT", async () => {
    const database = createDbMock({ selected: [maria] });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          fullName: "Joana da Silva",
          birthDate: maria.birthDate,
          phone: "+55 (11) 99999-8888",
        },
        adminActor
      )
    ).rejects.toBeInstanceOf(ClientIdentityConflictError);

    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).not.toHaveBeenCalled();
  });

  it("builds seller scope before matching a phone without clientId", async () => {
    const inserted: ResolvedClient = {
      id: 10,
      fullName: "Cliente da carteira",
      birthDate: "1993-07-16",
      phone: "11977776666",
    };
    const database = createDbMock({ selected: [], inserted });

    await resolveClientForSaleWithDb(
      database.db,
      {
        fullName: inserted.fullName,
        birthDate: inserted.birthDate,
        phone: inserted.phone,
      },
      { id: 42, role: "user" }
    );

    expect(database.spies.select).toHaveBeenCalledTimes(2);
    expect(database.spies.insert).toHaveBeenCalledOnce();
  });
  it("normalizes and inserts a genuinely new client", async () => {
    const inserted: ResolvedClient = {
      id: 9,
      fullName: "Joana da Silva",
      birthDate: "1992-06-15",
      phone: "11988887777",
    };
    const database = createDbMock({ selected: [], inserted });

    await expect(
      resolveClientForSaleWithDb(
        database.db,
        {
          fullName: "  Joana   da Silva  ",
          birthDate: "1992-06-15T18:00:00.000Z",
          phone: "+55 (11) 98888-7777",
        },
        adminActor
      )
    ).resolves.toEqual(inserted);

    expect(database.spies.values).toHaveBeenCalledWith({
      fullName: "Joana da Silva",
      birthDate: "1992-06-15",
      phone: "11988887777",
    });
    expect(database.spies.update).not.toHaveBeenCalled();
    expect(database.spies.insert).toHaveBeenCalledOnce();
  });
});
function createTransactionalDbMock(options?: {
  slotAvailable?: boolean;
  auditFailure?: boolean;
}) {
  const client: ResolvedClient = {
    id: 3,
    fullName: "Maria da Silva",
    birthDate: "1990-05-20",
    phone: "11999998888",
  };

  const clientLimit = vi.fn().mockResolvedValue([client]);
  const clientOrderBy = vi.fn((_order: unknown) => ({ limit: clientLimit }));
  const clientWhere = vi.fn((_condition: unknown) => ({
    limit: clientLimit,
    orderBy: clientOrderBy,
  }));
  const clientFrom = vi.fn((_table: unknown) => ({ where: clientWhere }));
  const select = vi.fn((_projection: unknown) => ({ from: clientFrom }));

  const saleReturning = vi.fn().mockResolvedValue([{ id: 77 }]);
  const saleValues = vi.fn((_values: unknown) => ({
    returning: saleReturning,
  }));
  const auditValues = vi.fn(async (_values: unknown) => {
    if (options?.auditFailure) {
      throw new Error("audit unavailable");
    }
  });
  const insert = vi
    .fn()
    .mockImplementationOnce((_table: unknown) => ({ values: saleValues }))
    .mockImplementation((_table: unknown) => ({ values: auditValues }));

  const slotReturning = vi
    .fn()
    .mockResolvedValue(options?.slotAvailable === false ? [] : [{ id: 9 }]);
  const slotWhere = vi.fn((_condition: unknown) => ({
    returning: slotReturning,
  }));
  const slotSet = vi.fn((_values: unknown) => ({ where: slotWhere }));
  const update = vi.fn((_table: unknown) => ({ set: slotSet }));
  const execute = vi.fn().mockResolvedValue(undefined);

  const transactionDb = { select, insert, update, execute };
  const transaction = vi.fn(
    async (callback: (tx: typeof transactionDb) => Promise<unknown>) =>
      callback(transactionDb)
  );

  return {
    client,
    db: { transaction } as unknown as ClientResolutionDatabase,
    spies: {
      transaction,
      saleValues,
      auditValues,
      insert,
      slotSet,
      slotReturning,
      execute,
    },
  };
}

function createTransactionalInput(clientName = "Maria da Silva") {
  return {
    client: {
      clientId: 3,
      fullName: clientName,
      birthDate: "1990-05-20",
      phone: "11999998888",
    },
    actor: { id: 1, role: "admin" } as const,
    audit: {
      userId: 1,
      userName: "Admin",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    },
    sale: {
      sellerId: 1,
      sellerName: "Admin",
      productName: "Trabalho Individual",
      productCategory: "individual" as const,
      saleDate: "2026-07-21",
      amount: "100",
    },
    consultationSlotId: 9,
  };
}

describe("createSaleWithResolvedClientWithDb", () => {
  it("persists canonical snapshot and reserves the slot in one transaction", async () => {
    const database = createTransactionalDbMock();

    await expect(
      createSaleWithResolvedClientWithDb(
        database.db,
        createTransactionalInput(),
        "mundo_da_magia"
      )
    ).resolves.toEqual({ saleId: 77, client: database.client });

    expect(database.spies.transaction).toHaveBeenCalledOnce();
    expect(database.spies.saleValues).toHaveBeenCalledWith(
      expect.objectContaining({
        company: "mundo_da_magia",
        clientId: database.client.id,
        clientName: database.client.fullName,
        clientBirthDate: database.client.birthDate,
        clientPhone: database.client.phone,
      })
    );
    expect(database.spies.auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        userName: "Admin",
        action: "Criou Venda",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      })
    );
    expect(database.spies.insert).toHaveBeenCalledTimes(2);

    expect(database.spies.slotSet).toHaveBeenCalledWith({
      sold: true,
      saleId: 77,
    });
  });

  it("throws inside the transaction when the slot was concurrently taken", async () => {
    const database = createTransactionalDbMock({ slotAvailable: false });

    await expect(
      createSaleWithResolvedClientWithDb(
        database.db,
        createTransactionalInput(),
        "mundo_da_magia"
      )
    ).rejects.toBeInstanceOf(ConsultationSlotUnavailableError);

    expect(database.spies.insert).toHaveBeenCalledOnce();
    expect(database.spies.slotReturning).toHaveBeenCalledOnce();
  });

  it("fails inside the transaction when the audit insert fails", async () => {
    const database = createTransactionalDbMock({ auditFailure: true });

    await expect(
      createSaleWithResolvedClientWithDb(
        database.db,
        createTransactionalInput(),
        "mundo_da_magia"
      )
    ).rejects.toThrow("audit unavailable");

    expect(database.spies.auditValues).toHaveBeenCalledOnce();
  });

  it("serializes phone lookup without clientId through an advisory lock", async () => {
    const database = createTransactionalDbMock();
    const original = createTransactionalInput();
    const input = {
      ...original,
      client: {
        ...original.client,
        clientId: undefined,
      },
    };

    await createSaleWithResolvedClientWithDb(
      database.db,
      input,
      "mundo_da_magia"
    );

    expect(database.spies.execute).toHaveBeenCalledOnce();
  });

  it("rejects identity conflict before inserting a sale", async () => {
    const database = createTransactionalDbMock();

    await expect(
      createSaleWithResolvedClientWithDb(
        database.db,
        createTransactionalInput("Joana da Silva"),
        "mundo_da_magia"
      )
    ).rejects.toBeInstanceOf(ClientIdentityConflictError);

    expect(database.spies.insert).not.toHaveBeenCalled();
    expect(database.spies.slotSet).not.toHaveBeenCalled();
  });
});

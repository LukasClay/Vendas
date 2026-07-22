import { describe, expect, it } from "vitest";
import {
  applyClientAutofill,
  editAutofilledClientDetails,
  editAutofilledClientName,
  type ClientAutofillFields,
} from "../client/src/lib/clientAutofill";

type TestForm = ClientAutofillFields & {
  productName: string;
};

const populatedSnapshot = {
  birthDateWasEmpty: false,
  phoneWasEmpty: false,
};

function createForm(overrides: Partial<TestForm> = {}): TestForm {
  return {
    clientId: null,
    selectedClientSnapshot: null,
    clientName: "",
    clientBirthDate: "",
    clientPhone: "",
    productName: "Produto preservado",
    ...overrides,
  };
}

describe("client autofill state", () => {
  it("stores the selected client identity and preserves unrelated fields", () => {
    const next = applyClientAutofill(createForm(), {
      id: 42,
      fullName: "Maria da Silva",
      birthDate: "1990-05-20",
      phone: "(11) 99999-8888",
      snapshot: populatedSnapshot,
    });

    expect(next).toEqual({
      clientId: 42,
      selectedClientSnapshot: populatedSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
      productName: "Produto preservado",
    });
  });

  it("clears the selected identity details when its name is edited", () => {
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: populatedSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
    });

    expect(editAutofilledClientName(selected, "Joana da Silva")).toEqual({
      clientId: null,
      selectedClientSnapshot: null,
      clientName: "Joana da Silva",
      clientBirthDate: "",
      clientPhone: "",
      productName: "Produto preservado",
    });
  });

  it("keeps the selection when the name value did not change", () => {
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: populatedSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
    });

    expect(editAutofilledClientName(selected, "Maria da Silva")).toEqual(
      selected
    );
  });

  it("preserves manually entered details while no client is selected", () => {
    const manual = createForm({
      clientName: "Maria",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
    });

    expect(editAutofilledClientName(manual, "Maria da Silva")).toEqual({
      ...manual,
      clientName: "Maria da Silva",
    });
  });

  it("invalidates the selection when birth date is edited", () => {
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: populatedSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
    });

    expect(
      editAutofilledClientDetails(selected, {
        clientBirthDate: "1991-06-21",
      })
    ).toEqual({
      ...selected,
      clientId: null,
      selectedClientSnapshot: null,
      clientBirthDate: "1991-06-21",
    });
  });

  it("invalidates the selection when phone or DDI changes", () => {
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: populatedSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "(11) 99999-8888",
    });

    expect(editAutofilledClientDetails(selected, { clientPhone: "" })).toEqual({
      ...selected,
      clientId: null,
      selectedClientSnapshot: null,
      clientPhone: "",
    });
  });
  it("keeps the selection while enriching an originally empty birth date", () => {
    const emptyBirthSnapshot = {
      birthDateWasEmpty: true,
      phoneWasEmpty: false,
    };
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: emptyBirthSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "",
      clientPhone: "(11) 99999-8888",
    });

    expect(
      editAutofilledClientDetails(selected, {
        clientBirthDate: "1990-05-20",
      })
    ).toEqual({
      ...selected,
      clientBirthDate: "1990-05-20",
    });
  });

  it("keeps the selection through DDI and phone edits when canonical phone was empty", () => {
    const emptyPhoneSnapshot = {
      birthDateWasEmpty: false,
      phoneWasEmpty: true,
    };
    const selected = createForm({
      clientId: 42,
      selectedClientSnapshot: emptyPhoneSnapshot,
      clientName: "Maria da Silva",
      clientBirthDate: "1990-05-20",
      clientPhone: "",
    });

    const afterDdiChange = editAutofilledClientDetails(selected, {
      clientPhone: "",
    });
    expect(afterDdiChange).toEqual(selected);

    expect(
      editAutofilledClientDetails(afterDdiChange, {
        clientPhone: "(11) 99999-8888",
      })
    ).toEqual({
      ...selected,
      clientPhone: "(11) 99999-8888",
    });
  });
});

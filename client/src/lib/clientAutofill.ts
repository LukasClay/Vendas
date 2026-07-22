export interface ClientAutofillSnapshot {
  birthDateWasEmpty: boolean;
  phoneWasEmpty: boolean;
}

export interface ClientAutofillFields {
  clientId: number | null;
  selectedClientSnapshot: ClientAutofillSnapshot | null;
  clientName: string;
  clientBirthDate: string;
  clientPhone: string;
}

export interface ClientAutofillSelection {
  id: number;
  fullName: string;
  birthDate: string;
  phone: string;
  snapshot: ClientAutofillSnapshot;
}

export function applyClientAutofill<T extends ClientAutofillFields>(
  current: T,
  selection: ClientAutofillSelection
): T {
  return {
    ...current,
    clientId: selection.id,
    selectedClientSnapshot: selection.snapshot,
    clientName: selection.fullName,
    clientBirthDate: selection.birthDate,
    clientPhone: selection.phone,
  };
}

export function editAutofilledClientName<T extends ClientAutofillFields>(
  current: T,
  clientName: string
): T {
  if (clientName === current.clientName) {
    return { ...current, clientName };
  }

  if (current.clientId === null) {
    return {
      ...current,
      selectedClientSnapshot: null,
      clientName,
    };
  }

  return {
    ...current,
    clientId: null,
    selectedClientSnapshot: null,
    clientName,
    clientBirthDate: "",
    clientPhone: "",
  };
}

export function editAutofilledClientDetails<T extends ClientAutofillFields>(
  current: T,
  changes: Partial<
    Pick<ClientAutofillFields, "clientBirthDate" | "clientPhone">
  >
): T {
  const editsBirthDate = "clientBirthDate" in changes;
  const editsPhone = "clientPhone" in changes;
  const snapshot = current.selectedClientSnapshot;
  const preservesSelectedClient =
    current.clientId !== null &&
    snapshot !== null &&
    (!editsBirthDate || snapshot.birthDateWasEmpty) &&
    (!editsPhone || snapshot.phoneWasEmpty);

  return {
    ...current,
    ...changes,
    clientId: preservesSelectedClient ? current.clientId : null,
    selectedClientSnapshot: preservesSelectedClient ? snapshot : null,
  };
}

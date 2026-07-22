const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const saoPauloDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface ConsultationSlotAvailabilityInput {
  consultationDate: string;
  consultationTime: string;
  sold: boolean;
  saleId: number | null;
  status: string;
}

export interface SaoPauloDateTimeParts {
  date: string;
  time: string;
}

export function getSaoPauloDateTimeParts(
  now: Date = new Date()
): SaoPauloDateTimeParts {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = Object.fromEntries(
    saoPauloDateTimeFormatter
      .formatToParts(now)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function isConsultationSlotAvailable(
  slot: ConsultationSlotAvailabilityInput | null | undefined,
  now: Date = new Date()
): boolean {
  if (
    !slot ||
    slot.sold !== false ||
    slot.saleId !== null ||
    slot.status !== "pendente" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(slot.consultationDate) ||
    !/^\d{2}:\d{2}$/.test(slot.consultationTime)
  ) {
    return false;
  }

  const current = getSaoPauloDateTimeParts(now);

  return (
    slot.consultationDate > current.date ||
    (slot.consultationDate === current.date &&
      slot.consultationTime > current.time)
  );
}

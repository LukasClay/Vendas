import { describe, expect, it } from "vitest";
import {
  getSaoPauloDateTimeParts,
  isConsultationSlotAvailable,
  type ConsultationSlotAvailabilityInput,
} from "./consultationSlotAvailability";

const NOW = new Date("2026-07-21T15:30:45.000Z");

function createSlot(
  overrides: Partial<ConsultationSlotAvailabilityInput> = {}
): ConsultationSlotAvailabilityInput {
  return {
    consultationDate: "2026-07-21",
    consultationTime: "12:31",
    sold: false,
    saleId: null,
    status: "pendente",
    ...overrides,
  };
}

describe("getSaoPauloDateTimeParts", () => {
  it("returns the date and time in Sao Paulo", () => {
    expect(getSaoPauloDateTimeParts(NOW)).toEqual({
      date: "2026-07-21",
      time: "12:30",
    });
  });

  it("handles the previous calendar day in Sao Paulo", () => {
    expect(
      getSaoPauloDateTimeParts(new Date("2026-07-21T02:05:00.000Z"))
    ).toEqual({
      date: "2026-07-20",
      time: "23:05",
    });
  });

  it("rejects an invalid Date", () => {
    expect(() => getSaoPauloDateTimeParts(new Date(Number.NaN))).toThrow(
      RangeError
    );
  });
});

describe("isConsultationSlotAvailable", () => {
  it.each([undefined, null])("rejects a missing slot row", slot => {
    expect(isConsultationSlotAvailable(slot, NOW)).toBe(false);
  });

  it("accepts an unsold pending unassigned slot strictly in the future", () => {
    expect(isConsultationSlotAvailable(createSlot(), NOW)).toBe(true);
    expect(
      isConsultationSlotAvailable(
        createSlot({
          consultationDate: "2026-07-22",
          consultationTime: "00:00",
        }),
        NOW
      )
    ).toBe(true);
  });

  it("rejects a slot in the current minute or in the past", () => {
    expect(
      isConsultationSlotAvailable(
        createSlot({ consultationTime: "12:30" }),
        NOW
      )
    ).toBe(false);
    expect(
      isConsultationSlotAvailable(
        createSlot({ consultationTime: "12:29" }),
        NOW
      )
    ).toBe(false);
    expect(
      isConsultationSlotAvailable(
        createSlot({ consultationDate: "2026-07-20" }),
        NOW
      )
    ).toBe(false);
  });

  it.each([
    ["sold", { sold: true }],
    ["assigned", { saleId: 42 }],
    ["cancelled", { status: "cancelada" }],
    ["completed", { status: "realizada" }],
  ] satisfies Array<[string, Partial<ConsultationSlotAvailabilityInput>]>)(
    "rejects a %s slot",
    (_label, overrides) => {
      expect(isConsultationSlotAvailable(createSlot(overrides), NOW)).toBe(
        false
      );
    }
  );

  it("rejects malformed date and time values", () => {
    expect(
      isConsultationSlotAvailable(
        createSlot({ consultationDate: "21/07/2026" }),
        NOW
      )
    ).toBe(false);
    expect(
      isConsultationSlotAvailable(createSlot({ consultationTime: "9:30" }), NOW)
    ).toBe(false);
  });
});

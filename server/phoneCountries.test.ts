import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  parsePhoneForInput,
} from "../client/src/lib/phoneCountries";

describe("parsePhoneForInput", () => {
  it("keeps a Brazilian local number in the default country", () => {
    const parsed = parsePhoneForInput("11999998888");

    expect(parsed.country.code).toBe("BR");
    expect(parsed.localDigits).toBe("11999998888");
  });

  it("detects an international phone with an explicit DDI", () => {
    const parsed = parsePhoneForInput("+351 912 345 678");

    expect(parsed.country.code).toBe("PT");
    expect(parsed.localDigits).toBe("912345678");
  });

  it("detects a stored DDI even when the plus sign is absent", () => {
    const parsed = parsePhoneForInput("5511999998888");

    expect(parsed.country.code).toBe("BR");
    expect(parsed.localDigits).toBe("11999998888");
  });

  it("uses the requested fallback country for a local number", () => {
    const portugal = COUNTRIES.find(country => country.code === "PT");
    expect(portugal).toBeDefined();

    const parsed = parsePhoneForInput("912345678", portugal);

    expect(parsed.country.code).toBe("PT");
    expect(parsed.localDigits).toBe("912345678");
  });
});

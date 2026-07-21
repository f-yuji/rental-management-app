import { describe, expect, it } from "vitest";
import {
  assertUniqueCode,
  formatContractCode,
  formatPropertyCode,
  formatUnitCode,
  normalizeCode,
} from "./code-generation";
describe("code generation", () => {
  it("formats sequential property codes", () => {
    expect(formatPropertyCode(1)).toBe("P-0001");
    expect(formatPropertyCode(2)).toBe("P-0002");
  });
  it("ties unit codes to a property", () =>
    expect(formatUnitCode("p-0001", 2)).toBe("P-0001-U-002"));
  it("includes the contract year", () =>
    expect(formatContractCode(2026, 1)).toBe("C-2026-0001"));
  it("rejects duplicate codes", () =>
    expect(() => assertUniqueCode(" p-0001 ", ["P-0001"])).toThrow());
  it("allows manually edited codes", () =>
    expect(normalizeCode(" custom-12 ")).toBe("CUSTOM-12"));
});

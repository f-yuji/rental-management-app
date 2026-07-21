import { describe, expect, it } from "vitest";
import { unitOccupancyMetrics } from "./unit-occupancy";
import type { Contract } from "@/types";
const contract = (start: string, end: string | null, status = "契約中") =>
  ({ start_date: start, end_date: end, status }) as Contract;
describe("unit occupancy", () => {
  const today = new Date(2026, 6, 21);
  it("shows the current contract duration", () =>
    expect(
      unitOccupancyMetrics([contract("2025-05-01", null)], "2025-01-01", today)
        .contractDuration,
    ).toContain("1年"));
  it("shows current vacancy days after a contract ends", () =>
    expect(
      unitOccupancyMetrics(
        [contract("2026-01-01", "2026-06-30", "終了")],
        "2026-01-01",
        today,
      ).vacancyDuration,
    ).toBe("21日"));
  it("calculates cumulative vacancy and occupancy rate", () => {
    const result = unitOccupancyMetrics(
      [contract("2026-01-11", "2026-01-20", "終了")],
      "2026-01-01",
      new Date(2026, 0, 20),
    );
    expect(result.cumulativeVacancyDays).toBe(10);
    expect(result.occupancyRate).toBe(0.5);
  });
});

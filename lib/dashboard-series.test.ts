import { describe, expect, it } from "vitest";
import { cumulativePaymentSeries } from "./dashboard-series";
import type { AppSettings, MonthlyCharge } from "@/types";

const settings = {
  opening_total_paid: 100000,
  opening_balance_through_date: "2025-12-31",
} as AppSettings;

describe("累計入金グラフ", () => {
  it("月別入金を古い順に積み上げ、初期累計を含める", () => {
    const charges = [
      { billing_month: "2026-02-01", paid_amount: 30000 },
      { billing_month: "2026-01-01", paid_amount: 20000 },
      { billing_month: "2026-01-01", paid_amount: 10000 },
    ] as MonthlyCharge[];
    expect(cumulativePaymentSeries(settings, charges)).toEqual([
      { month: "2025-12", monthlyPaid: 0, cumulativePaid: 100000, acquisitions: [] },
      { month: "2026-01", monthlyPaid: 30000, cumulativePaid: 130000, acquisitions: [] },
      { month: "2026-02", monthlyPaid: 30000, cumulativePaid: 160000, acquisitions: [] },
    ]);
  });
  it("入金がない物件取得月もイベントとして残す", () => {
    const rows = cumulativePaymentSeries(settings, [], [
      { name: "市沢資材置き場", acquisition_date: "2024-04-12" },
    ]);
    expect(rows[0]).toEqual({
      month: "2024-04",
      monthlyPaid: 0,
      cumulativePaid: 0,
      acquisitions: ["市沢資材置き場"],
    });
    expect(rows[1].cumulativePaid).toBe(100000);
  });

  it("初期累計も入金ログもなければ空配列", () => {
    expect(cumulativePaymentSeries({ ...settings, opening_total_paid: 0 }, [])).toEqual([]);
  });
});

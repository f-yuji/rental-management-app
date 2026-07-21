import { describe, expect, it } from "vitest";
import {
  billingKey,
  calculateCharge,
  currentYield,
  effectiveContractStatus,
  grossYield,
  isContractActiveInMonth,
  netAssets,
  paymentDueDate,
  paymentStatus,
  totalInvestment,
} from ".";
import type { Contract } from "@/types";
const c = (start: string, end: string | null, rent = 30000) => ({
  start_date: start,
  end_date: end,
  monthly_rent: rent,
  key_money: 0,
  free_rent_months: 0,
  status: "契約中" as const,
});
describe("資産計算", () => {
  it("総投資額", () =>
    expect(
      totalInvestment({
        acquisition_price: 100,
        acquisition_costs: 20,
        development_costs: 30,
      }),
    ).toBe(150));
  it("純資産", () =>
    expect(netAssets({ current_valuation: 500, remaining_debt: 120 })).toBe(
      380,
    ));
  it("表面・現在利回り", () => {
    expect(grossYield(100, 1200)).toBe(1);
    expect(currentYield(50, 1200)).toBe(0.5);
    expect(grossYield(1, 0)).toBeNull();
  });
});
describe("請求計算", () => {
  it("日割OFF", () =>
    expect(calculateCharge(c("2026-07-20", null), "2026-07-01", false)).toBe(
      30000,
    ));
  it("開始月の日割", () =>
    expect(
      calculateCharge(c("2026-07-20", null, 31000), "2026-07-01", true),
    ).toBe(12000));
  it("終了月の日割", () =>
    expect(
      calculateCharge(c("2026-01-01", "2026-07-10", 31000), "2026-07-01", true),
    ).toBe(10000));
  it("うるう年2月", () =>
    expect(
      calculateCharge(c("2024-02-15", null, 29000), "2024-02-01", true),
    ).toBe(15000));
  it("月途中開始・終了", () =>
    expect(
      calculateCharge(c("2026-04-10", "2026-04-20", 30000), "2026-04-01", true),
    ).toBe(11000));
  it("礼金は契約開始月だけ加算する", () => {
    const contract = { ...c("2026-04-01", null), key_money: 60000 };
    expect(calculateCharge(contract, "2026-04-01", false)).toBe(90000);
    expect(calculateCharge(contract, "2026-05-01", false)).toBe(30000);
  });
  it("フリーレント後に賃料を発生させる", () => {
    const contract = { ...c("2026-04-10", null, 30000), free_rent_months: 1 };
    expect(calculateCharge(contract, "2026-04-01", false)).toBe(0);
    expect(calculateCharge(contract, "2026-05-01", false)).toBe(30000);
    expect(calculateCharge(contract, "2026-05-01", true)).toBe(21290);
  });
  it("対象月判定", () => {
    expect(
      isContractActiveInMonth(c("2026-04-01", null) as Contract, "2026-04-01"),
    ).toBe(true);
    expect(
      isContractActiveInMonth(c("2026-05-01", null) as Contract, "2026-04-01"),
    ).toBe(false);
  });
});
describe("状態と期限", () => {
  it("契約状態を日付から判定する", () => {
    const today = new Date("2026-07-21T00:00:00");
    expect(effectiveContractStatus(c("2026-08-01", null), today)).toBe("未開始");
    expect(effectiveContractStatus(c("2026-01-01", null), today)).toBe("契約中");
    expect(effectiveContractStatus(c("2026-01-01", "2026-08-01"), today)).toBe("終了予定");
    expect(effectiveContractStatus(c("2026-01-01", "2026-06-30"), today)).toBe("終了");
  });
  it("入金状態", () => {
    expect(paymentStatus(100, 0)).toBe("未入金");
    expect(paymentStatus(100, 40)).toBe("一部入金");
    expect(paymentStatus(100, 100)).toBe("入金済");
  });
  it("月末期限", () =>
    expect(paymentDueDate("2026-02-01", 31).getDate()).toBe(28));
  it("重複防止キー", () =>
    expect(billingKey("2026-04-01", "c1")).toBe("2026-04|c1"));
});

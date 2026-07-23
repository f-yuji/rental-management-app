import { describe, expect, it } from "vitest";
import {
  billingKey,
  calculateCharge,
  currentYield,
  effectiveContractStatus,
  grossYield,
  isContractActiveInMonth,
  netAssets,
  netYield,
  paymentDueDate,
  paymentStatus,
  startMonthProration,
  surfaceInvestment,
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
    expect(netAssets({ current_valuation: 500, remaining_debt: 120 })).toBe(380));
  it("表面利回りの投資額は取得価格と開発費", () => {
    expect(surfaceInvestment({ acquisition_price: 1000, development_costs: 200 })).toBe(1200);
    expect(grossYield(100, 1200)).toBe(1);
  });
  it("実利回りは固定資産税と取得諸費用を反映", () => {
    expect(currentYield(50, 1200)).toBe(0.5);
    expect(netYield(100, 120, 1500)).toBe(0.72);
    expect(grossYield(1, 0)).toBeNull();
  });
});

describe("開始月のみの日割り", () => {
  it("設定値にかかわらず開始月を日割りする", () => {
    expect(calculateCharge(c("2026-07-20", null), "2026-07-01", false)).toBe(11613);
    expect(calculateCharge(c("2026-07-20", null), "2026-07-01", true)).toBe(11613);
  });
  it("開始日が1日なら満額", () =>
    expect(calculateCharge(c("2026-07-01", null, 31000), "2026-07-01", true)).toBe(31000));
  it("終了月は日割りしない", () =>
    expect(calculateCharge(c("2026-01-01", "2026-07-10", 31000), "2026-07-01", true)).toBe(31000));
  it("うるう年2月を正しく扱う", () =>
    expect(calculateCharge(c("2024-02-15", null, 29000), "2024-02-01", true)).toBe(15000));
  it("同じ月に終了しても開始日から月末までで計算する", () =>
    expect(calculateCharge(c("2026-04-10", "2026-04-20", 30000), "2026-04-01", true)).toBe(21000));
  it("開始月の予定額と日数を返す", () =>
    expect(startMonthProration("2023-12-27", 27000)).toEqual({
      amount: 4355,
      activeDays: 5,
      daysInMonth: 31,
      rentStartDate: "2023-12-27",
    }));
  it("礼金は契約開始月だけ加算する", () => {
    const contract = { ...c("2026-04-01", null), key_money: 60000 };
    expect(calculateCharge(contract, "2026-04-01", false)).toBe(90000);
    expect(calculateCharge(contract, "2026-05-01", false)).toBe(30000);
  });
  it("フリーレント後の賃料発生日から日割りする", () => {
    const contract = { ...c("2026-04-10", null, 30000), free_rent_months: 1 };
    expect(calculateCharge(contract, "2026-04-01", false)).toBe(0);
    expect(calculateCharge(contract, "2026-05-01", false)).toBe(21290);
    expect(calculateCharge(contract, "2026-06-01", false)).toBe(30000);
  });
  it("契約対象月を判定する", () => {
    expect(isContractActiveInMonth(c("2026-04-01", null) as Contract, "2026-04-01")).toBe(true);
    expect(isContractActiveInMonth(c("2026-05-01", null) as Contract, "2026-04-01")).toBe(false);
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
  it("存在しない支払日は月末に丸める", () =>
    expect(paymentDueDate("2026-02-01", 31).getDate()).toBe(28));
  it("二重請求防止キー", () =>
    expect(billingKey("2026-04-01", "c1")).toBe("2026-04|c1"));
});

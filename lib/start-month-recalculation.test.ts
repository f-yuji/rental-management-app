import { describe, expect, it } from "vitest";
import { previewStartMonthRecalculations } from "./start-month-recalculation";
import type { Contract, MonthlyCharge } from "@/types";

const contract = {
  id: "c1",
  contract_code: "C-2023-0001",
  start_date: "2023-12-27",
  end_date: null,
  monthly_rent: 27000,
  key_money: 0,
  free_rent_months: 0,
  status: "契約中",
} as Contract;
const charge = {
  id: "m1",
  contract_id: "c1",
  billing_month: "2023-12-01",
  billed_amount: 27000,
  paid_amount: 27000,
  payment_status: "入金済",
} as MonthlyCharge;

describe("既存開始月請求の再計算", () => {
  it("開始月だけを日割りして差額を返す", () => {
    const [row] = previewStartMonthRecalculations([contract], [charge]);
    expect(row.recalculatedAmount).toBe(4355);
    expect(row.difference).toBe(-22645);
    expect(row.paymentStatus).toBe("入金済");
  });
  it("開始翌月の請求は対象にしない", () => {
    expect(previewStartMonthRecalculations([contract], [{ ...charge, billing_month: "2024-01-01" }])).toEqual([]);
  });
  it("すでに正しい金額なら対象にしない", () => {
    expect(previewStartMonthRecalculations([contract], [{ ...charge, billed_amount: 4355, paid_amount: 4355 }])).toEqual([]);
  });
  it("請求額だけ再計算済みでも過入金が残れば対象にする", () => {
    const [row] = previewStartMonthRecalculations([contract], [{ ...charge, billed_amount: 4355 }]);
    expect(row.recalculatedAmount).toBe(4355);
    expect(row.charge.paid_amount).toBe(27000);
  });
});

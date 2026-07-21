import { describe, expect, it } from "vitest";
import { previewRetroactiveCharges } from "./retroactive-billing";
import type { AppSettings, Contract, MonthlyCharge } from "@/types";
const settings: AppSettings = {
  target_year: 2026,
  prorate_enabled: false,
  default_billing_day: 1,
  default_payment_due_day: 31,
  operation_start_date: "2026-07-01",
  opening_total_billed: 100000,
  opening_total_paid: 90000,
  opening_balance_through_date: "2026-06-30",
};
const contract = {
  id: "c1",
  user_id: "u",
  contract_code: "C-2026-0001",
  property_id: "p",
  unit_id: "x",
  tenant_name: "A",
  tenant_phone: null,
  tenant_email: null,
  tenant_address: null,
  start_date: "2026-04-01",
  end_date: "2026-05-31",
  monthly_rent: 30000,
  billing_day: 1,
  payment_due_day: 31,
  contract_type: "継続",
  status: "契約中",
  deposit_amount: 0,
  renewal_date: null,
  notes: "",
  created_at: "",
  updated_at: "",
} as Contract;
describe("retroactive billing", () => {
  it("does not generate after the contract end", () =>
    expect(
      previewRetroactiveCharges([contract], [], settings, "2026-07", "unpaid")
        .rows,
    ).toHaveLength(2));
  it("skips an existing contract/month", () => {
    const old = {
      contract_id: "c1",
      billing_month: "2026-04-01",
    } as MonthlyCharge;
    const p = previewRetroactiveCharges(
      [contract],
      [old],
      settings,
      "2026-07",
      "unpaid",
    );
    expect(p.rows).toHaveLength(1);
    expect(p.duplicateCount).toBe(1);
  });
  it("warns when the opening balance period overlaps", () =>
    expect(
      previewRetroactiveCharges([contract], [], settings, "2026-07", "paid")
        .openingBalanceOverlap,
    ).toBe(true));
});

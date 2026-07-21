import { expect, it } from "vitest";
import { cumulativeTotals } from "@/lib/calculations";
import type { AppSettings } from "@/types";
const s = { opening_total_billed: 100, opening_total_paid: 80 } as AppSettings;
it("adds opening balances and calculates outstanding", () =>
  expect(cumulativeTotals(s, [{ billed_amount: 50, paid_amount: 20 }])).toEqual(
    { billed: 150, paid: 100, outstanding: 50 },
  ));

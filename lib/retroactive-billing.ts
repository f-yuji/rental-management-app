import { addMonths, format, isAfter, parseISO, startOfMonth } from "date-fns";
import { billingKey, calculateCharge } from "@/lib/calculations";
import type { AppSettings, Contract, MonthlyCharge } from "@/types";

export type RetroPaymentMode = "paid" | "unpaid";
export type RetroPreview = {
  rows: MonthlyCharge[];
  contractCount: number;
  targetMonthCount: number;
  totalAmount: number;
  duplicateCount: number;
  period: string;
  openingBalanceOverlap: boolean;
};

export function previewRetroactiveCharges(
  contracts: Contract[],
  existing: MonthlyCharge[],
  settings: AppSettings,
  throughMonth: string,
  paymentMode: RetroPaymentMode,
): RetroPreview {
  const through = startOfMonth(parseISO(`${throughMonth.slice(0, 7)}-01`));
  const keys = new Set(
    existing.map((row) => billingKey(row.billing_month, row.contract_id)),
  );
  const rows: MonthlyCharge[] = [];
  let duplicateCount = 0;
  const months = new Set<string>();
  const contractIds = new Set<string>();
  let earliest: string | null = null;
  for (const contract of contracts) {
    let month = startOfMonth(parseISO(contract.start_date));
    const contractEnd = contract.end_date
      ? startOfMonth(parseISO(contract.end_date))
      : through;
    const finalMonth = isAfter(contractEnd, through) ? through : contractEnd;
    while (!isAfter(month, finalMonth)) {
      const billingMonth = format(month, "yyyy-MM-01"),
        key = billingKey(billingMonth, contract.id);
      const amount = calculateCharge(
        contract,
        billingMonth,
        settings.prorate_enabled,
      );
      if (amount > 0) {
        months.add(billingMonth);
        contractIds.add(contract.id);
        if (earliest === null || billingMonth.localeCompare(earliest) < 0)
          earliest = billingMonth;
        if (keys.has(key)) duplicateCount++;
        else
          rows.push({
            id: crypto.randomUUID(),
            user_id: contract.user_id,
            billing_month: billingMonth,
            property_id: contract.property_id,
            unit_id: contract.unit_id,
            contract_id: contract.id,
            billed_amount: amount,
            paid_amount: paymentMode === "paid" ? amount : 0,
            payment_date: paymentMode === "paid" ? billingMonth : null,
            payment_status: paymentMode === "paid" ? "入金済" : "未入金",
            memo: "過去契約から生成",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
      month = addMonths(month, 1);
    }
  }
  const overlapDate = settings.opening_balance_through_date;
  return {
    rows,
    contractCount: contractIds.size,
    targetMonthCount: months.size,
    totalAmount: rows.reduce((sum, row) => sum + row.billed_amount, 0),
    duplicateCount,
    period: earliest
      ? `${earliest.slice(0, 7)} - ${format(through, "yyyy-MM")}`
      : "-",
    openingBalanceOverlap: Boolean(
      overlapDate &&
      earliest &&
      earliest <= overlapDate &&
      (settings.opening_total_billed > 0 || settings.opening_total_paid > 0),
    ),
  };
}

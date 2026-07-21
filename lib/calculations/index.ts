import {
  differenceInCalendarDays,
  endOfMonth,
  getDaysInMonth,
  isAfter,
  isBefore,
  parseISO,
  setDate,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type {
  AppSettings,
  Contract,
  MonthlyCharge,
  PaymentStatus,
  Property,
} from "@/types";

export const totalInvestment = (
  p: Pick<
    Property,
    "acquisition_price" | "acquisition_costs" | "development_costs"
  >,
) => p.acquisition_price + p.acquisition_costs + p.development_costs;
export const netAssets = (
  p: Pick<Property, "current_valuation" | "remaining_debt">,
) => p.current_valuation - p.remaining_debt;
export const grossYield = (monthly: number, investment: number) =>
  investment > 0 ? (monthly * 12) / investment : null;
export const currentYield = grossYield;
export const outstanding = (billed: number, paid: number) =>
  Math.max(billed - paid, 0);
export const cumulativeTotals = (
  settings: AppSettings,
  charges: Pick<MonthlyCharge, "billed_amount" | "paid_amount">[],
) => {
  const billed =
    settings.opening_total_billed +
    charges.reduce((sum, row) => sum + row.billed_amount, 0);
  const paid =
    settings.opening_total_paid +
    charges.reduce((sum, row) => sum + row.paid_amount, 0);
  return { billed, paid, outstanding: outstanding(billed, paid) };
};
export const paymentStatus = (billed: number, paid: number): PaymentStatus =>
  paid <= 0 ? "未入金" : paid < billed ? "一部入金" : "入金済";
export const billingKey = (month: string, contractId: string) =>
  `${month.slice(0, 7)}|${contractId}`;

export type EffectiveContractStatus = "未開始" | "契約中" | "終了予定" | "終了" | "解約" | "下書き";
export function effectiveContractStatus(
  contract: Pick<Contract, "start_date" | "end_date" | "status">,
  today = new Date(),
): EffectiveContractStatus {
  if (contract.status === "下書き" || contract.status === "解約")
    return contract.status;
  const current = startOfDay(today);
  const start = parseISO(contract.start_date);
  const end = contract.end_date ? parseISO(contract.end_date) : null;
  if (isBefore(current, start)) return "未開始";
  if (end && isAfter(current, end)) return "終了";
  if (end && differenceInCalendarDays(end, current) <= 30) return "終了予定";
  return "契約中";
}
export const paymentDueDate = (month: string, dueDay: number) => {
  const first = startOfMonth(parseISO(month));
  return setDate(first, Math.min(Math.max(dueDay, 1), getDaysInMonth(first)));
};

export type RenewalReminder = {
  daysRemaining: number;
  level: "overdue" | "urgent" | "upcoming";
  label: string;
};

export function renewalReminder(
  renewalDate: string | null,
  today = new Date(),
  noticeDays = 60,
): RenewalReminder | null {
  if (!renewalDate) return null;
  const daysRemaining = differenceInCalendarDays(
    parseISO(renewalDate),
    startOfDay(today),
  );
  if (daysRemaining > noticeDays) return null;
  if (daysRemaining < 0)
    return {
      daysRemaining,
      level: "overdue",
      label: `更新期限を${Math.abs(daysRemaining)}日超過`,
    };
  if (daysRemaining <= 30)
    return {
      daysRemaining,
      level: "urgent",
      label: daysRemaining === 0 ? "本日更新" : `更新まで${daysRemaining}日`,
    };
  return {
    daysRemaining,
    level: "upcoming",
    label: `更新まで${daysRemaining}日`,
  };
}

export function isContractActiveInMonth(
  contract: Pick<Contract, "start_date" | "end_date" | "status">,
  month: string,
) {
  if (["解約", "下書き"].includes(contract.status)) return false;
  const first = startOfMonth(parseISO(month));
  const last = endOfMonth(first);
  const start = parseISO(contract.start_date);
  const end = contract.end_date ? parseISO(contract.end_date) : null;
  return !isAfter(start, last) && (!end || !isBefore(end, first));
}

export function calculateCharge(
  contract: Pick<
    Contract,
    "start_date" | "end_date" | "monthly_rent" | "status"
  >,
  month: string,
  prorate: boolean,
) {
  if (!isContractActiveInMonth(contract, month)) return 0;
  if (!prorate) return contract.monthly_rent;
  const first = startOfMonth(parseISO(month));
  const last = endOfMonth(first);
  const activeStart = isAfter(parseISO(contract.start_date), first)
    ? parseISO(contract.start_date)
    : first;
  const contractEnd = contract.end_date ? parseISO(contract.end_date) : last;
  const activeEnd = isBefore(contractEnd, last) ? contractEnd : last;
  const days = differenceInCalendarDays(activeEnd, activeStart) + 1;
  return Math.round((contract.monthly_rent * days) / getDaysInMonth(first));
}

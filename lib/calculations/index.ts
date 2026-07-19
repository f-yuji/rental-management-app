import { differenceInCalendarDays, endOfMonth, getDaysInMonth, isAfter, isBefore, parseISO, setDate, startOfMonth } from "date-fns";
import type { Contract, PaymentStatus, Property } from "@/types";

export const totalInvestment = (p: Pick<Property, "acquisition_price" | "acquisition_costs" | "development_costs">) =>
  p.acquisition_price + p.acquisition_costs + p.development_costs;
export const netAssets = (p: Pick<Property, "current_valuation" | "remaining_debt">) => p.current_valuation - p.remaining_debt;
export const grossYield = (monthly: number, investment: number) => investment > 0 ? monthly * 12 / investment : null;
export const currentYield = grossYield;
export const outstanding = (billed: number, paid: number) => Math.max(billed - paid, 0);
export const paymentStatus = (billed: number, paid: number): PaymentStatus => paid <= 0 ? "未入金" : paid < billed ? "一部入金" : "入金済";
export const billingKey = (month: string, contractId: string) => `${month.slice(0, 7)}|${contractId}`;
export const paymentDueDate = (month: string, dueDay: number) => {
  const first = startOfMonth(parseISO(month));
  return setDate(first, Math.min(Math.max(dueDay, 1), getDaysInMonth(first)));
};

export function isContractActiveInMonth(contract: Pick<Contract, "start_date" | "end_date" | "status">, month: string) {
  if (["解約", "下書き"].includes(contract.status)) return false;
  const first = startOfMonth(parseISO(month));
  const last = endOfMonth(first);
  const start = parseISO(contract.start_date);
  const end = contract.end_date ? parseISO(contract.end_date) : null;
  return !isAfter(start, last) && (!end || !isBefore(end, first));
}

export function calculateCharge(contract: Pick<Contract, "start_date" | "end_date" | "monthly_rent" | "status">, month: string, prorate: boolean) {
  if (!isContractActiveInMonth(contract, month)) return 0;
  if (!prorate) return contract.monthly_rent;
  const first = startOfMonth(parseISO(month));
  const last = endOfMonth(first);
  const activeStart = isAfter(parseISO(contract.start_date), first) ? parseISO(contract.start_date) : first;
  const contractEnd = contract.end_date ? parseISO(contract.end_date) : last;
  const activeEnd = isBefore(contractEnd, last) ? contractEnd : last;
  const days = differenceInCalendarDays(activeEnd, activeStart) + 1;
  return Math.round(contract.monthly_rent * days / getDaysInMonth(first));
}

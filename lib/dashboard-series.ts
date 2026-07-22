import type { AppSettings, MonthlyCharge, Property } from "@/types";

export type CumulativePaymentPoint = {
  month: string;
  monthlyPaid: number;
  cumulativePaid: number;
  acquisitions: string[];
};

export function cumulativePaymentSeries(
  settings: AppSettings,
  charges: MonthlyCharge[],
  properties: Pick<Property, "name" | "acquisition_date">[] = [],
): CumulativePaymentPoint[] {
  const byMonth = new Map<string, number>();
  for (const charge of charges) {
    const month = charge.billing_month.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + charge.paid_amount);
  }
  const openingMonth = settings.opening_balance_through_date?.slice(0, 7);
  if (settings.opening_total_paid > 0 && openingMonth && !byMonth.has(openingMonth))
    byMonth.set(openingMonth, 0);
  const acquisitions = new Map<string, string[]>();
  for (const property of properties) {
    if (!property.acquisition_date) continue;
    const month = property.acquisition_date.slice(0, 7);
    acquisitions.set(month, [...(acquisitions.get(month) ?? []), property.name]);
    if (!byMonth.has(month)) byMonth.set(month, 0);
  }
  let cumulativePaid = openingMonth ? 0 : settings.opening_total_paid;
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthlyPaid]) => {
      if (month === openingMonth) cumulativePaid += settings.opening_total_paid;
      cumulativePaid += monthlyPaid;
      return {
        month,
        monthlyPaid,
        cumulativePaid,
        acquisitions: acquisitions.get(month) ?? [],
      };
    });
}

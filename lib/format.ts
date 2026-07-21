import { format, parseISO } from "date-fns";
export const yen = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
export const percent = (value: number | null) =>
  value == null ? "-" : `${(value * 100).toFixed(1)}%`;
export const dateLabel = (value: string | null) =>
  value ? format(parseISO(value), "yyyy/MM/dd") : "-";
export const monthLabel = (value: string) =>
  format(parseISO(value), "yyyy年M月");

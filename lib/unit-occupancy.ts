import {
  differenceInCalendarDays,
  formatDuration,
  intervalToDuration,
  parseISO,
  startOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import type { Contract, Property } from "@/types";

export type UnitOccupancy = {
  contractDuration: string;
  vacancyDuration: string;
  cumulativeVacancyDays: number;
  occupancyRate: number | null;
};
export function unitOccupancyMetrics(
  contracts: Contract[],
  acquisitionDate: Property["acquisition_date"],
  today = new Date(),
): UnitOccupancy {
  const now = startOfDay(today),
    active = contracts
      .filter((c) => {
        const end = effectiveEnd(c);
        return (
          c.start_date <= toDate(now) &&
          (!end || end >= toDate(now)) &&
          !["終了", "下書き"].includes(c.status)
        );
      })
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  let continuousStart = active?.start_date ?? null;
  if (active && continuousStart) {
    const visited = new Set([active.id]);
    while (true) {
      const previous = contracts
        .filter((contract) => {
          const end = effectiveEnd(contract);
          return (
            !visited.has(contract.id) &&
            contract.termination_reason === "更新" &&
            !!end &&
            differenceInCalendarDays(
              parseISO(continuousStart as string),
              parseISO(end),
            ) === 1
          );
        })
        .sort((a, b) => (effectiveEnd(b) ?? "").localeCompare(effectiveEnd(a) ?? ""))[0];
      if (!previous) break;
      visited.add(previous.id);
      continuousStart = previous.start_date;
    }
  }
  const contractDuration = active && continuousStart
    ? formatDuration(
        intervalToDuration({ start: parseISO(continuousStart), end: now }),
        { format: ["years", "months"], locale: ja },
      ) || "1カ月未満"
    : "-";
  const ownershipStart = acquisitionDate
    ? parseISO(acquisitionDate)
    : contracts.length
      ? parseISO(
          [...contracts].sort((a, b) =>
            a.start_date.localeCompare(b.start_date),
          )[0].start_date,
        )
      : null;
  if (!ownershipStart || ownershipStart > now)
    return {
      contractDuration,
      vacancyDuration: active ? "契約中" : "-",
      cumulativeVacancyDays: 0,
      occupancyRate: null,
    };
  const elapsedDays = differenceInCalendarDays(now, ownershipStart) + 1;
  const occupied = new Set<string>();
  for (const contract of contracts) {
    const endDate = effectiveEnd(contract);
    let cursor = parseISO(contract.start_date),
      end = endDate ? parseISO(endDate) : now;
    if (cursor < ownershipStart) cursor = ownershipStart;
    if (end > now) end = now;
    while (cursor <= end) {
      occupied.add(toDate(cursor));
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
      );
    }
  }
  const occupiedDays = occupied.size,
    cumulativeVacancyDays = Math.max(elapsedDays - occupiedDays, 0);
  let vacancyDuration = "契約中";
  if (!active) {
    const lastEnd = contracts.map(effectiveEnd).filter(Boolean).sort().at(-1);
    const vacancyStart = lastEnd
      ? new Date(
          parseISO(lastEnd).getFullYear(),
          parseISO(lastEnd).getMonth(),
          parseISO(lastEnd).getDate() + 1,
        )
      : ownershipStart;
    vacancyDuration = `${Math.max(differenceInCalendarDays(now, vacancyStart) + 1, 0)}日`;
  }
  return {
    contractDuration,
    vacancyDuration,
    cumulativeVacancyDays,
    occupancyRate: elapsedDays ? occupiedDays / elapsedDays : null,
  };
}
const toDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const effectiveEnd = (contract: Contract) =>
  contract.end_date ??
  contract.cancellation_completed_date ??
  contract.cancellation_planned_date;

export const normalizeCode = (value: string) => value.trim().toUpperCase();
export const formatPropertyCode = (number: number) =>
  `P-${String(number).padStart(4, "0")}`;
export const formatUnitCode = (propertyCode: string, number: number) =>
  `${normalizeCode(propertyCode)}-U-${String(number).padStart(3, "0")}`;
export const formatContractCode = (year: number, number: number) =>
  `C-${year}-${String(number).padStart(4, "0")}`;
export function assertUniqueCode(code: string, existing: string[]) {
  const normalized = normalizeCode(code);
  if (existing.some((value) => normalizeCode(value) === normalized))
    throw new Error("このコードは既に使用されています");
  return normalized;
}

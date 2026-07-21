export type NumericFormat = "currency" | "number" | "percent";
const FULL_WIDTH = /[０-９．－]/g;
const toHalfWidth = (value: string) =>
  value.replace(FULL_WIDTH, (char) =>
    char === "．"
      ? "."
      : char === "－"
        ? "-"
        : String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );

export function normalizeNumericText(
  raw: string,
  allowNegative = false,
  decimalScale = 0,
) {
  let value = toHalfWidth(raw)
    .replace(/[¥￥円,\s]/g, "")
    .replace(allowNegative ? /[^0-9.\-]/g : /[^0-9.]/g, "");
  const negative = allowNegative && value.startsWith("-");
  value = value.replace(/-/g, "");
  const [integerRaw = "", ...decimalParts] = value.split(".");
  const integer =
    integerRaw.replace(/^0+(?=\d)/, "") || (decimalParts.length ? "0" : "");
  if (decimalScale <= 0) return `${negative ? "-" : ""}${integer}`;
  const decimal = decimalParts.join("").slice(0, decimalScale);
  return `${negative ? "-" : ""}${integer}${value.includes(".") ? `.${decimal}` : ""}`;
}
export function formatNumericText(value: string, decimalScale = 0) {
  if (!value || value === "-") return value;
  const negative = value.startsWith("-");
  const [integer = "", decimal] = (negative ? value.slice(1) : value).split(
    ".",
  );
  const grouped = integer ? Number(integer).toLocaleString("ja-JP") : "";
  return `${negative ? "-" : ""}${grouped}${decimal !== undefined && decimalScale > 0 ? `.${decimal}` : ""}`;
}
export function numberToDisplay(
  value: number,
  format: NumericFormat,
  decimalScale: number,
) {
  const displayed = format === "percent" ? value * 100 : value;
  if (!Number.isFinite(displayed) || displayed === 0) return "";
  const fixed =
    decimalScale > 0
      ? displayed.toFixed(decimalScale).replace(/\.?0+$/, "")
      : String(Math.round(displayed));
  return formatNumericText(fixed, decimalScale);
}
export function displayToNumber(value: string, format: NumericFormat) {
  if (!value || value === "-") return 0;
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(parsed)) return 0;
  return format === "percent" ? parsed / 100 : parsed;
}

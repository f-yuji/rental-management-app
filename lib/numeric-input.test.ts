import { describe, expect, it } from "vitest";
import {
  displayToNumber,
  formatNumericText,
  normalizeNumericText,
  numberToDisplay,
} from "./numeric-input";
describe("NumericInput helpers", () => {
  it("1234567をカンマ区切りにする", () =>
    expect(formatNumericText("1234567")).toBe("1,234,567"));
  it("先頭の不要な0を除去する", () =>
    expect(normalizeNumericText("000123")).toBe("123"));
  it("空欄を入力できる", () => {
    expect(displayToNumber("", "number")).toBe(0);
    expect(numberToDisplay(0, "currency", 0)).toBe("");
  });
  it("全角数字を処理する", () =>
    expect(normalizeNumericText("１２３４５６７")).toBe("1234567"));
  it("カンマ・円記号付き貼り付けを処理する", () =>
    expect(normalizeNumericText("¥1,234,567円")).toBe("1234567"));
  it("パーセント10を内部値0.1にする", () =>
    expect(displayToNumber("10", "percent")).toBe(0.1));
  it("小数0.5を壊さない", () =>
    expect(normalizeNumericText("0.5", false, 2)).toBe("0.5"));
});

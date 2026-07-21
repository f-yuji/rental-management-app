"use client";
import { useEffect, useRef, useState } from "react";
import {
  displayToNumber,
  formatNumericText,
  normalizeNumericText,
  numberToDisplay,
  type NumericFormat,
} from "@/lib/numeric-input";
type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onChange: (value: number) => void;
  format?: NumericFormat;
  allowNegative?: boolean;
  decimalScale?: number;
  suffix?: string;
};
export function NumericInput({
  value,
  onChange,
  format = "number",
  allowNegative = false,
  decimalScale = 0,
  suffix,
  ...props
}: Props) {
  const [text, setText] = useState(() =>
    numberToDisplay(value, format, decimalScale),
  );
  const focused = useRef(false),
    composing = useRef(false),
    inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focused.current) setText(numberToDisplay(value, format, decimalScale));
  }, [decimalScale, format, value]);
  const apply = (raw: string, caret?: number | null) => {
    const digitsBefore = raw
      .slice(0, caret ?? raw.length)
      .replace(/\D/g, "").length;
    const normalized = normalizeNumericText(raw, allowNegative, decimalScale),
      formatted = formatNumericText(normalized, decimalScale);
    setText(formatted);
    onChange(displayToNumber(normalized, format));
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      let position = 0,
        digits = 0;
      while (position < formatted.length && digits < digitsBefore) {
        if (/\d/.test(formatted[position])) digits++;
        position++;
      }
      input.setSelectionRange(position, position);
    });
  };
  return (
    <div
      className={`suffix-input ${suffix && suffix.length > 1 ? "suffix-input-wide" : ""}`}
    >
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode={decimalScale > 0 ? "decimal" : "numeric"}
        placeholder={props.placeholder ?? "0"}
        value={text}
        onFocus={(event) => {
          focused.current = true;
          if (value === 0) setText("");
          props.onFocus?.(event);
        }}
        onChange={(event) =>
          composing.current
            ? setText(event.target.value)
            : apply(event.target.value, event.target.selectionStart)
        }
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          apply(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onBlur={(event) => {
          focused.current = false;
          const normalized = normalizeNumericText(
            event.currentTarget.value,
            allowNegative,
            decimalScale,
          );
          setText(
            numberToDisplay(
              displayToNumber(normalized, format),
              format,
              decimalScale,
            ),
          );
          props.onBlur?.(event);
        }}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

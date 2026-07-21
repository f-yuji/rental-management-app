"use client";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { CsvButton, PageHeader } from "@/components/ui/shared";
import { outstanding } from "@/lib/calculations";
import { yen } from "@/lib/format";
export function AnnualPage() {
  const { data } = useApp();
  const [year, setYear] = useState(data.settings.target_year),
    [property, setProperty] = useState("");
  const rows = data.units
    .filter((u) => !property || u.property_id === property)
    .map((u) => {
      const cs = data.charges.filter(
        (c) => c.unit_id === u.id && c.billing_month.startsWith(String(year)),
      );
      const months = Array.from({ length: 12 }, (_, i) =>
        cs
          .filter((c) => Number(c.billing_month.slice(5, 7)) === i + 1)
          .reduce((s, c) => s + c.billed_amount, 0),
      );
      return {
        u,
        months,
        billed: months.reduce((a, b) => a + b, 0),
        paid: cs.reduce((s, c) => s + c.paid_amount, 0),
      };
    });
  return (
    <>
      <PageHeader title="年間一覧" description="区画ごとの月次請求実績" />
      <div className="toolbar">
        <label>
          対象年
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <select value={property} onChange={(e) => setProperty(e.target.value)}>
          <option value="">すべての物件</option>
          {data.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <CsvButton
          filename={`annual-${year}.csv`}
          rows={[
            [
              "区画",
              "物件",
              ...Array.from({ length: 12 }, (_, i) => `${i + 1}月請求`),
              "年間請求",
              "年間入金",
              "年間未収",
            ],
            ...rows.map((r) => [
              r.u.name,
              data.properties.find((p) => p.id === r.u.property_id)?.name || "",
              ...r.months,
              r.billed,
              r.paid,
              outstanding(r.billed, r.paid),
            ]),
          ]}
        />
      </div>
      <div className="panel table-wrap annual">
        <table>
          <thead>
            <tr>
              <th className="sticky">区画</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th className="num" key={i}>
                  {i + 1}月
                </th>
              ))}
              <th className="num">年間請求</th>
              <th className="num">年間入金</th>
              <th className="num">年間未収</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.u.id}>
                <td className="sticky">
                  <b>{r.u.name}</b>
                  <small>
                    {
                      data.properties.find((p) => p.id === r.u.property_id)
                        ?.name
                    }
                  </small>
                </td>
                {r.months.map((v, i) => (
                  <td className="num" key={i}>
                    {v ? yen(v) : "-"}
                  </td>
                ))}
                <td className="num">
                  <b>{yen(r.billed)}</b>
                </td>
                <td className="num">{yen(r.paid)}</td>
                <td className="num danger-text">
                  {yen(outstanding(r.billed, r.paid))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

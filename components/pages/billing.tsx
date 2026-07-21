"use client";
import { useMemo, useState } from "react";
import { Check, Edit3, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import {
  Badge,
  CsvButton,
  Kpi,
  Modal,
  PageHeader,
} from "@/components/ui/shared";
import {
  billingKey,
  calculateCharge,
  outstanding,
  paymentStatus,
} from "@/lib/calculations";
import { monthLabel, yen } from "@/lib/format";
import { NumericInput } from "@/components/ui/numeric-input";
import type { MonthlyCharge } from "@/types";
export function BillingPage() {
  const { data, actions } = useApp();
  const [month, setMonth] = useState("2026-04");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<MonthlyCharge | null>(null);
  const list = useMemo(
    () =>
      data.charges.filter(
        (c) =>
          c.billing_month.startsWith(month) &&
          (!filter || c.payment_status === filter),
      ),
    [data.charges, month, filter],
  );
  const billed = list.reduce((s, c) => s + c.billed_amount, 0),
    paid = list.reduce((s, c) => s + c.paid_amount, 0);
  const generate = async () => {
    let made = 0,
      skipped = 0;
    const rows: MonthlyCharge[] = [],
      next = [...data.charges];
    for (const c of data.contracts) {
      const amount = calculateCharge(
        c,
        `${month}-01`,
        data.settings.prorate_enabled,
      );
      if (!amount) continue;
      if (
        next.some(
          (x) =>
            billingKey(x.billing_month, x.contract_id) ===
            billingKey(`${month}-01`, c.id),
        )
      ) {
        skipped++;
        continue;
      }
      const stamp = new Date().toISOString();
      const row: MonthlyCharge = {
        id: crypto.randomUUID(),
        user_id: "demo-user",
        billing_month: `${month}-01`,
        property_id: c.property_id,
        unit_id: c.unit_id,
        contract_id: c.id,
        billed_amount: amount,
        paid_amount: 0,
        payment_date: null,
        payment_status: paymentStatus(amount, 0),
        memo: "",
        created_at: stamp,
        updated_at: stamp,
      };
      next.push(row);
      rows.push(row);
      made++;
    }
    await actions.createMonthlyCharges(rows);
    alert(
      `${made}件生成しました\n${skipped}件は作成済みのためスキップしました`,
    );
  };
  const fullPay = (charge: MonthlyCharge) =>
    void actions.updateMonthlyCharge(charge.id, {
      paid_amount: charge.billed_amount,
      payment_date: new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Tokyo",
      }),
      payment_status: paymentStatus(charge.billed_amount, charge.billed_amount),
      memo: charge.memo.includes("[手動管理]")
        ? charge.memo
        : `${charge.memo}${charge.memo ? " / " : ""}[手動管理]`,
    });
  return (
    <>
      <PageHeader title="請求・入金" description="月次請求の生成と入金消込" />
      <div className="billing-controls">
        <label>
          対象月
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button className="primary" onClick={generate}>
          請求を生成
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">すべての入金状態</option>
          {["未入金", "一部入金", "入金済"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <CsvButton
          filename={`billing-${month}.csv`}
          rows={[
            [
              "請求月",
              "物件",
              "区画",
              "契約者",
              "請求額",
              "入金額",
              "未収額",
              "入金日",
              "状態",
            ],
            ...list.map((c) => [
              month,
              data.properties.find((p) => p.id === c.property_id)?.name || "",
              data.units.find((u) => u.id === c.unit_id)?.name || "",
              data.contracts.find((x) => x.id === c.contract_id)?.tenant_name ||
                "",
              c.billed_amount,
              c.paid_amount,
              outstanding(c.billed_amount, c.paid_amount),
              c.payment_date || "",
              c.payment_status,
            ]),
          ]}
        />
      </div>
      <div className="kpi-grid compact">
        <Kpi label="対象月請求額" value={yen(billed)} />
        <Kpi label="対象月入金額" value={yen(paid)} tone="good" />
        <Kpi
          label="対象月未収額"
          value={yen(outstanding(billed, paid))}
          tone={billed > paid ? "danger" : undefined}
        />
        <Kpi
          label="入金率"
          value={billed ? `${Math.round((paid / billed) * 100)}%` : "-"}
        />
        <Kpi label="請求件数" value={`${list.length}件`} />
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>請求月</th>
              <th>物件・区画</th>
              <th>契約者</th>
              <th className="num">請求額</th>
              <th className="num">入金額</th>
              <th className="num">未収額</th>
              <th>入金日</th>
              <th>状態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{monthLabel(c.billing_month)}</td>
                <td>
                  {data.properties.find((p) => p.id === c.property_id)?.name}
                  <small>
                    {data.units.find((u) => u.id === c.unit_id)?.name}
                  </small>
                </td>
                <td>
                  {
                    data.contracts.find((x) => x.id === c.contract_id)
                      ?.tenant_name
                  }
                </td>
                <td className="num" data-label="請求額">
                  {yen(c.billed_amount)}
                </td>
                <td className="num" data-label="入金額">
                  {yen(c.paid_amount)}
                </td>
                <td className="num danger-text" data-label="未収額">
                  {yen(outstanding(c.billed_amount, c.paid_amount))}
                </td>
                <td>{c.payment_date || "-"}</td>
                <td>
                  <Badge>{c.payment_status}</Badge>
                </td>
                <td className="row-actions">
                  <button onClick={() => fullPay(c)} title="全額入金">
                    <Check />
                  </button>
                  <button onClick={() => setEditing(c)} title="入金編集">
                    <Edit3 />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        c.paid_amount > 0 &&
                        !confirm("入金済みの請求です。本当に削除しますか？")
                      )
                        return;
                      void actions.deleteMonthlyCharge(c.id);
                    }}
                    title="削除"
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <PaymentForm
          charge={editing}
          onClose={() => setEditing(null)}
          onSave={(paidAmount, date, memo) => {
            void actions.updateMonthlyCharge(editing.id, {
              paid_amount: paidAmount,
              payment_date: paidAmount ? date : null,
              payment_status: paymentStatus(editing.billed_amount, paidAmount),
              memo: memo.includes("[手動管理]")
                ? memo
                : `${memo}${memo ? " / " : ""}[手動管理]`,
            });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
function PaymentForm({
  charge,
  onClose,
  onSave,
}: {
  charge: MonthlyCharge;
  onClose: () => void;
  onSave: (n: number, d: string, m: string) => void;
}) {
  const [amount, setAmount] = useState(charge.paid_amount),
    [date, setDate] = useState(
      charge.payment_date || new Date().toLocaleDateString("sv-SE"),
    ),
    [memo, setMemo] = useState(charge.memo);
  return (
    <Modal title="入金を編集" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (amount > charge.billed_amount)
            return alert("入金額は請求額以下にしてください");
          onSave(amount, date, memo);
        }}
      >
        <label>
          入金額
          <NumericInput
            value={amount}
            format="currency"
            decimalScale={0}
            suffix="円"
            onChange={setAmount}
          />
        </label>
        <label>
          入金日
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          メモ
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}

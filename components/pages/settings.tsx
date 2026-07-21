"use client";
import { useMemo, useState } from "react";
import { History, Save } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { NumericInput } from "@/components/ui/numeric-input";
import { PageHeader } from "@/components/ui/shared";
import {
  previewRetroactiveCharges,
  type RetroPaymentMode,
} from "@/lib/retroactive-billing";
import { yen } from "@/lib/format";

export function SettingsPage() {
  const { data, actions, syncState } = useApp(),
    s = data.settings;
  const [throughMonth, setThroughMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [paymentMode, setPaymentMode] = useState<RetroPaymentMode>("unpaid"),
    [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const preview = useMemo(
    () =>
      previewRetroactiveCharges(
        data.contracts,
        data.charges,
        s,
        throughMonth,
        paymentMode,
      ),
    [data.charges, data.contracts, paymentMode, s, throughMonth],
  );
  const patch = actions.updateSettingsLocal;
  return (
    <>
      <PageHeader title="設定" description="請求生成と年間表示の既定値" />
      <section className="panel settings-form">
        <label>
          対象年
          <NumericInput
            value={s.target_year}
            decimalScale={0}
            onChange={(value) => patch({ target_year: value })}
          />
        </label>
        <label className="switch-row">
          <span>
            日割計算<small>開始月と終了月を暦日数で日割りします</small>
          </span>
          <input
            type="checkbox"
            checked={s.prorate_enabled}
            onChange={(e) => patch({ prorate_enabled: e.target.checked })}
          />
        </label>
        <label>
          標準請求日
          <NumericInput
            value={s.default_billing_day}
            decimalScale={0}
            onChange={(value) =>
              patch({ default_billing_day: Math.min(31, Math.max(1, value)) })
            }
          />
        </label>
        <label>
          標準入金期限日
          <NumericInput
            value={s.default_payment_due_day}
            decimalScale={0}
            onChange={(value) =>
              patch({
                default_payment_due_day: Math.min(31, Math.max(1, value)),
              })
            }
          />
        </label>
        <h2>運用開始前の累計額</h2>
        <label>
          運用開始日
          <input
            type="date"
            value={s.operation_start_date ?? ""}
            onChange={(e) =>
              patch({ operation_start_date: e.target.value || null })
            }
          />
        </label>
        <label>
          初期累計額の基準日
          <input
            type="date"
            value={s.opening_balance_through_date ?? ""}
            onChange={(e) =>
              patch({ opening_balance_through_date: e.target.value || null })
            }
          />
          <small>この日までの累計額として扱います</small>
        </label>
        <label>
          運用開始前の累計請求額
          <NumericInput
            value={s.opening_total_billed}
            format="currency"
            decimalScale={0}
            suffix="円"
            onChange={(value) => patch({ opening_total_billed: value })}
          />
        </label>
        <label>
          運用開始前の累計入金額
          <NumericInput
            value={s.opening_total_paid}
            format="currency"
            decimalScale={0}
            suffix="円"
            onChange={(value) => patch({ opening_total_paid: value })}
          />
        </label>
        <div className="warning-box">
          初期累計額の対象期間に過去請求を生成すると二重計上になる可能性があります。基準日を設定すると生成前に警告します。
        </div>
        <div className="settings-actions">
          <span className="save-state">
            {syncState === "saving"
              ? "保存中..."
              : syncState === "saved"
                ? "保存済み"
                : ""}
          </span>
          <button
            className="primary"
            onClick={() => void actions.saveSettings()}
          >
            <Save />
            保存
          </button>
        </div>
      </section>
      <section className="panel settings-form">
        <h2>過去契約から請求履歴を生成</h2>
        <label>
          生成終了月
          <input
            type="month"
            value={throughMonth}
            onChange={(e) => setThroughMonth(e.target.value)}
          />
        </label>
        <label>
          生成時の入金状態
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as RetroPaymentMode)}
          >
            <option value="unpaid">請求のみ生成（未入金）</option>
            <option value="paid">全件入金済み</option>
          </select>
        </label>
        <button className="secondary" onClick={() => setShowPreview(true)}>
          <History />
          生成内容を確認
        </button>
        {showPreview && (
          <div className="retro-preview">
            <dl>
              <dt>対象契約数</dt>
              <dd>{preview.contractCount}件</dd>
              <dt>対象月数</dt>
              <dd>{preview.targetMonthCount}カ月</dd>
              <dt>生成予定</dt>
              <dd>{preview.rows.length}件</dd>
              <dt>請求総額</dt>
              <dd>{yen(preview.totalAmount)}</dd>
              <dt>対象期間</dt>
              <dd>{preview.period}</dd>
              <dt>重複スキップ</dt>
              <dd>{preview.duplicateCount}件</dd>
            </dl>
            {preview.openingBalanceOverlap && (
              <p className="form-error">
                初期累計額の基準日以前を含みます。二重計上にならないか確認してください。
              </p>
            )}
            <div className="settings-actions">
              <button
                className="secondary"
                onClick={() => setShowPreview(false)}
              >
                キャンセル
              </button>
              <button
                className="primary"
                disabled={!preview.rows.length}
                onClick={async () => {
                  if (
                    !confirm(
                      `${preview.rows.length}件を生成します。よろしいですか？`,
                    )
                  )
                    return;
                  await actions.createMonthlyCharges(preview.rows);
                  setResult(
                    `${preview.rows.length}件、${yen(preview.totalAmount)}を生成しました`,
                  );
                  setShowPreview(false);
                }}
              >
                生成する
              </button>
            </div>
          </div>
        )}
        {result && <p className="success-box">{result}</p>}
      </section>
    </>
  );
}

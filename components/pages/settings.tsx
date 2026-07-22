"use client";
import { useMemo, useState } from "react";
import { History, Pencil, Save, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { NumericInput } from "@/components/ui/numeric-input";
import { Modal, PageHeader } from "@/components/ui/shared";
import {
  previewRetroactiveCharges,
  type RetroPaymentMode,
} from "@/lib/retroactive-billing";
import { yen } from "@/lib/format";
import type { BankAccountMaster, GuaranteeCompanyMaster } from "@/types";

const guaranteeBlank = {
  name: "", contact_name: "", phone: "", email: "", notes: "",
  display_order: 0, is_active: true, renewal_cycle_months: 24 as number | null,
  renewal_fee: 0, contract_number_default: "", url: "",
};
const bankBlank = {
  account_name: "", bank_name: "", bank_code: "", branch_name: "",
  branch_code: "", account_type: "普通", account_number: "",
  account_holder: "", notes: "", display_order: 0, is_active: true,
};

export function SettingsPage() {
  const { data, actions, syncState } = useApp(),
    s = data.settings;
  const [throughMonth, setThroughMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [paymentMode, setPaymentMode] = useState<RetroPaymentMode>("unpaid"),
    [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [guaranteeEditing, setGuaranteeEditing] = useState<GuaranteeCompanyMaster | "new" | null>(null);
  const [bankEditing, setBankEditing] = useState<BankAccountMaster | "new" | null>(null);
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
        <div className="info-box">契約開始月は開始日から月末まで自動で日割りします。終了月は満額請求です。</div>
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
      <MasterSection
        title="保証会社マスタ"
        rows={data.guaranteeCompanyMasters.map((x) => ({ id: x.id, name: x.name, sub: `${x.contact_name || "担当者未設定"} / ${x.phone || "電話未設定"}`, active: x.is_active }))}
        onNew={() => setGuaranteeEditing("new")}
        onEdit={(id) => setGuaranteeEditing(data.guaranteeCompanyMasters.find((x) => x.id === id) ?? null)}
        onDelete={(id) => confirm("この保証会社マスタを削除しますか？過去契約の内容は残ります。") && void actions.deleteGuaranteeCompanyMaster(id)}
      />
      <MasterSection
        title="振込口座マスタ"
        rows={data.bankAccountMasters.map((x) => ({ id: x.id, name: x.account_name, sub: `${x.bank_name} ${x.branch_name} / ****${x.account_number.slice(-4)}`, active: x.is_active }))}
        onNew={() => setBankEditing("new")}
        onEdit={(id) => setBankEditing(data.bankAccountMasters.find((x) => x.id === id) ?? null)}
        onDelete={(id) => confirm("この口座マスタを削除しますか？過去契約の内容は残ります。") && void actions.deleteBankAccountMaster(id)}
      />
      {guaranteeEditing && (
        <GuaranteeMasterForm
          initial={guaranteeEditing === "new" ? guaranteeBlank : guaranteeEditing}
          onClose={() => setGuaranteeEditing(null)}
          onSave={async (form) => {
            const now = new Date().toISOString();
            if (guaranteeEditing === "new") await actions.createGuaranteeCompanyMaster({ ...form, id: crypto.randomUUID(), user_id: "", created_at: now, updated_at: now });
            else await actions.updateGuaranteeCompanyMaster(guaranteeEditing.id, { ...form, updated_at: now });
            setGuaranteeEditing(null);
          }}
        />
      )}
      {bankEditing && (
        <BankMasterForm
          initial={bankEditing === "new" ? bankBlank : bankEditing}
          onClose={() => setBankEditing(null)}
          onSave={async (form) => {
            const now = new Date().toISOString();
            if (bankEditing === "new") await actions.createBankAccountMaster({ ...form, id: crypto.randomUUID(), user_id: "", created_at: now, updated_at: now });
            else await actions.updateBankAccountMaster(bankEditing.id, { ...form, updated_at: now });
            setBankEditing(null);
          }}
        />
      )}
    </>
  );
}

function MasterSection({ title, rows, onNew, onEdit, onDelete }: {
  title: string; rows: { id: string; name: string; sub: string; active: boolean }[];
  onNew: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
}) {
  return <section className="panel"><div className="section-head"><h2>{title}</h2><button className="primary" onClick={onNew}>新規登録</button></div>
    {!rows.length ? <p className="empty">登録はありません</p> : <div className="simple-list">{rows.map((row) => <div key={row.id}><span><b>{row.name}</b><small>{row.sub} / {row.active ? "有効" : "無効"}</small></span><span className="row-actions"><button onClick={() => onEdit(row.id)} title="編集"><Pencil /></button><button onClick={() => onDelete(row.id)} title="削除"><Trash2 /></button></span></div>)}</div>}
  </section>;
}

function GuaranteeMasterForm({ initial, onClose, onSave }: { initial: typeof guaranteeBlank; onClose: () => void; onSave: (form: typeof guaranteeBlank) => void }) {
  const [f, setF] = useState(initial);
  return <Modal title="保証会社マスタ" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return alert("名称は必須です"); onSave(f); }}><div className="form-grid">
    <label>名称<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <label>担当者名<input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></label>
    <label>電話番号<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
    <label>メールアドレス<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
    <label>URL<input type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
    <label>表示順<NumericInput value={f.display_order} onChange={(value) => setF({ ...f, display_order: value })} /></label>
    <label>更新周期（月）<NumericInput value={f.renewal_cycle_months ?? 0} onChange={(value) => setF({ ...f, renewal_cycle_months: value || null })} /></label>
    <label>更新料<NumericInput value={f.renewal_fee} format="currency" suffix="円" onChange={(value) => setF({ ...f, renewal_fee: value })} /></label>
    <label>契約番号初期値<input value={f.contract_number_default} onChange={(e) => setF({ ...f, contract_number_default: e.target.value })} /></label>
    <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />有効</label>
    <label className="form-span">備考<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
  </div><FormActions onClose={onClose} /></form></Modal>;
}

function BankMasterForm({ initial, onClose, onSave }: { initial: typeof bankBlank; onClose: () => void; onSave: (form: typeof bankBlank) => void }) {
  const [f, setF] = useState(initial);
  return <Modal title="振込口座マスタ" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (!f.account_name.trim()) return alert("口座名は必須です"); onSave(f); }}><div className="form-grid">
    <label>口座名<input value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></label>
    <label>金融機関名<input value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></label>
    <label>金融機関コード<input value={f.bank_code} onChange={(e) => setF({ ...f, bank_code: e.target.value })} /></label>
    <label>支店名<input value={f.branch_name} onChange={(e) => setF({ ...f, branch_name: e.target.value })} /></label>
    <label>支店コード<input value={f.branch_code} onChange={(e) => setF({ ...f, branch_code: e.target.value })} /></label>
    <label>口座種別<select value={f.account_type} onChange={(e) => setF({ ...f, account_type: e.target.value })}><option>普通</option><option>当座</option><option>貯蓄</option><option>その他</option></select></label>
    <label>口座番号<input inputMode="numeric" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} /></label>
    <label>口座名義<input value={f.account_holder} onChange={(e) => setF({ ...f, account_holder: e.target.value })} /></label>
    <label>表示順<NumericInput value={f.display_order} onChange={(value) => setF({ ...f, display_order: value })} /></label>
    <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />有効</label>
    <label className="form-span">備考<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
  </div><FormActions onClose={onClose} /></form></Modal>;
}
function FormActions({ onClose }: { onClose: () => void }) {
  return <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>キャンセル</button><button className="primary">保存</button></div>;
}

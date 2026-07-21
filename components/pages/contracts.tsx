"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, Eye, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Badge, CsvButton, Modal, PageHeader, RecordSaveStatus } from "@/components/ui/shared";
import { NumericInput } from "@/components/ui/numeric-input";
import { effectiveContractStatus, outstanding } from "@/lib/calculations";
import { dateLabel, yen } from "@/lib/format";
import {
  previewRetroactiveCharges,
  type RetroPaymentMode,
} from "@/lib/retroactive-billing";
import type { Contract, ContractStatus, ContractType } from "@/types";
const blank = {
  contract_code: "",
  property_id: "",
  unit_id: "",
  tenant_name: "",
  tenant_phone: "",
  tenant_email: "",
  tenant_address: "",
  start_date: "",
  end_date: "",
  monthly_rent: 0,
  key_money: 0,
  free_rent_months: 0,
  billing_day: 1,
  payment_due_day: 31,
  contract_type: "継続" as ContractType,
  status: "契約中" as ContractStatus,
  deposit_amount: 0,
  renewal_date: "",
  termination_reason: "",
  renewal_method: "",
  auto_renew: false,
  requires_recontract: false,
  renewal_cycle_months: 24 as number | null,
  renewal_fee: 0,
  guarantor_enabled: false,
  guarantor_company_name: "",
  guarantor_contract_number: "",
  guarantor_start_date: "",
  guarantor_end_date: "",
  guarantor_renewal_date: "",
  guarantor_fee: 0,
  guarantor_notes: "",
  bank_name: "",
  bank_branch: "",
  bank_account_type: "普通",
  bank_account_number: "",
  bank_account_holder: "",
  transfer_name: "",
  cancellation_notice_date: "",
  cancellation_planned_date: "",
  cancellation_completed_date: "",
  restoration_cost: 0,
  deposit_refund: 0,
  cancellation_notes: "",
  notes: "",
};
type Form = typeof blank;
export function ContractsPage() {
  const { data, actions, currentUserId } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Contract | null | "new">(null);
  const [newTemplate, setNewTemplate] = useState<Form | null>(null);
  const [pendingBackfill, setPendingBackfill] = useState<Contract | null>(null);
  const [newCode, setNewCode] = useState("");
  const list = data.contracts.filter(
    (c) => c.tenant_name.includes(query) || c.contract_code.includes(query),
  );
  const save = async (f: Form) => {
    f = { ...f, contract_code: f.contract_code.trim().toUpperCase() };
    if (f.cancellation_completed_date) {
      f = {
        ...f,
        end_date: f.end_date || f.cancellation_completed_date,
        status: "解約",
      };
    } else if (f.cancellation_planned_date && !f.end_date) {
      f = { ...f, end_date: f.cancellation_planned_date, status: "終了予定" };
    }
    if (!f.contract_code)
      f.contract_code = await actions.nextCode(
        "contract",
        undefined,
        Number(f.start_date.slice(0, 4)) || new Date().getFullYear(),
      );
    if (!f.contract_code || !f.tenant_name || !f.start_date)
      return alert("契約コード、契約者、開始日は必須です");
    if (f.end_date && f.end_date < f.start_date)
      return alert("終了日は開始日以降にしてください");
    const unit = data.units.find((u) => u.id === f.unit_id);
    if (!unit || unit.property_id !== f.property_id)
      return alert("物件と区画の組み合わせが正しくありません");
    const overlap = data.contracts.some(
      (c) =>
        c.id !== (editing as Contract)?.id &&
        c.unit_id === f.unit_id &&
        !["終了", "解約", "下書き"].includes(c.status) &&
        c.start_date <= (f.end_date || "9999-12-31") &&
        (c.end_date || "9999-12-31") >= f.start_date,
    );
    if (
      overlap &&
      !confirm("この区画には同じ期間の契約が存在します。登録を続けますか？")
    )
      return;
    const stamp = new Date().toISOString(),
      value = {
        ...f,
        tenant_phone: f.tenant_phone || null,
        tenant_email: f.tenant_email || null,
        tenant_address: f.tenant_address || null,
        end_date: f.end_date || null,
        renewal_date: f.renewal_date || null,
        guarantor_start_date: f.guarantor_start_date || null,
        guarantor_end_date: f.guarantor_end_date || null,
        guarantor_renewal_date: f.guarantor_renewal_date || null,
        cancellation_notice_date: f.cancellation_notice_date || null,
        cancellation_planned_date: f.cancellation_planned_date || null,
        cancellation_completed_date: f.cancellation_completed_date || null,
      };
    if (editing === "new") {
      const created = {
        ...value,
        id: crypto.randomUUID(),
        user_id: currentUserId,
        created_at: stamp,
        updated_at: stamp,
      } as Contract;
      await actions.createContract(created);
      setNewTemplate(null);
      const currentMonth = new Date()
        .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 7);
      if (created.start_date.slice(0, 7) < currentMonth)
        setPendingBackfill(created);
    } else
      await actions.updateContract((editing as Contract).id, {
        ...value,
        updated_at: stamp,
      });
    setEditing(null);
  };
  return (
    <>
      <PageHeader
        title="契約"
        description="契約履歴と未収状況を管理"
        action={() => {
          setNewTemplate(null);
          void actions
            .nextCode("contract", undefined, new Date().getFullYear())
            .then((code) => {
              setNewCode(code);
              setEditing("new");
            });
        }}
      />
      <div className="toolbar">
        <label className="search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="契約者・契約コードで検索"
          />
        </label>
        <CsvButton
          filename="contracts.csv"
          rows={[
            [
              "契約コード",
              "契約者",
              "物件",
              "区画",
              "開始日",
              "終了日",
              "月額賃料",
              "種別",
              "状態",
              "銀行名",
              "支店",
              "口座末尾4桁",
            ],
            ...list.map((c) => [
              c.contract_code,
              c.tenant_name,
              data.properties.find((p) => p.id === c.property_id)?.name || "",
              data.units.find((u) => u.id === c.unit_id)?.name || "",
              c.start_date,
              c.end_date || "",
              c.monthly_rent,
              c.contract_type,
              c.status,
              c.bank_name,
              c.bank_branch,
              c.bank_account_number.slice(-4),
            ]),
          ]}
        />
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>契約</th>
              <th>契約者</th>
              <th>物件・区画</th>
              <th>期間</th>
              <th className="num">月額賃料</th>
              <th>状態</th>
              <th className="num">今月請求額</th>
              <th className="num">今月入金額</th>
              <th className="num">未収</th>
              <th>振込先</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const currentMonth = new Date()
                  .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
                  .slice(0, 7),
                charges = data.charges.filter(
                  (x) =>
                    x.contract_id === c.id &&
                    x.billing_month.startsWith(currentMonth),
                ),
                b = charges.reduce((s, x) => s + x.billed_amount, 0),
                p = charges.reduce((s, x) => s + x.paid_amount, 0);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.contract_code}</b>
                    <small>{c.contract_type}</small>
                    <RecordSaveStatus recordKey={`contract:${c.id}`} />
                  </td>
                  <td>{c.tenant_name}</td>
                  <td>
                    {data.properties.find((p) => p.id === c.property_id)?.name}
                    <small>
                      {data.units.find((u) => u.id === c.unit_id)?.name}
                    </small>
                  </td>
                  <td>
                    {dateLabel(c.start_date)}
                    <small>〜 {dateLabel(c.end_date)}</small>
                  </td>
                  <td className="num" data-label="月額賃料">
                    {yen(c.monthly_rent)}
                  </td>
                  <td>
                    <Badge>{effectiveContractStatus(c)}</Badge>
                  </td>
                  <td className="num" data-label="今月請求額">
                    {yen(b)}
                  </td>
                  <td className="num" data-label="今月入金額">
                    {yen(p)}
                  </td>
                  <td className="num danger-text" data-label="未収額">
                    {yen(outstanding(b, p))}
                  </td>
                  <td>
                    {c.bank_name || "-"}
                    <small>
                      {c.bank_branch || "-"} /{" "}
                      {c.bank_account_number
                        ? `****${c.bank_account_number.slice(-4)}`
                        : "-"}
                    </small>
                  </td>
                  <td className="row-actions">
                    <Link href={`/contracts/${c.id}`} title="詳細">
                      <Eye />
                    </Link>
                    <button onClick={() => setEditing(c)} title="編集">
                      <Pencil />
                    </button>
                    <button
                      title="複製"
                      onClick={() => {
                        void actions
                          .nextCode("contract", undefined, new Date().getFullYear())
                          .then((code) => {
                            setNewCode(code);
                            setNewTemplate({
                              ...contractToForm(c),
                              contract_code: code,
                            });
                            setEditing("new");
                          });
                      }}
                    >
                      <Copy />
                    </button>
                    <button
                      title="請求履歴をリセット"
                      onClick={() => {
                        const charges = data.charges.filter(
                          (charge) => charge.contract_id === c.id,
                        );
                        const billed = charges.reduce(
                          (sum, charge) => sum + charge.billed_amount,
                          0,
                        );
                        if (
                          charges.length > 0 &&
                          confirm(
                            `${c.tenant_name}の請求履歴${charges.length}件（${yen(billed)}）を削除しますか？\n累計請求・累計入金からも除外されます。`,
                          )
                        )
                          void actions.deleteContractCharges(c.id);
                      }}
                    >
                      <RotateCcw />
                    </button>
                    <button
                      onClick={() => {
                        const charges = data.charges.filter(
                          (charge) => charge.contract_id === c.id,
                        );
                        const related = charges.length
                          ? `\n\n関連する請求 ${charges.length}件も削除されます。`
                          : "";
                        if (
                          confirm(
                            `${c.contract_code}（${c.tenant_name}）を削除しますか？${related}\n通常の契約終了ではなく、履歴を完全に削除します。`,
                          )
                        )
                          void actions.deleteContract(c.id);
                      }}
                      title="契約履歴を削除"
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <ContractForm
          isNew={editing === "new"}
          initial={
            editing === "new"
              ? {
                  ...(newTemplate ?? blank),
                  contract_code: newCode,
                  property_id:
                    newTemplate?.property_id || data.properties[0]?.id || "",
                  unit_id: newTemplate?.unit_id || data.units[0]?.id || "",
                }
              : contractToForm(editing)
          }
          properties={data.properties}
          units={data.units}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {pendingBackfill && (
        <ContractBackfillModal
          contract={pendingBackfill}
          charges={data.charges}
          settings={data.settings}
          onClose={() => setPendingBackfill(null)}
          onCreate={async (rows) => {
            await actions.createMonthlyCharges(rows);
            setPendingBackfill(null);
            alert(`${rows.length}件の過去請求を一括処理しました`);
          }}
        />
      )}
    </>
  );
}

function contractToForm(contract: Contract): Form {
  return {
    ...contract,
    tenant_phone: contract.tenant_phone || "",
    tenant_email: contract.tenant_email || "",
    tenant_address: contract.tenant_address || "",
    end_date: contract.end_date || "",
    renewal_date: contract.renewal_date || "",
    guarantor_start_date: contract.guarantor_start_date || "",
    guarantor_end_date: contract.guarantor_end_date || "",
    guarantor_renewal_date: contract.guarantor_renewal_date || "",
    cancellation_notice_date: contract.cancellation_notice_date || "",
    cancellation_planned_date: contract.cancellation_planned_date || "",
    cancellation_completed_date: contract.cancellation_completed_date || "",
  };
}

function ContractBackfillModal({
  contract,
  charges,
  settings,
  onClose,
  onCreate,
}: {
  contract: Contract;
  charges: ReturnType<typeof useApp>["data"]["charges"];
  settings: ReturnType<typeof useApp>["data"]["settings"];
  onClose: () => void;
  onCreate: (rows: ReturnType<typeof previewRetroactiveCharges>["rows"]) => Promise<void>;
}) {
  const currentMonth = new Date()
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .slice(0, 7);
  const [paymentMode, setPaymentMode] = useState<RetroPaymentMode>("paid");
  const preview = previewRetroactiveCharges(
    [contract],
    charges,
    settings,
    currentMonth,
    paymentMode,
  );
  return (
    <Modal title="過去分を一括処理" onClose={onClose}>
      <p>
        {contract.tenant_name}の契約開始月から今月まで、請求履歴を生成しますか？
      </p>
      <div className="form-grid">
        <label>
          入金状態
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as RetroPaymentMode)}
          >
            <option value="paid">全件入金済み</option>
            <option value="unpaid">全件未入金</option>
          </select>
        </label>
      </div>
      <div className="retro-preview">
        <dl>
          <dt>対象期間</dt><dd>{preview.period}</dd>
          <dt>生成件数</dt><dd>{preview.rows.length}件</dd>
          <dt>請求総額</dt><dd>{yen(preview.totalAmount)}</dd>
          <dt>重複スキップ</dt><dd>{preview.duplicateCount}件</dd>
        </dl>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>今はしない</button>
        <button
          type="button"
          className="primary"
          disabled={!preview.rows.length}
          onClick={() => void onCreate(preview.rows)}
        >
          一括処理する
        </button>
      </div>
    </Modal>
  );
}
function ContractForm({
  isNew,
  initial,
  properties,
  units,
  onClose,
  onSave,
}: {
  isNew: boolean;
  initial: Form;
  properties: { id: string; name: string }[];
  units: { id: string; property_id: string; name: string }[];
  onClose: () => void;
  onSave: (x: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const available = units.filter((u) => u.property_id === f.property_id);
  return (
    <Modal title={isNew ? "契約を登録" : "契約を編集"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          <label>
            契約コード
            <input
              value={f.contract_code}
              onChange={(e) => setF({ ...f, contract_code: e.target.value })}
            />
          </label>
          <label>
            契約者
            <input
              value={f.tenant_name}
              onChange={(e) => setF({ ...f, tenant_name: e.target.value })}
            />
          </label>
          <label>
            物件
            <select
              value={f.property_id}
              onChange={(e) => {
                const property_id = e.target.value;
                setF({
                  ...f,
                  property_id,
                  unit_id:
                    units.find((u) => u.property_id === property_id)?.id || "",
                });
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            区画
            <select
              value={f.unit_id}
              onChange={(e) => setF({ ...f, unit_id: e.target.value })}
            >
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            開始日
            <input
              type="date"
              value={f.start_date}
              onChange={(e) => setF({ ...f, start_date: e.target.value })}
            />
          </label>
          <label>
            終了日
            <input
              type="date"
              value={f.end_date}
              onChange={(e) => {
                const end_date = e.target.value;
                setF({
                  ...f,
                  end_date,
                  renewal_date:
                    !f.renewal_date || f.renewal_date === f.end_date
                      ? end_date
                      : f.renewal_date,
                });
              }}
            />
          </label>
          <label>
            月額賃料
            <NumericInput
              value={f.monthly_rent}
              format="currency"
              decimalScale={0}
              suffix="円"
              onChange={(value) => setF({ ...f, monthly_rent: value })}
            />
          </label>
          <label>
            礼金（家賃収入）
            <NumericInput
              value={f.key_money}
              format="currency"
              decimalScale={0}
              suffix="円"
              onChange={(value) => setF({ ...f, key_money: value })}
            />
          </label>
          <label>
            敷金（預かり金）
            <NumericInput
              value={f.deposit_amount}
              format="currency"
              decimalScale={0}
              suffix="円"
              onChange={(value) => setF({ ...f, deposit_amount: value })}
            />
          </label>
          <label>
            フリーレント（月数）
            <NumericInput
              value={f.free_rent_months}
              decimalScale={0}
              suffix="か月"
              onChange={(value) =>
                setF({ ...f, free_rent_months: Math.max(0, value) })
              }
            />
          </label>
          <label>
            毎月の請求日（自動生成）
            <NumericInput
              value={f.billing_day}
              decimalScale={0}
              onChange={(value) =>
                setF({
                  ...f,
                  billing_day: Math.min(31, Math.max(1, value)),
                })
              }
            />
          </label>
          <label>
            更新日
            <input
              type="date"
              value={f.renewal_date}
              onChange={(e) => setF({ ...f, renewal_date: e.target.value })}
            />
          </label>
          <h3 className="form-section-title">更新条件</h3>
          <label>
            更新方式
            <input
              value={f.renewal_method}
              onChange={(e) => setF({ ...f, renewal_method: e.target.value })}
              placeholder="例: 1年ごとの自動更新"
            />
          </label>
          <label>
            更新周期（月）
            <NumericInput
              value={f.renewal_cycle_months ?? 0}
              decimalScale={0}
              onChange={(value) =>
                setF({ ...f, renewal_cycle_months: value || null })
              }
            />
          </label>
          <label>
            更新料
            <NumericInput
              value={f.renewal_fee}
              format="currency"
              suffix="円"
              onChange={(value) => setF({ ...f, renewal_fee: value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.auto_renew}
              onChange={(e) => setF({ ...f, auto_renew: e.target.checked })}
            />
            自動更新
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.requires_recontract}
              onChange={(e) =>
                setF({ ...f, requires_recontract: e.target.checked })
              }
            />
            要再契約
          </label>
          <h3 className="form-section-title">保証会社</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={f.guarantor_enabled}
              onChange={(e) =>
                setF({ ...f, guarantor_enabled: e.target.checked })
              }
            />
            保証会社を利用
          </label>
          <label>
            保証会社名
            <input
              value={f.guarantor_company_name}
              onChange={(e) =>
                setF({ ...f, guarantor_company_name: e.target.value })
              }
            />
          </label>
          <label>
            保証契約番号
            <input
              value={f.guarantor_contract_number}
              onChange={(e) =>
                setF({ ...f, guarantor_contract_number: e.target.value })
              }
            />
          </label>
          <label>
            保証開始日
            <input
              type="date"
              value={f.guarantor_start_date}
              onChange={(e) =>
                setF({ ...f, guarantor_start_date: e.target.value })
              }
            />
          </label>
          <label>
            保証終了日
            <input
              type="date"
              value={f.guarantor_end_date}
              onChange={(e) =>
                setF({ ...f, guarantor_end_date: e.target.value })
              }
            />
          </label>
          <label>
            保証会社更新日
            <input
              type="date"
              value={f.guarantor_renewal_date}
              onChange={(e) =>
                setF({ ...f, guarantor_renewal_date: e.target.value })
              }
            />
          </label>
          <label>
            保証料
            <NumericInput
              value={f.guarantor_fee}
              format="currency"
              suffix="円"
              onChange={(value) => setF({ ...f, guarantor_fee: value })}
            />
          </label>
          <label className="form-span">
            保証会社メモ
            <textarea
              value={f.guarantor_notes}
              onChange={(e) => setF({ ...f, guarantor_notes: e.target.value })}
            />
          </label>
          <h3 className="form-section-title">振込先口座</h3>
          <label>
            銀行
            <input
              value={f.bank_name}
              onChange={(e) => setF({ ...f, bank_name: e.target.value })}
            />
          </label>
          <label>
            支店
            <input
              value={f.bank_branch}
              onChange={(e) => setF({ ...f, bank_branch: e.target.value })}
            />
          </label>
          <label>
            口座種別
            <select
              value={f.bank_account_type}
              onChange={(e) =>
                setF({ ...f, bank_account_type: e.target.value })
              }
            >
              <option>普通</option>
              <option>当座</option>
              <option>貯蓄</option>
              <option>その他</option>
            </select>
          </label>
          <label>
            口座番号
            <input
              inputMode="numeric"
              value={f.bank_account_number}
              onChange={(e) =>
                setF({
                  ...f,
                  bank_account_number: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label>
            口座名義
            <input
              value={f.bank_account_holder}
              onChange={(e) =>
                setF({ ...f, bank_account_holder: e.target.value })
              }
            />
          </label>
          <label>
            振込名義
            <input
              value={f.transfer_name}
              onChange={(e) => setF({ ...f, transfer_name: e.target.value })}
            />
          </label>
          <h3 className="form-section-title">解約管理</h3>
          <label>
            解約通知日
            <input
              type="date"
              value={f.cancellation_notice_date}
              onChange={(e) =>
                setF({ ...f, cancellation_notice_date: e.target.value })
              }
            />
          </label>
          <label>
            解約予定日
            <input
              type="date"
              value={f.cancellation_planned_date}
              onChange={(e) =>
                setF({ ...f, cancellation_planned_date: e.target.value })
              }
            />
          </label>
          <label>
            解約完了日
            <input
              type="date"
              value={f.cancellation_completed_date}
              onChange={(e) =>
                setF({ ...f, cancellation_completed_date: e.target.value })
              }
            />
          </label>
          <label>
            原状回復費
            <NumericInput
              value={f.restoration_cost}
              format="currency"
              suffix="円"
              onChange={(value) => setF({ ...f, restoration_cost: value })}
            />
          </label>
          <label>
            保証金返還
            <NumericInput
              value={f.deposit_refund}
              format="currency"
              suffix="円"
              onChange={(value) => setF({ ...f, deposit_refund: value })}
            />
          </label>
          <label className="form-span">
            解約備考
            <textarea
              value={f.cancellation_notes}
              onChange={(e) =>
                setF({ ...f, cancellation_notes: e.target.value })
              }
            />
          </label>
          <label>
            状態
            <select
              value={f.status}
              onChange={(e) =>
                setF({ ...f, status: e.target.value as ContractStatus })
              }
            >
              {["契約中", "終了予定", "終了", "解約", "下書き"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            終了理由
            <select
              value={f.termination_reason}
              onChange={(e) =>
                setF({ ...f, termination_reason: e.target.value })
              }
            >
              <option value="">未設定</option>
              <option>更新による終了</option>
              <option>退去</option>
              <option>解約</option>
              <option>その他</option>
            </select>
          </label>
          <label>
            契約種別
            <select
              value={f.contract_type}
              onChange={(e) =>
                setF({ ...f, contract_type: e.target.value as ContractType })
              }
            >
              {["継続", "定期", "短期", "その他"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            毎月の入金予定日（自動入金）
            <NumericInput
              value={f.payment_due_day}
              decimalScale={0}
              onChange={(value) =>
                setF({
                  ...f,
                  payment_due_day: Math.min(31, Math.max(1, value)),
                })
              }
            />
          </label>
        </div>
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

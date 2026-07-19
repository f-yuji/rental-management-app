"use client";
import { useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Badge, CsvButton, Modal, PageHeader } from "@/components/ui/shared";
import { outstanding } from "@/lib/calculations";
import { dateLabel, yen } from "@/lib/format";
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
  billing_day: 1,
  payment_due_day: 31,
  contract_type: "継続" as ContractType,
  status: "契約中" as ContractStatus,
  deposit_amount: 0,
  renewal_date: "",
  notes: "",
};
type Form = typeof blank;
export function ContractsPage() {
  const { data, setData } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Contract | null | "new">(null);
  const list = data.contracts.filter(
    (c) => c.tenant_name.includes(query) || c.contract_code.includes(query),
  );
  const save = (f: Form) => {
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
      };
    setData((d) => ({
      ...d,
      contracts:
        editing === "new"
          ? [
              ...d.contracts,
              {
                ...value,
                id: crypto.randomUUID(),
                user_id: "demo-user",
                created_at: stamp,
                updated_at: stamp,
              },
            ]
          : d.contracts.map((c) =>
              c.id === (editing as Contract).id
                ? { ...c, ...value, updated_at: stamp }
                : c,
            ),
    }));
    setEditing(null);
  };
  return (
    <>
      <PageHeader
        title="契約"
        description="契約履歴と未収状況を管理"
        action={() => setEditing("new")}
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
              <th className="num">累計請求</th>
              <th className="num">未収</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const charges = data.charges.filter(
                  (x) => x.contract_id === c.id,
                ),
                b = charges.reduce((s, x) => s + x.billed_amount, 0),
                p = charges.reduce((s, x) => s + x.paid_amount, 0);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.contract_code}</b>
                    <small>{c.contract_type}</small>
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
                  <td className="num">{yen(c.monthly_rent)}</td>
                  <td>
                    <Badge>{c.status}</Badge>
                  </td>
                  <td className="num">{yen(b)}</td>
                  <td className="num danger-text">{yen(outstanding(b, p))}</td>
                  <td className="row-actions">
                    <button onClick={() => setEditing(c)} title="編集">
                      <Pencil />
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
                          setData((d) => ({
                            ...d,
                            contracts: d.contracts.filter(
                              (x) => x.id !== c.id,
                            ),
                            charges: d.charges.filter(
                              (x) => x.contract_id !== c.id,
                            ),
                          }));
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
          initial={
            editing === "new"
              ? {
                  ...blank,
                  property_id: data.properties[0]?.id || "",
                  unit_id: data.units[0]?.id || "",
                }
              : {
                  ...editing,
                  tenant_phone: editing.tenant_phone || "",
                  tenant_email: editing.tenant_email || "",
                  tenant_address: editing.tenant_address || "",
                  end_date: editing.end_date || "",
                  renewal_date: editing.renewal_date || "",
                }
          }
          properties={data.properties}
          units={data.units}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
function ContractForm({
  initial,
  properties,
  units,
  onClose,
  onSave,
}: {
  initial: Form;
  properties: { id: string; name: string }[];
  units: { id: string; property_id: string; name: string }[];
  onClose: () => void;
  onSave: (x: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const available = units.filter((u) => u.property_id === f.property_id);
  return (
    <Modal
      title={f.contract_code ? "契約を編集" : "契約を登録"}
      onClose={onClose}
    >
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
              onChange={(e) => setF({ ...f, end_date: e.target.value })}
            />
          </label>
          <label>
            月額賃料
            <input
              type="number"
              min="0"
              value={f.monthly_rent}
              onChange={(e) =>
                setF({ ...f, monthly_rent: Number(e.target.value) })
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
            入金期限日
            <input
              type="number"
              min="1"
              max="31"
              value={f.payment_due_day}
              onChange={(e) =>
                setF({ ...f, payment_due_day: Number(e.target.value) })
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

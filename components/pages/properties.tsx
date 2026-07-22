"use client";
import { useState } from "react";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { CsvButton, Modal, PageHeader, RecordSaveStatus } from "@/components/ui/shared";
import { NumericInput } from "@/components/ui/numeric-input";
import { effectiveContractStatus, grossYield, totalInvestment } from "@/lib/calculations";
import { percent, yen } from "@/lib/format";
import type { Property } from "@/types";
const blank = {
  property_code: "",
  name: "",
  property_type: "資材置き場",
  address: "",
  acquisition_date: "",
  acquisition_price: 0,
  acquisition_costs: 0,
  development_costs: 0,
  current_valuation: 0,
  estimated_sale_price: null as number | null,
  estimated_sale_price_updated_at: "",
  estimated_sale_price_notes: "",
  remaining_debt: 0,
  annual_property_tax: 0,
  notes: "",
};
type Form = typeof blank;
export function PropertiesPage() {
  const { data, actions, currentUserId } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Property | null | "new">(null);
  const [newCode, setNewCode] = useState("");
  const list = data.properties.filter((p) =>
    (p.name + p.address + p.property_code).includes(query),
  );
  const save = async (form: Form) => {
    form = { ...form, property_code: form.property_code.trim().toUpperCase() };
    if (!form.property_code)
      form.property_code = await actions.nextCode("property");
    if (!form.property_code.trim() || !form.name.trim())
      return alert("物件コードと物件名は必須です");
    if (
      data.properties.some(
        (p) =>
          p.property_code === form.property_code &&
          p.id !== (editing as Property)?.id,
      )
    )
      return alert("この物件コードは使用済みです");
    const stamp = new Date().toISOString();
    if (editing === "new")
      await actions.createProperty({
        ...form,
        acquisition_date: form.acquisition_date || null,
        estimated_sale_price_updated_at:
          form.estimated_sale_price_updated_at || null,
        id: crypto.randomUUID(),
        user_id: currentUserId,
        created_at: stamp,
        updated_at: stamp,
      });
    else
      await actions.updateProperty((editing as Property).id, {
        ...form,
        acquisition_date: form.acquisition_date || null,
        estimated_sale_price_updated_at:
          form.estimated_sale_price_updated_at || null,
        updated_at: stamp,
      });
    setEditing(null);
  };
  const remove = (p: Property) => {
    const units = data.units.filter((u) => u.property_id === p.id),
      contracts = data.contracts.filter((c) => c.property_id === p.id),
      charges = data.charges.filter((c) => c.property_id === p.id);
    const details =
      units.length || contracts.length || charges.length
        ? `\n\n関連する区画 ${units.length}件、契約 ${contracts.length}件、請求 ${charges.length}件も削除されます。`
        : "";
    if (
      confirm(`${p.name}を削除しますか？${details}\nこの操作は元に戻せません。`)
    )
      void actions.deleteProperty(p.id);
  };
  return (
    <>
      <PageHeader
        title="物件"
        description={`${data.properties.length}件の資産を管理`}
        action={() => {
          void actions.nextCode("property").then((code) => {
            setNewCode(code);
            setEditing("new");
          });
        }}
      />
      <div className="toolbar">
        <label className="search">
          <Search />
          <input
            placeholder="物件名・所在地で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <CsvButton
          filename="properties.csv"
          rows={[
            ["物件コード", "物件名", "種別", "所在地", "取得総額", "固定資産評価額", "想定売却価格"],
            ...list.map((p) => [
              p.property_code,
              p.name,
              p.property_type,
              p.address,
              totalInvestment(p),
              p.current_valuation,
              p.estimated_sale_price ?? "",
            ]),
          ]}
        />
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>物件</th>
              <th>種別・所在地</th>
              <th className="num">現在月収</th>
              <th className="num">満室月収</th>
              <th className="num">総投資額</th>
              <th className="num">年間賃料</th>
              <th className="num">取得価格</th>
              <th className="num">固定資産評価額</th>
              <th className="num">年間固定資産税</th>
              <th className="num">想定売却価格</th>
              <th className="num">累計入金額</th>
              <th className="num">回収率</th>
              <th className="num">表面利回り</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const units = data.units.filter((u) => u.property_id === p.id);
              const full = units
                .filter((u) => u.status !== "使用停止")
                .reduce((s, u) => s + u.standard_rent, 0);
              const current = data.contracts
                .filter(
                  (c) =>
                    c.property_id === p.id &&
                    ["契約中", "終了予定"].includes(effectiveContractStatus(c)),
                )
                .reduce((s, c) => s + c.monthly_rent, 0);
              const paid = data.charges
                .filter((charge) => charge.property_id === p.id)
                .reduce((sum, charge) => sum + charge.paid_amount, 0);
              const investment = totalInvestment(p);
              return (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <RecordSaveStatus recordKey={`property:${p.id}`} />
                    <small>{p.property_code}</small>
                  </td>
                  <td>
                    {p.property_type}
                    <small
                      className="address-truncate"
                      title={p.address}
                      tabIndex={0}
                      onClick={() => alert(p.address)}
                    >
                      {p.address}
                    </small>
                  </td>
                  <td className="num" data-label="現在月収">
                    {yen(current)}
                  </td>
                  <td className="num" data-label="満室月収">
                    {yen(full)}
                  </td>
                  <td className="num" data-label="総投資額">
                    {yen(totalInvestment(p))}
                  </td>
                  <td className="num" data-label="年間賃料">
                    {yen(current * 12)}
                  </td>
                  <td className="num" data-label="取得価格">
                    {yen(p.acquisition_price)}
                  </td>
                  <td className="num" data-label="固定資産評価額">
                    {yen(p.current_valuation)}
                  </td>
                  <td className="num" data-label="年間固定資産税">
                    {yen(p.annual_property_tax)}
                  </td>
                  <td className="num" data-label="想定売却価格">
                    {p.estimated_sale_price == null ? "-" : yen(p.estimated_sale_price)}
                  </td>
                  <td className="num" data-label="累計入金額">
                    {yen(paid)}
                  </td>
                  <td className="num" data-label="回収率">
                    {investment > 0 ? percent(paid / investment) : "算出不可"}
                  </td>
                  <td className="num" data-label="表面利回り">
                    {percent(grossYield(full, totalInvestment(p)))}
                  </td>
                  <td className="row-actions">
                    <Link href={`/properties/${p.id}`} title="詳細"><Eye /></Link>
                    <button onClick={() => setEditing(p)} title="編集">
                      <Pencil />
                    </button>
                    <button onClick={() => remove(p)} title="削除">
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
        <PropertyForm
          isNew={editing === "new"}
          initial={
            editing === "new"
              ? { ...blank, property_code: newCode }
              : {
                  ...editing,
                  acquisition_date: editing.acquisition_date || "",
                  estimated_sale_price_updated_at: editing.estimated_sale_price_updated_at || "",
                }
          }
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function PropertyForm({
  isNew,
  initial,
  onSave,
  onClose,
}: {
  isNew: boolean;
  initial: Form;
  onSave: (x: Form) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const text = (key: keyof Form, label: string, type = "text") => (
    <label>
      {label}
      {type === "number" ? (
        <NumericInput
          value={Number(f[key])}
          format="currency"
          decimalScale={0}
          suffix="円"
          onChange={(value) => setF({ ...f, [key]: value })}
        />
      ) : (
        <input
          type={type}
          value={String(f[key])}
          onChange={(e) =>
            setF({
              ...f,
              [key]:
                type === "number"
                  ? Math.max(0, Number(e.target.value))
                  : e.target.value,
            })
          }
        />
      )}
    </label>
  );
  return (
    <Modal title={isNew ? "物件を登録" : "物件を編集"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          {text("property_code", "物件コード")}
          {text("name", "物件名")}
          <label>
            種別
            <input
              list="property-types"
              value={f.property_type}
              onChange={(e) => setF({ ...f, property_type: e.target.value })}
            />
            <datalist id="property-types">
              <option value="資材置き場" />
              <option value="貸地" />
              <option value="倉庫" />
              <option value="月極駐車場" />
            </datalist>
          </label>
          {text("address", "所在地")}
          {text("acquisition_date", "取得日", "date")}
          {text("acquisition_price", "取得価格", "number")}
          {text("acquisition_costs", "取得諸費用", "number")}
          {text("development_costs", "開発費", "number")}
          {text("current_valuation", "固定資産評価額", "number")}
          {text("estimated_sale_price", "想定売却価格", "number")}
          {text("estimated_sale_price_updated_at", "想定売却価格の更新日", "date")}
          {text("remaining_debt", "残債", "number")}
          {text("annual_property_tax", "固定資産税年額", "number")}
          <label className="form-span">想定売却価格の備考<textarea value={f.estimated_sale_price_notes} onChange={(e) => setF({ ...f, estimated_sale_price_notes: e.target.value })} /></label>
        </div>
        <label>
          備考
          <textarea
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
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

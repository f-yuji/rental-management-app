"use client";
import { useState } from "react";
import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { Badge, CsvButton, Modal, PageHeader, RecordSaveStatus } from "@/components/ui/shared";
import { NumericInput } from "@/components/ui/numeric-input";
import { yen } from "@/lib/format";
import { percent } from "@/lib/format";
import { unitOccupancyMetrics } from "@/lib/unit-occupancy";
import type { Unit, UnitStatus } from "@/types";
const blank = {
  unit_code: "",
  property_id: "",
  name: "",
  usage_type: "資材置き場",
  area_sqm: "",
  vehicle_capacity: "",
  has_power: false,
  heavy_machinery_allowed: false,
  standard_rent: 0,
  status: "空き" as UnitStatus,
  notes: "",
};
type Form = typeof blank;
export function UnitsPage() {
  const { data, actions, currentUserId } = useApp();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Unit | null | "new">(null);
  const [newTemplate, setNewTemplate] = useState<Form | null>(null);
  const [newCode, setNewCode] = useState("");
  const list = data.units.filter((u) => !filter || u.status === filter);
  const save = async (f: Form) => {
    f = { ...f, unit_code: f.unit_code.trim().toUpperCase() };
    if (!f.unit_code) {
      const propertyCode = data.properties.find(
        (p) => p.id === f.property_id,
      )?.property_code;
      if (propertyCode)
        f.unit_code = await actions.nextCode("unit", propertyCode);
    }
    if (!f.unit_code || !f.name || !f.property_id)
      return alert("区画コード、区画名、物件は必須です");
    if (
      data.units.some(
        (u) => u.unit_code === f.unit_code && u.id !== (editing as Unit)?.id,
      )
    )
      return alert("この区画コードは使用済みです");
    const stamp = new Date().toISOString(),
      value = {
        ...f,
        area_sqm: f.area_sqm === "" ? null : Number(f.area_sqm),
        vehicle_capacity:
          f.vehicle_capacity === "" ? null : Number(f.vehicle_capacity),
      };
    if (editing === "new")
      await actions.createUnit({
        ...value,
        id: crypto.randomUUID(),
        user_id: currentUserId,
        created_at: stamp,
        updated_at: stamp,
      });
    else
      await actions.updateUnit((editing as Unit).id, {
        ...value,
        updated_at: stamp,
      });
    setEditing(null);
  };
  return (
    <>
      <PageHeader
        title="区画"
        description="土地・置場を区画単位で管理"
        action={() => {
          setNewTemplate(null);
          const property = data.properties[0];
          if (!property) return alert("先に物件を登録してください");
          void actions.nextCode("unit", property.property_code).then((code) => {
            setNewCode(code);
            setEditing("new");
          });
        }}
      />
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">すべての現況</option>
          {["空き", "稼働", "募集中", "使用停止"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <CsvButton
          filename="units.csv"
          rows={[
            [
              "区画コード",
              "区画名",
              "物件",
              "用途",
              "面積㎡",
              "車両台数",
              "標準賃料",
              "現況",
            ],
            ...list.map((u) => [
              u.unit_code,
              u.name,
              data.properties.find((p) => p.id === u.property_id)?.name || "",
              u.usage_type,
              u.area_sqm || "",
              u.vehicle_capacity || "",
              u.standard_rent,
              u.status,
            ]),
          ]}
        />
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>区画</th>
              <th>物件</th>
              <th>用途・面積</th>
              <th>設備</th>
              <th className="num">標準賃料</th>
              <th>現況</th>
              <th>現在契約者</th>
              <th>契約継続期間</th>
              <th>現在空室期間</th>
              <th className="num">累計空室日数</th>
              <th className="num">稼働率</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const c = data.contracts.find(
                (c) =>
                  c.unit_id === u.id &&
                  ["契約中", "終了予定"].includes(c.status),
              );
              const occupancy = unitOccupancyMetrics(
                data.contracts.filter((contract) => contract.unit_id === u.id),
                data.properties.find(
                  (property) => property.id === u.property_id,
                )?.acquisition_date ?? null,
              );
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <RecordSaveStatus recordKey={`unit:${u.id}`} />
                    <small>{u.unit_code}</small>
                  </td>
                  <td>
                    {data.properties.find((p) => p.id === u.property_id)?.name}
                  </td>
                  <td>
                    {u.usage_type}
                    <small>
                      {u.area_sqm ?? "-"}㎡ / {u.vehicle_capacity ?? "-"}台
                    </small>
                  </td>
                  <td>
                    {u.has_power ? "電源有" : "電源無"} /{" "}
                    {u.heavy_machinery_allowed ? "重機可" : "重機不可"}
                  </td>
                  <td className="num" data-label="標準賃料">
                    {yen(u.standard_rent)}
                  </td>
                  <td>
                    <Badge>{u.status}</Badge>
                  </td>
                  <td>
                    {c?.tenant_name || "-"}
                    {c && <small>{yen(c.monthly_rent)}</small>}
                  </td>
                  <td>{occupancy.contractDuration}</td>
                  <td>
                    <Badge>{occupancy.vacancyDuration}</Badge>
                  </td>
                  <td className="num" data-label="累計空室日数">
                    {occupancy.cumulativeVacancyDays}日
                  </td>
                  <td className="num" data-label="稼働率">
                    {percent(occupancy.occupancyRate)}
                  </td>
                  <td className="row-actions">
                    <Link href={`/units/${u.id}`} title="詳細">
                      <Eye />
                    </Link>
                    <button onClick={() => setEditing(u)}>
                      <Pencil />
                    </button>
                    <button
                      title="複製"
                      onClick={() => {
                        const property = data.properties.find(
                          (p) => p.id === u.property_id,
                        );
                        if (!property) return;
                        void actions.nextCode("unit", property.property_code).then((code) => {
                          setNewCode(code);
                          setNewTemplate({
                            ...unitToForm(u),
                            unit_code: code,
                            name: `${u.name} コピー`,
                          });
                          setEditing("new");
                        });
                      }}
                    >
                      <Copy />
                    </button>
                    <button
                      onClick={() => {
                        const contracts = data.contracts.filter(
                          (c) => c.unit_id === u.id,
                        );
                        const charges = data.charges.filter(
                          (c) => c.unit_id === u.id,
                        );
                        const related =
                          contracts.length || charges.length
                            ? `\n\n関連する契約 ${contracts.length}件、請求 ${charges.length}件も削除されます。`
                            : "";
                        if (
                          confirm(
                            `${u.name}を削除しますか？${related}\nこの操作は元に戻せません。`,
                          )
                        )
                          void actions.deleteUnit(u.id);
                      }}
                      title="関連データごと削除"
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
        <UnitForm
          isNew={editing === "new"}
          properties={data.properties}
          initial={
            editing === "new"
              ? {
                  ...(newTemplate ?? blank),
                  unit_code: newCode,
                  property_id:
                    newTemplate?.property_id || data.properties[0]?.id || "",
                }
              : unitToForm(editing)
          }
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function unitToForm(unit: Unit): Form {
  return {
    ...unit,
    area_sqm: unit.area_sqm === null ? "" : String(unit.area_sqm),
    vehicle_capacity:
      unit.vehicle_capacity === null ? "" : String(unit.vehicle_capacity),
  };
}
function UnitForm({
  isNew,
  properties,
  initial,
  onClose,
  onSave,
}: {
  isNew: boolean;
  properties: { id: string; name: string }[];
  initial: Form;
  onClose: () => void;
  onSave: (f: Form) => void;
}) {
  const [f, setF] = useState(initial);
  return (
    <Modal title={isNew ? "区画を登録" : "区画を編集"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          <label>
            区画コード
            <input
              value={f.unit_code}
              onChange={(e) => setF({ ...f, unit_code: e.target.value })}
            />
          </label>
          <label>
            区画名
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </label>
          <label>
            物件
            <select
              value={f.property_id}
              onChange={(e) => setF({ ...f, property_id: e.target.value })}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            用途
            <input
              value={f.usage_type}
              onChange={(e) => setF({ ...f, usage_type: e.target.value })}
            />
          </label>
          <label>
            面積㎡
            <NumericInput
              value={Number(f.area_sqm)}
              decimalScale={2}
              onChange={(value) =>
                setF({ ...f, area_sqm: value ? String(value) : "" })
              }
            />
          </label>
          <label>
            車両台数
            <NumericInput
              value={Number(f.vehicle_capacity)}
              decimalScale={0}
              onChange={(value) =>
                setF({ ...f, vehicle_capacity: value ? String(value) : "" })
              }
            />
          </label>
          <label>
            標準賃料
            <NumericInput
              value={f.standard_rent}
              format="currency"
              decimalScale={0}
              suffix="円"
              onChange={(value) => setF({ ...f, standard_rent: value })}
            />
          </label>
          <label>
            現況
            <select
              value={f.status}
              onChange={(e) =>
                setF({ ...f, status: e.target.value as UnitStatus })
              }
            >
              {["空き", "稼働", "募集中", "使用停止"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.has_power}
              onChange={(e) => setF({ ...f, has_power: e.target.checked })}
            />
            電源あり
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.heavy_machinery_allowed}
              onChange={(e) =>
                setF({ ...f, heavy_machinery_allowed: e.target.checked })
              }
            />
            重機可
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

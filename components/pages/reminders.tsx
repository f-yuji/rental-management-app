"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Badge, Modal, PageHeader, RecordSaveStatus } from "@/components/ui/shared";
import { renewalReminder } from "@/lib/calculations";
import type { Reminder, ReminderType, RelatedEntityType } from "@/types";
const types: ReminderType[] = ["固定資産税", "その他"];
const blank = {
  reminder_type: "固定資産税" as ReminderType,
  title: "",
  due_date: "",
  related_type: "free" as RelatedEntityType,
  related_id: "",
  notes: "",
  completed: false,
};
type Form = typeof blank;
export function RemindersPage() {
  const { data, actions, currentUserId } = useApp(),
    [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const save = async (f: Form) => {
    if (!types.includes(f.reminder_type))
      return alert("契約期限は契約情報から自動表示されるため、手動登録できません");
    if (!f.title || !f.due_date) return alert("タイトルと期限日は必須です");
    const now = new Date().toISOString(),
      value = { ...f, related_id: f.related_id || null, updated_at: now };
    if (editing === "new")
      await actions.createReminder({
        ...value,
        id: crypto.randomUUID(),
        user_id: currentUserId,
        created_at: now,
      });
    else await actions.updateReminder((editing as Reminder).id, value);
    setEditing(null);
  };
  return (
    <>
      <PageHeader
        title="期限管理"
        description="契約・保証会社・固定資産税などの期限"
        action={() => setEditing("new")}
      />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>区分</th>
              <th>対象</th>
              <th>期限日</th>
              <th>残り日数</th>
              <th>状態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.reminders.map((r) => {
              const status = renewalReminder(
                r.due_date,
                new Date(),
                Number.MAX_SAFE_INTEGER,
              );
              return (
                <tr key={r.id}>
                  <td>
                    <Badge>{r.reminder_type}</Badge>
                  </td>
                  <td>
                    <b>{r.title}</b>
                    <RecordSaveStatus recordKey={`reminder:${r.id}`} />
                    <small>{relatedLabel(r.related_type, r.related_id, data)}</small>
                    <small>{r.notes}</small>
                  </td>
                  <td>{r.due_date}</td>
                  <td>{status?.label}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() =>
                        void actions.updateReminder(r.id, {
                          completed: !r.completed,
                        })
                      }
                    >
                      {r.completed ? "完了" : "未完了"}
                    </button>
                  </td>
                  <td className="row-actions">
                    <button onClick={() => setEditing(r)}>
                      <Pencil />
                    </button>
                    <button
                      onClick={() =>
                        confirm(`${r.title}を削除しますか？`) &&
                        void actions.deleteReminder(r.id)
                      }
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
          <ReminderForm
          initial={
            editing === "new"
              ? blank
              : { ...editing, related_id: editing.related_id || "" }
          }
          data={data}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function relatedLabel(
  type: RelatedEntityType,
  id: string | null,
  data: ReturnType<typeof useApp>["data"],
) {
  if (!id) return type === "free" ? "自由" : "関連先なし";
  const name =
    type === "property"
      ? data.properties.find((x) => x.id === id)?.name
      : type === "unit"
        ? data.units.find((x) => x.id === id)?.name
        : type === "contract"
          ? data.contracts.find((x) => x.id === id)?.tenant_name
          : undefined;
  return `${{ property: "物件", unit: "区画", contract: "契約", construction: "工事", free: "自由" }[type]} ${name ?? "削除済み"}`;
}
function ReminderForm({
  initial,
  data,
  onClose,
  onSave,
}: {
  initial: Form;
  data: ReturnType<typeof useApp>["data"];
  onClose: () => void;
  onSave: (f: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const options =
    f.related_type === "property"
      ? data.properties.map((x) => ({ id: x.id, name: x.name }))
      : f.related_type === "unit"
        ? data.units.map((x) => ({ id: x.id, name: x.name }))
        : f.related_type === "contract"
          ? data.contracts.map((x) => ({ id: x.id, name: x.tenant_name }))
          : [];
  return (
    <Modal title="期限を登録" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          <label>
            区分
            <select
              value={f.reminder_type}
              onChange={(e) => setF({ ...f, reminder_type: e.target.value })}
            >
              {types.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            タイトル
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </label>
          <label>
            関連
            <select
              value={f.related_type}
              onChange={(e) =>
                setF({
                  ...f,
                  related_type: e.target.value as RelatedEntityType,
                  related_id: "",
                })
              }
            >
              <option value="property">物件</option>
              <option value="unit">区画</option>
              <option value="contract">契約</option>
              <option value="free">自由</option>
            </select>
          </label>
          {options.length > 0 && (
            <label>
              関連先
              <select
                value={f.related_id}
                onChange={(e) => {
                  const selected = options.find((x) => x.id === e.target.value);
                  setF({
                    ...f,
                    related_id: e.target.value,
                    title: selected
                      ? `${f.reminder_type} ${selected.name}`
                      : f.title,
                  });
                }}
              >
                <option value="">選択なし</option>
                {options.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            期限日
            <input
              type="date"
              value={f.due_date}
              onChange={(e) => setF({ ...f, due_date: e.target.value })}
            />
          </label>
          <label className="form-span">
            メモ
            <textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
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

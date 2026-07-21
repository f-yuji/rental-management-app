"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Badge, Modal, PageHeader } from "@/components/ui/shared";
import { renewalReminder } from "@/lib/calculations";
import type { Reminder, ReminderType, RelatedEntityType } from "@/types";
const types: ReminderType[] = [
  "契約更新",
  "契約終了",
  "保証会社更新",
  "固定資産税",
  "任意タスク",
];
const blank = {
  reminder_type: "任意タスク" as ReminderType,
  title: "",
  due_date: "",
  related_type: "free" as RelatedEntityType,
  related_id: "",
  notes: "",
  completed: false,
};
type Form = typeof blank;
export function RemindersPage() {
  const { data, actions } = useApp(),
    [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const save = async (f: Form) => {
    if (!f.title || !f.due_date) return alert("タイトルと期限日は必須です");
    const now = new Date().toISOString(),
      value = { ...f, related_id: f.related_id || null, updated_at: now };
    if (editing === "new")
      await actions.createReminder({
        ...value,
        id: crypto.randomUUID(),
        user_id: "demo-user",
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
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
function ReminderForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Form;
  onClose: () => void;
  onSave: (f: Form) => void;
}) {
  const [f, setF] = useState(initial);
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

"use client";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Badge, Modal, PageHeader } from "@/components/ui/shared";
import type { RelatedEntityType, Task } from "@/types";
const blank = {
  title: "",
  description: "",
  due_date: "",
  priority: "中" as Task["priority"],
  completed: false,
  related_type: "free" as RelatedEntityType,
  related_id: "",
};
type Form = typeof blank;
export function TasksPage() {
  const { data, actions } = useApp(),
    [editing, setEditing] = useState<Task | "new" | null>(null);
  const save = async (form: Form) => {
    if (!form.title.trim()) return alert("タイトルを入力してください");
    const now = new Date().toISOString(),
      value = {
        ...form,
        due_date: form.due_date || null,
        related_id: form.related_id || null,
        updated_at: now,
      };
    if (editing === "new")
      await actions.createTask({
        ...value,
        id: crypto.randomUUID(),
        user_id: "demo-user",
        created_at: now,
      });
    else await actions.updateTask((editing as Task).id, value);
    setEditing(null);
  };
  const sorted = [...data.tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  return (
    <>
      <PageHeader
        title="タスク"
        description="賃貸管理の作業と期限を管理"
        action={() => setEditing("new")}
      />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>状態</th>
              <th>タスク</th>
              <th>期限</th>
              <th>優先度</th>
              <th>関連</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr key={task.id}>
                <td>
                  <button
                    className="task-check"
                    onClick={() =>
                      void actions.updateTask(task.id, {
                        completed: !task.completed,
                      })
                    }
                  >
                    <CheckCircle2
                      className={task.completed ? "completed" : ""}
                    />
                  </button>
                </td>
                <td>
                  <b>{task.title}</b>
                  <small>{task.description}</small>
                </td>
                <td>{task.due_date || "-"}</td>
                <td>
                  <Badge>{task.priority}</Badge>
                </td>
                <td>
                  {relatedLabel(task.related_type, task.related_id, data)}
                </td>
                <td className="row-actions">
                  <button onClick={() => setEditing(task)}>
                    <Pencil />
                  </button>
                  <button
                    onClick={() =>
                      confirm(`${task.title}を削除しますか？`) &&
                      void actions.deleteTask(task.id)
                    }
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
        <TaskForm
          initial={
            editing === "new"
              ? blank
              : {
                  ...editing,
                  due_date: editing.due_date || "",
                  related_id: editing.related_id || "",
                }
          }
          data={data}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
function TaskForm({
  initial,
  data,
  onClose,
  onSave,
}: {
  initial: Form;
  data: ReturnType<typeof useApp>["data"];
  onClose: () => void;
  onSave: (form: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const options = relatedOptions(f.related_type, data);
  return (
    <Modal title="タスクを編集" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          <label>
            タイトル
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </label>
          <label>
            期限
            <input
              type="date"
              value={f.due_date}
              onChange={(e) => setF({ ...f, due_date: e.target.value })}
            />
          </label>
          <label>
            優先度
            <select
              value={f.priority}
              onChange={(e) =>
                setF({ ...f, priority: e.target.value as Task["priority"] })
              }
            >
              <option>高</option>
              <option>中</option>
              <option>低</option>
            </select>
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
              <option value="construction">工事</option>
              <option value="free">自由</option>
            </select>
          </label>
          {options.length > 0 && (
            <label>
              関連先
              <select
                value={f.related_id}
                onChange={(e) => setF({ ...f, related_id: e.target.value })}
              >
                <option value="">選択なし</option>
                {options.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-span">
            内容
            <textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
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
const relatedOptions = (
  type: RelatedEntityType,
  data: ReturnType<typeof useApp>["data"],
) =>
  type === "property"
    ? data.properties.map((x) => ({ id: x.id, name: x.name }))
    : type === "unit"
      ? data.units.map((x) => ({ id: x.id, name: x.name }))
      : type === "contract"
        ? data.contracts.map((x) => ({
            id: x.id,
            name: `${x.contract_code} ${x.tenant_name}`,
          }))
        : [];
const relatedLabel = (
  type: RelatedEntityType,
  id: string | null,
  data: ReturnType<typeof useApp>["data"],
) =>
  id
    ? (relatedOptions(type, data).find((x) => x.id === id)?.name ?? "-")
    : {
        property: "物件",
        unit: "区画",
        contract: "契約",
        construction: "工事",
        free: "自由",
      }[type];

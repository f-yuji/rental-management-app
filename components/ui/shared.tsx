"use client";
import { Download, Plus, X } from "lucide-react";
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary" onClick={action}>
          <Plus />
          新規登録
        </button>
      )}
    </div>
  );
}
export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "good";
}) {
  return (
    <div className={`kpi ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className={`badge badge-${String(children)}`}>{children}</span>;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="閉じる">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({
  text = "該当するデータはありません",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
export function CsvButton({
  filename,
  rows,
}: {
  filename: string;
  rows: (string | number)[][];
}) {
  const run = () => {
    const csv =
      "\ufeff" +
      rows
        .map((r) =>
          r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <button className="secondary" onClick={run}>
      <Download />
      CSV
    </button>
  );
}

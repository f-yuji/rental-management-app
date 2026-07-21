"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Badge } from "@/components/ui/shared";
import { dateLabel, yen } from "@/lib/format";
import type { AttachmentCategory } from "@/types";

const categories: AttachmentCategory[] = [
  "契約書",
  "保証会社書類",
  "本人確認",
  "請求書",
  "その他",
];
export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>(),
    { data, actions, mode } = useApp();
  const contract = data.contracts.find((row) => row.id === id);
  const [category, setCategory] = useState<AttachmentCategory>("契約書"),
    [uploading, setUploading] = useState(false);
  if (!contract)
    return (
      <section className="panel">
        <p>契約が見つかりません。</p>
        <Link href="/contracts">契約一覧へ戻る</Link>
      </section>
    );
  const property = data.properties.find(
      (row) => row.id === contract.property_id,
    ),
    unit = data.units.find((row) => row.id === contract.unit_id);
  const files = data.attachments.filter(
    (row) => row.contract_id === contract.id,
  );
  const field = (label: string, value: React.ReactNode) => (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
  return (
    <>
      <div className="detail-header">
        <Link className="secondary" href="/contracts">
          <ArrowLeft />
          契約一覧
        </Link>
        <div>
          <h1>{contract.tenant_name}</h1>
          <p>
            {contract.contract_code} / {property?.name} / {unit?.name}
          </p>
        </div>
        <Badge>{contract.status}</Badge>
      </div>
      <section className="panel">
        <h2>契約情報</h2>
        <dl className="detail-grid">
          {field("契約開始", dateLabel(contract.start_date))}
          {field("契約終了", dateLabel(contract.end_date))}
          {field("月額賃料", yen(contract.monthly_rent))}
          {field("更新日", dateLabel(contract.renewal_date))}
          {field("更新方式", contract.renewal_method)}
          {field("自動更新", contract.auto_renew ? "あり" : "なし")}
          {field("要再契約", contract.requires_recontract ? "必要" : "不要")}
          {field(
            "更新周期",
            contract.renewal_cycle_months
              ? `${contract.renewal_cycle_months}カ月`
              : "-",
          )}
          {field("更新料", yen(contract.renewal_fee))}
          {field("備考", contract.notes)}
        </dl>
      </section>
      <section className="panel">
        <h2>保証会社</h2>
        <dl className="detail-grid">
          {field("利用", contract.guarantor_enabled ? "あり" : "なし")}
          {field("保証会社名", contract.guarantor_company_name)}
          {field("保証契約番号", contract.guarantor_contract_number)}
          {field("保証開始日", dateLabel(contract.guarantor_start_date))}
          {field("保証終了日", dateLabel(contract.guarantor_end_date))}
          {field("保証会社更新日", dateLabel(contract.guarantor_renewal_date))}
          {field("保証料", yen(contract.guarantor_fee))}
          {field("保証会社メモ", contract.guarantor_notes)}
        </dl>
      </section>
      <section className="panel">
        <h2>振込口座</h2>
        <dl className="detail-grid">
          {field("銀行", contract.bank_name)}
          {field("支店", contract.bank_branch)}
          {field("口座種別", contract.bank_account_type)}
          {field("口座番号", contract.bank_account_number)}
          {field("口座名義", contract.bank_account_holder)}
          {field("振込名義", contract.transfer_name)}
        </dl>
      </section>
      <section className="panel">
        <h2>解約管理</h2>
        <dl className="detail-grid">
          {field("解約通知日", dateLabel(contract.cancellation_notice_date))}
          {field("解約予定日", dateLabel(contract.cancellation_planned_date))}
          {field("解約完了日", dateLabel(contract.cancellation_completed_date))}
          {field("原状回復費", yen(contract.restoration_cost))}
          {field("保証金返還", yen(contract.deposit_refund))}
          {field("備考", contract.cancellation_notes)}
        </dl>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>書類</h2>
          <div className="attachment-upload">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AttachmentCategory)
              }
            >
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <label className="primary file-button">
              <Upload />
              {uploading ? "アップロード中" : "ファイルを追加"}
              <input
                type="file"
                accept="application/pdf,image/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    await actions.uploadAttachment(contract.id, category, file);
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </div>
        {!files.length ? (
          <p className="empty">添付書類はありません</p>
        ) : (
          <div className="document-list">
            {files.map((file) => (
              <div key={file.id}>
                <FileText />
                <span>
                  <b>{file.file_name}</b>
                  <small>
                    {file.category} /{" "}
                    {new Date(file.created_at).toLocaleDateString("ja-JP")}
                  </small>
                </span>
                <button
                  title="ダウンロード"
                  onClick={async () => {
                    if (mode === "demo")
                      return alert("Supabase接続時にダウンロードできます");
                    const url = await actions.attachmentUrl(file);
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Download />
                </button>
                <button
                  title="削除"
                  onClick={() =>
                    confirm(`${file.file_name}を削除しますか？`) &&
                    void actions.deleteAttachment(file)
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

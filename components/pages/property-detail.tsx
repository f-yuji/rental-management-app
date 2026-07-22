"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { Badge, Kpi } from "@/components/ui/shared";
import { effectiveContractStatus, totalInvestment } from "@/lib/calculations";
import { dateLabel, percent, yen } from "@/lib/format";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready } = useApp();
  if (!ready) return <section className="panel"><p>物件情報を読み込んでいます...</p></section>;
  const property = data.properties.find((row) => row.id === id);
  if (!property) return <section className="panel"><p>物件が見つかりません。</p><Link href="/properties">物件一覧へ戻る</Link></section>;
  const units = data.units.filter((row) => row.property_id === id);
  const contracts = data.contracts.filter((row) => row.property_id === id);
  const active = contracts.filter((row) => ["契約中", "終了予定"].includes(effectiveContractStatus(row)));
  const monthlyRent = active.reduce((sum, row) => sum + row.monthly_rent, 0);
  const paid = data.charges.filter((row) => row.property_id === id).reduce((sum, row) => sum + row.paid_amount, 0);
  const investment = totalInvestment(property);
  const recovery = investment > 0 ? paid / investment : null;
  return <>
    <div className="detail-header"><Link className="secondary" href="/properties"><ArrowLeft />物件一覧</Link><div><h1>{property.name}</h1><p>{property.property_code} / {property.address}</p></div><Badge>{property.property_type}</Badge></div>
    <div className="kpi-grid">
      <Kpi label="取得総額" value={yen(investment)} />
      <Kpi label="想定売却価格" value={property.estimated_sale_price == null ? "未設定" : yen(property.estimated_sale_price)} sub={property.estimated_sale_price_updated_at ? `更新日 ${dateLabel(property.estimated_sale_price_updated_at)}` : undefined} />
      <Kpi label="月額賃料" value={yen(monthlyRent)} />
      <Kpi label="年間賃料" value={yen(monthlyRent * 12)} />
      <Kpi label="累計入金額（請求ログ）" value={yen(paid)} sub="物件へ配分できない初期累計は除外" tone="good" />
      <Kpi label="回収率" value={recovery == null ? "算出不可" : percent(recovery)} sub={recovery != null && recovery >= 1 ? "元本回収済み / 請求ログの入金額ベース" : "請求ログの入金額ベース"} tone={recovery != null && recovery >= 1 ? "good" : undefined} />
    </div>
    <section className="panel"><h2>評価情報</h2><dl className="detail-grid"><div className="detail-field"><dt>固定資産評価額</dt><dd>{yen(property.current_valuation)}</dd></div><div className="detail-field"><dt>残債</dt><dd>{yen(property.remaining_debt)}</dd></div><div className="detail-field"><dt>年間固定資産税</dt><dd>{yen(property.annual_property_tax)}</dd></div><div className="detail-field"><dt>想定売却価格の備考</dt><dd>{property.estimated_sale_price_notes || "-"}</dd></div></dl></section>
    <section className="panel"><h2>区画・契約</h2><div className="simple-list">{units.map((unit) => <div key={unit.id}><span><b>{unit.name}</b><small>{unit.unit_code}</small></span><Badge>{unit.status}</Badge></div>)}</div></section>
  </>;
}

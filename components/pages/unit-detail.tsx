"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Badge, Kpi } from "@/components/ui/shared";
import { percent, yen } from "@/lib/format";
import { unitOccupancyMetrics } from "@/lib/unit-occupancy";
export function UnitDetailPage() {
  const { id } = useParams<{ id: string }>(),
    { data } = useApp();
  const unit = data.units.find((x) => x.id === id);
  if (!unit) return <section className="panel">区画が見つかりません</section>;
  const property = data.properties.find((x) => x.id === unit.property_id),
    contracts = data.contracts.filter((x) => x.unit_id === unit.id),
    occupancy = unitOccupancyMetrics(
      contracts,
      property?.acquisition_date ?? null,
    );
  return (
    <>
      <div className="detail-header">
        <Link className="secondary" href="/units">
          <ArrowLeft />
          区画一覧
        </Link>
        <div>
          <h1>{unit.name}</h1>
          <p>
            {unit.unit_code} / {property?.name}
          </p>
        </div>
        <Badge>{unit.status}</Badge>
      </div>
      <div className="kpi-grid compact">
        <Kpi label="標準賃料" value={yen(unit.standard_rent)} />
        <Kpi label="契約継続期間" value={occupancy.contractDuration} />
        <Kpi label="現在空室期間" value={occupancy.vacancyDuration} />
        <Kpi
          label="累計空室日数"
          value={`${occupancy.cumulativeVacancyDays}日`}
        />
        <Kpi label="稼働率" value={percent(occupancy.occupancyRate)} />
      </div>
      <section className="panel">
        <h2>契約履歴</h2>
        <div className="simple-list">
          {contracts.map((c) => (
            <div key={c.id}>
              <Badge>{c.status}</Badge>
              <span>
                {c.tenant_name}
                <small>
                  {c.start_date} - {c.end_date || "継続中"}
                </small>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

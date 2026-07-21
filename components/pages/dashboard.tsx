"use client";
import { useApp } from "@/components/app-provider";
import { Badge, Kpi, PageHeader } from "@/components/ui/shared";
import {
  grossYield,
  cumulativeTotals,
  netAssets,
  renewalReminder,
  totalInvestment,
} from "@/lib/calculations";
import { dateLabel, percent, yen } from "@/lib/format";
export function Dashboard() {
  const { data } = useApp();
  const active = data.contracts.filter(
    (c) => c.status === "契約中" || c.status === "終了予定",
  );
  const current = active.reduce((s, c) => s + c.monthly_rent, 0);
  const full = data.units
    .filter((u) => u.status !== "使用停止")
    .reduce((s, u) => s + u.standard_rent, 0);
  const investment = data.properties.reduce(
    (s, p) => s + totalInvestment(p),
    0,
  );
  const valuation = data.properties.reduce(
    (s, p) => s + p.current_valuation,
    0,
  );
  const debt = data.properties.reduce((s, p) => s + p.remaining_debt, 0);
  const annualTax = data.properties.reduce(
    (sum, p) => sum + p.annual_property_tax,
    0,
  );
  const currentMonth = new Date()
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .slice(0, 7);
  const monthCharges = data.charges.filter((charge) =>
    charge.billing_month.startsWith(currentMonth),
  );
  const monthBilled = monthCharges.reduce(
    (sum, charge) => sum + charge.billed_amount,
    0,
  );
  const monthPaid = monthCharges.reduce(
    (sum, charge) => sum + charge.paid_amount,
    0,
  );
  const {
    billed,
    paid,
    outstanding: totalOutstanding,
  } = cumulativeTotals(data.settings, data.charges);
  const deadlines = [
    ...data.contracts
      .flatMap((contract) =>
        ["契約中", "終了予定"].includes(contract.status)
          ? [
              {
                id: `contract-renewal-${contract.id}`,
                type: "契約更新",
                title: contract.tenant_name,
                dueDate: contract.renewal_date,
              },
              {
                id: `contract-end-${contract.id}`,
                type: "契約終了",
                title: contract.tenant_name,
                dueDate: contract.end_date,
              },
              {
                id: `guarantor-${contract.id}`,
                type: "保証会社更新",
                title: contract.guarantor_company_name || contract.tenant_name,
                dueDate: contract.guarantor_renewal_date,
              },
            ]
          : [],
      )
      .flat(),
    ...data.reminders
      .filter((row) => !row.completed)
      .map((row) => ({
        id: `manual-${row.id}`,
        type: row.reminder_type,
        title: row.title,
        dueDate: row.due_date,
      })),
  ]
    .flatMap((item) => {
      const reminder = renewalReminder(item.dueDate);
      return reminder ? [{ ...item, reminder }] : [];
    })
    .sort((a, b) => a.reminder.daysRemaining - b.reminder.daysRemaining);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
  const todayTasks = data.tasks.filter(
    (task) => !task.completed && task.due_date === today,
  );
  const overdueTasks = data.tasks.filter(
    (task) => !task.completed && task.due_date && task.due_date < today,
  );
  const recentContracts = [...data.contracts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const recentProperties = [...data.properties]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);
  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description="資産・契約・入金状況をまとめて確認"
      />
      <div className="period-tabs">
        <button className="active">今月</button>
        <button>今年</button>
        <button>全期間</button>
      </div>
      <div className="kpi-grid">
        <Kpi label="現在月収" value={yen(current)} sub="有効契約の合計" />
        <Kpi label="満室月収" value={yen(full)} sub="使用停止を除く" />
        <Kpi
          label="累計請求額"
          value={yen(billed)}
          sub="運用開始前の初期値を含む"
        />
        <Kpi
          label="累計入金額"
          value={yen(paid)}
          sub="運用開始前の初期値を含む"
          tone="good"
        />
        <Kpi
          label="累計未収額"
          value={yen(totalOutstanding)}
          tone={totalOutstanding > 0 ? "danger" : undefined}
        />
        <Kpi label="総投資額" value={yen(investment)} />
        <Kpi label="純資産" value={yen(valuation - debt)} />
        <Kpi label="表面利回り" value={percent(grossYield(full, investment))} />
        <Kpi label="今月請求" value={yen(monthBilled)} />
        <Kpi label="今月入金" value={yen(monthPaid)} tone="good" />
        <Kpi
          label="今月未収"
          value={yen(Math.max(monthBilled - monthPaid, 0))}
          tone={monthBilled > monthPaid ? "danger" : undefined}
        />
        <Kpi label="年間税額合計" value={yen(annualTax)} />
        <Kpi label="月平均税負担" value={yen(Math.round(annualTax / 12))} />
        <Kpi
          label="税引後年間CF"
          value={yen(current * 12 - annualTax)}
          sub="現在月収×12－年間固定資産税"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>物件別収益</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>物件</th>
                  <th className="num">満室月収</th>
                  <th className="num">純資産</th>
                  <th className="num">表面利回り</th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p) => {
                  const units = data.units.filter(
                    (u) => u.property_id === p.id,
                  );
                  const rent = units.reduce((s, u) => s + u.standard_rent, 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                        <small>{p.property_code}</small>
                      </td>
                      <td className="num" data-label="満室月収">
                        {yen(rent)}
                      </td>
                      <td className="num" data-label="純資産">
                        {yen(netAssets(p))}
                      </td>
                      <td className="num" data-label="表面利回り">
                        {percent(grossYield(rent, totalInvestment(p)))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>注意が必要な項目</h2>
          <div className="alerts">
            {data.units
              .filter((u) => u.status === "空き" || u.status === "募集中")
              .map((u) => (
                <div key={u.id}>
                  <Badge>{u.status}</Badge>
                  <span>{u.name}</span>
                </div>
              ))}
            {data.contracts
              .filter((c) => c.status === "終了予定")
              .map((c) => (
                <div key={c.id}>
                  <Badge>終了予定</Badge>
                  <span>
                    {c.tenant_name} / {c.end_date}
                  </span>
                </div>
              ))}
            {!data.units.some(
              (u) => u.status === "空き" || u.status === "募集中",
            ) && <p>空き区画はありません</p>}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>期限一覧</h2>
          <a href="/reminders">期限を管理</a>
        </div>
        {!deadlines.length ? (
          <p className="empty">60日以内の期限はありません</p>
        ) : (
          <div className="deadline-list">
            {deadlines.map((item) => (
              <div key={item.id} className={`deadline-${item.reminder.level}`}>
                <span className="deadline-marker" />
                <span>
                  <b>{item.type}</b>
                  <small>
                    {item.title} /{" "}
                    {item.reminder.daysRemaining < 0
                      ? "期限超過"
                      : item.reminder.daysRemaining <= 7
                        ? "7日以内"
                        : item.reminder.daysRemaining <= 30
                          ? "30日以内"
                          : "60日以内"}
                  </small>
                </span>
                <span>{dateLabel(item.dueDate)}</span>
                <strong>{item.reminder.label}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-head">
            <h2>今日のタスク</h2>
            <a href="/tasks">タスクを管理</a>
          </div>
          {!todayTasks.length ? (
            <p className="empty">今日が期限のタスクはありません</p>
          ) : (
            <div className="simple-list">
              {todayTasks.map((task) => (
                <div key={task.id}>
                  <Badge>{task.priority}</Badge>
                  <span>{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>期限超過タスク</h2>
          {!overdueTasks.length ? (
            <p className="empty">期限超過はありません</p>
          ) : (
            <div className="simple-list">
              {overdueTasks.map((task) => (
                <div key={task.id}>
                  <Badge>期限超過</Badge>
                  <span>
                    {task.title}
                    <small>{task.due_date}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>最近登録した契約</h2>
          <div className="simple-list">
            {recentContracts.map((contract) => (
              <div key={contract.id}>
                <Badge>{contract.status}</Badge>
                <span>
                  {contract.tenant_name}
                  <small>
                    {contract.contract_code} / {dateLabel(contract.created_at)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>最近更新した物件</h2>
          <div className="simple-list">
            {recentProperties.map((property) => (
              <div key={property.id}>
                <Badge>{property.property_type}</Badge>
                <span>
                  {property.name}
                  <small>{dateLabel(property.updated_at)}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

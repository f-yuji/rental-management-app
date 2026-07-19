"use client";
import Link from "next/link"; import { usePathname } from "next/navigation";
import { Building2, Calculator, ChartNoAxesCombined, FileText, LandPlot, LayoutDashboard, Menu, ReceiptJapaneseYen, Settings, X } from "lucide-react";
import { useState } from "react";
const links=[{href:"/",label:"ダッシュボード",icon:LayoutDashboard},{href:"/properties",label:"物件",icon:Building2},{href:"/units",label:"区画",icon:LandPlot},{href:"/contracts",label:"契約",icon:FileText},{href:"/billing",label:"請求・入金",icon:ReceiptJapaneseYen},{href:"/purchase-analysis",label:"購入検討",icon:Calculator},{href:"/reports/annual",label:"年間一覧",icon:ChartNoAxesCombined},{href:"/settings",label:"設定",icon:Settings}];
export function AppShell({children}:{children:React.ReactNode}){const path=usePathname();const [open,setOpen]=useState(false);return <div className="app-frame">
  <aside className={`sidebar ${open?"open":""}`}><div className="brand"><div className="brand-mark">RM</div><div><b>賃貸管理</b><small>個人用ポートフォリオ</small></div><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div><nav>{links.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className={path===href?"active":""}><Icon size={19}/><span>{label}</span></Link>)}</nav><div className="mode-note"><span className="status-dot"/>デモモード</div></aside>
  <header className="mobile-header"><button onClick={()=>setOpen(true)}><Menu/></button><b>賃貸管理</b></header>{open&&<button className="scrim" onClick={()=>setOpen(false)} aria-label="閉じる"/>}
  <main className="main">{children}</main><nav className="bottom-nav">{links.slice(0,5).map(({href,label,icon:Icon})=><Link key={href} href={href} className={path===href?"active":""}><Icon/><span>{label}</span></Link>)}</nav>
  </div>}

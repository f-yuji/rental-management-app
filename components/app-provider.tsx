"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { demoData } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";
import type { AppData, PurchaseAssumptions, PurchaseCandidate } from "@/types";

type Context = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  reset: () => void;
  ready: boolean;
  mode: "supabase" | "demo";
  syncState: "idle" | "saving" | "saved" | "error";
};

const AppContext = createContext<Context | null>(null);
const emptyData: AppData = { ...demoData, properties: [], units: [], contracts: [], charges: [], purchaseCandidates: [] };

const candidateFromDb = (row: Record<string, unknown>): PurchaseCandidate => ({
  id: String(row.id), name: String(row.name ?? ""), purchasePrice: Number(row.purchase_price), acquisitionCosts: Number(row.acquisition_costs),
  landValuation: Number(row.land_valuation), buildingValuation: Number(row.building_valuation), renovationCosts: Number(row.renovation_costs),
  tenYearRepairs: Number(row.ten_year_repairs), expectedMonthlyRent: Number(row.expected_monthly_rent), actualMonthlyRent: Number(row.actual_monthly_rent),
  vacancyRate: Number(row.vacancy_rate), immediateSalePrice: Number(row.immediate_sale_price), holdingYears: Number(row.holding_years),
  futureSalePrice: Number(row.future_sale_price), loanAmount: Number(row.loan_amount), interestRate: Number(row.interest_rate),
  loanYears: Number(row.loan_years), annualOperatingCosts: Number(row.annual_operating_costs), notes: String(row.notes ?? ""),
});

const candidateToDb = (row: PurchaseCandidate, userId: string) => ({
  id: row.id, user_id: userId, name: row.name, purchase_price: row.purchasePrice, acquisition_costs: row.acquisitionCosts,
  land_valuation: row.landValuation, building_valuation: row.buildingValuation, renovation_costs: row.renovationCosts,
  ten_year_repairs: row.tenYearRepairs, expected_monthly_rent: row.expectedMonthlyRent, actual_monthly_rent: row.actualMonthlyRent,
  vacancy_rate: row.vacancyRate, immediate_sale_price: row.immediateSalePrice, holding_years: row.holdingYears,
  future_sale_price: row.futureSalePrice, loan_amount: row.loanAmount, interest_rate: row.interestRate,
  loan_years: row.loanYears, annual_operating_costs: row.annualOperatingCosts, notes: row.notes,
});

const assumptionsFromDb = (row?: Record<string, unknown>): PurchaseAssumptions => row ? ({
  propertyTaxRate: Number(row.property_tax_rate), cityPlanningTaxRate: Number(row.city_planning_tax_rate),
  landAcquisitionBaseRate: Number(row.land_acquisition_base_rate), landAcquisitionTaxRate: Number(row.land_acquisition_tax_rate),
  buildingAcquisitionTaxRate: Number(row.building_acquisition_tax_rate), landRegistrationTaxRate: Number(row.land_registration_tax_rate),
  buildingRegistrationTaxRate: Number(row.building_registration_tax_rate),
}) : demoData.purchaseAssumptions;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const mode = supabase ? "supabase" : "demo";
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState(mode === "supabase" ? emptyData : demoData);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<Context["syncState"]>("idle");
  const hydrated = useRef(false);
  const authStarted = useRef(false);

  useEffect(() => {
    if (authStarted.current) return;
    authStarted.current = true;
    if (!supabase) {
      try {
        const saved = localStorage.getItem("rental-manager-data");
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          setData({ ...demoData, ...parsed, purchaseCandidates: parsed.purchaseCandidates ?? [], purchaseAssumptions: parsed.purchaseAssumptions ?? demoData.purchaseAssumptions });
        }
      } finally { hydrated.current = true; setReady(true); }
      return;
    }
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setReady(true);
        if (pathname !== "/login") router.replace("/login");
        return;
      }
      setUserId(auth.user.id);
      if (pathname === "/login") { router.replace("/"); return; }
      const [properties, units, contracts, charges, settings, candidates, assumptions] = await Promise.all([
        supabase.from("properties").select("*").order("property_code"), supabase.from("units").select("*").order("unit_code"),
        supabase.from("contracts").select("*").order("contract_code"), supabase.from("monthly_charges").select("*").order("billing_month"),
        supabase.from("app_settings").select("*").maybeSingle(), supabase.from("purchase_candidates").select("*").order("created_at"),
        supabase.from("purchase_assumptions").select("*").maybeSingle(),
      ]);
      const firstError = [properties, units, contracts, charges, settings, candidates, assumptions].find((result) => result.error)?.error;
      if (firstError) { console.error(firstError); setSyncState("error"); setReady(true); return; }
      const loaded: AppData = {
        properties: (properties.data ?? []) as AppData["properties"], units: (units.data ?? []) as AppData["units"],
        contracts: (contracts.data ?? []) as AppData["contracts"], charges: (charges.data ?? []) as AppData["charges"],
        settings: settings.data ? { target_year: settings.data.target_year, prorate_enabled: settings.data.prorate_enabled, default_billing_day: settings.data.default_billing_day, default_payment_due_day: settings.data.default_payment_due_day } : demoData.settings,
        purchaseCandidates: ((candidates.data ?? []) as Record<string, unknown>[]).map(candidateFromDb),
        purchaseAssumptions: assumptionsFromDb(assumptions.data as Record<string, unknown> | undefined),
      };
      setData(loaded); hydrated.current = true; setSyncState("saved"); setReady(true);
    })();
    return () => { active = false; };
  }, [pathname, router, supabase]);

  const sync = useCallback(async (snapshot: AppData, uid: string) => {
    if (!supabase) return;
    setSyncState("saving");
    const tables = [
      ["properties", snapshot.properties], ["units", snapshot.units], ["contracts", snapshot.contracts], ["monthly_charges", snapshot.charges],
    ] as const;
    try {
      for (const [table, rows] of tables) {
        const { data: current, error: readError } = await supabase.from(table).select("id");
        if (readError) throw readError;
        const ids = new Set(rows.map((row) => row.id));
        const removed = (current ?? []).map((row) => row.id).filter((id) => !ids.has(id));
        if (removed.length) { const { error } = await supabase.from(table).delete().in("id", removed); if (error) throw error; }
        if (rows.length) { const { error } = await supabase.from(table).upsert(rows.map((row) => ({ ...row, user_id: uid }))); if (error) throw error; }
      }
      const { error: settingsError } = await supabase.from("app_settings").upsert({ user_id: uid, ...snapshot.settings }, { onConflict: "user_id" });
      if (settingsError) throw settingsError;
      const { data: currentCandidates, error: candidateReadError } = await supabase.from("purchase_candidates").select("id");
      if (candidateReadError) throw candidateReadError;
      const candidateIds = new Set(snapshot.purchaseCandidates.map((row) => row.id));
      const removedCandidates = (currentCandidates ?? []).map((row) => row.id).filter((id) => !candidateIds.has(id));
      if (removedCandidates.length) { const { error } = await supabase.from("purchase_candidates").delete().in("id", removedCandidates); if (error) throw error; }
      if (snapshot.purchaseCandidates.length) { const { error } = await supabase.from("purchase_candidates").upsert(snapshot.purchaseCandidates.map((row) => candidateToDb(row, uid))); if (error) throw error; }
      const a = snapshot.purchaseAssumptions;
      const { error: assumptionsError } = await supabase.from("purchase_assumptions").upsert({ user_id: uid, property_tax_rate: a.propertyTaxRate, city_planning_tax_rate: a.cityPlanningTaxRate, land_acquisition_base_rate: a.landAcquisitionBaseRate, land_acquisition_tax_rate: a.landAcquisitionTaxRate, building_acquisition_tax_rate: a.buildingAcquisitionTaxRate, land_registration_tax_rate: a.landRegistrationTaxRate, building_registration_tax_rate: a.buildingRegistrationTaxRate }, { onConflict: "user_id" });
      if (assumptionsError) throw assumptionsError;
      setSyncState("saved");
    } catch (error) { console.error(error); setSyncState("error"); }
  }, [supabase]);

  useEffect(() => {
    if (!ready || !hydrated.current) return;
    if (!supabase) { localStorage.setItem("rental-manager-data", JSON.stringify(data)); return; }
    if (!userId) return;
    const timer = window.setTimeout(() => sync(data, userId), 600);
    return () => window.clearTimeout(timer);
  }, [data, ready, supabase, sync, userId]);

  return <AppContext.Provider value={{ data, setData, ready, mode, syncState, reset: () => setData(mode === "supabase" ? emptyData : demoData) }}>{children}</AppContext.Provider>;
}

export function useApp() { const value = useContext(AppContext); if (!value) throw new Error("AppProvider is missing"); return value; }

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { demoData } from "@/lib/demo-data";
import {
  createAppRepository,
  candidateFromDb,
} from "@/lib/repositories/app-repository";
import { createClient } from "@/lib/supabase/client";
import type {
  AppData,
  AppSettings,
  Attachment,
  AttachmentCategory,
  Contract,
  MonthlyCharge,
  Property,
  PurchaseAssumptions,
  PurchaseCandidate,
  Reminder,
  Task,
  Unit,
} from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type Actions = {
  createProperty(row: Property): Promise<void>;
  updateProperty(id: string, patch: Partial<Property>): Promise<void>;
  deleteProperty(id: string): Promise<void>;
  createUnit(row: Unit): Promise<void>;
  updateUnit(id: string, patch: Partial<Unit>): Promise<void>;
  deleteUnit(id: string): Promise<void>;
  createContract(row: Contract): Promise<void>;
  updateContract(id: string, patch: Partial<Contract>): Promise<void>;
  deleteContract(id: string): Promise<void>;
  createMonthlyCharge(row: MonthlyCharge): Promise<void>;
  createMonthlyCharges(rows: MonthlyCharge[]): Promise<void>;
  updateMonthlyCharge(id: string, patch: Partial<MonthlyCharge>): Promise<void>;
  deleteMonthlyCharge(id: string): Promise<void>;
  createTask(row: Task): Promise<void>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  createReminder(row: Reminder): Promise<void>;
  updateReminder(id: string, patch: Partial<Reminder>): Promise<void>;
  deleteReminder(id: string): Promise<void>;
  uploadAttachment(
    contractId: string,
    category: AttachmentCategory,
    file: File,
  ): Promise<void>;
  attachmentUrl(row: Attachment): Promise<string>;
  deleteAttachment(row: Attachment): Promise<void>;
  createPurchaseCandidate(row: PurchaseCandidate): Promise<void>;
  updatePurchaseCandidate(id: string, patch: Partial<PurchaseCandidate>): void;
  deletePurchaseCandidate(id: string): Promise<void>;
  updateSettingsLocal(patch: Partial<AppSettings>): void;
  saveSettings(): Promise<void>;
  updatePurchaseAssumptions(patch: Partial<PurchaseAssumptions>): void;
  nextCode(
    type: "property" | "unit" | "contract" | "billing",
    propertyCode?: string,
    year?: number,
  ): Promise<string>;
};
type Context = {
  data: AppData;
  actions: Actions;
  ready: boolean;
  mode: "supabase" | "demo";
  syncState: SaveState;
  saveError: string | null;
  clearSaveError(): void;
};
const AppContext = createContext<Context | null>(null);
const emptyData: AppData = {
  ...demoData,
  properties: [],
  units: [],
  contracts: [],
  charges: [],
  purchaseCandidates: [],
  tasks: [],
  reminders: [],
  attachments: [],
};
const assumptionsFromDb = (
  row?: Record<string, unknown>,
): PurchaseAssumptions =>
  row
    ? {
        propertyTaxRate: Number(row.property_tax_rate),
        cityPlanningTaxRate: Number(row.city_planning_tax_rate),
        landAcquisitionBaseRate: Number(row.land_acquisition_base_rate),
        landAcquisitionTaxRate: Number(row.land_acquisition_tax_rate),
        buildingAcquisitionTaxRate: Number(row.building_acquisition_tax_rate),
        landRegistrationTaxRate: Number(row.land_registration_tax_rate),
        buildingRegistrationTaxRate: Number(row.building_registration_tax_rate),
      }
    : demoData.purchaseAssumptions;
const normalizeContract = (row: Contract): Contract => ({
  ...row,
  renewal_method: row.renewal_method ?? "",
  auto_renew: row.auto_renew ?? false,
  requires_recontract: row.requires_recontract ?? false,
  renewal_cycle_months: row.renewal_cycle_months ?? null,
  renewal_fee: Number(row.renewal_fee ?? 0),
  guarantor_enabled: row.guarantor_enabled ?? false,
  guarantor_company_name: row.guarantor_company_name ?? "",
  guarantor_contract_number: row.guarantor_contract_number ?? "",
  guarantor_start_date: row.guarantor_start_date ?? null,
  guarantor_end_date: row.guarantor_end_date ?? null,
  guarantor_renewal_date: row.guarantor_renewal_date ?? null,
  guarantor_fee: Number(row.guarantor_fee ?? 0),
  guarantor_notes: row.guarantor_notes ?? "",
  bank_name: row.bank_name ?? "",
  bank_branch: row.bank_branch ?? "",
  bank_account_type: row.bank_account_type ?? "",
  bank_account_number: row.bank_account_number ?? "",
  bank_account_holder: row.bank_account_holder ?? "",
  transfer_name: row.transfer_name ?? "",
  cancellation_notice_date: row.cancellation_notice_date ?? null,
  cancellation_planned_date: row.cancellation_planned_date ?? null,
  cancellation_completed_date: row.cancellation_completed_date ?? null,
  restoration_cost: Number(row.restoration_cost ?? 0),
  deposit_refund: Number(row.deposit_refund ?? 0),
  cancellation_notes: row.cancellation_notes ?? "",
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []),
    mode = supabase ? "supabase" : "demo";
  const pathname = usePathname(),
    router = useRouter();
  const [data, setData] = useState(mode === "supabase" ? emptyData : demoData);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const [ready, setReady] = useState(false),
    [userId, setUserId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SaveState>("idle"),
    [saveError, setSaveError] = useState<string | null>(null);
  const authStarted = useRef(false),
    queues = useRef(new Map<string, Promise<void>>()),
    timers = useRef(new Map<string, number>());
  const repository = useMemo(
    () => (supabase && userId ? createAppRepository(supabase, userId) : null),
    [supabase, userId],
  );

  useEffect(() => {
    if (authStarted.current) return;
    authStarted.current = true;
    if (!supabase) {
      try {
        const saved = localStorage.getItem("rental-manager-data");
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          setData({
            ...demoData,
            ...parsed,
            contracts: (parsed.contracts ?? demoData.contracts).map(
              normalizeContract,
            ),
            tasks: parsed.tasks ?? [],
            reminders: parsed.reminders ?? [],
            attachments: parsed.attachments ?? [],
          });
        }
      } finally {
        setReady(true);
      }
      return;
    }
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setReady(true);
        if (pathname !== "/login") router.replace("/login");
        return;
      }
      setUserId(auth.user.id);
      if (pathname === "/login") {
        router.replace("/");
        return;
      }
      const today = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Tokyo",
      });
      const automaticBilling = await supabase.rpc(
        "process_automatic_billing",
        { target_date: today },
      );
      if (automaticBilling.error && automaticBilling.error.code !== "PGRST202")
        console.warn("Automatic billing failed:", automaticBilling.error.message);
      const results = await Promise.all([
        supabase.from("properties").select("*").order("property_code"),
        supabase.from("units").select("*").order("unit_code"),
        supabase.from("contracts").select("*").order("contract_code"),
        supabase.from("monthly_charges").select("*").order("billing_month"),
        supabase.from("app_settings").select("*").maybeSingle(),
        supabase.from("purchase_candidates").select("*").order("created_at"),
        supabase.from("purchase_assumptions").select("*").maybeSingle(),
        supabase.from("tasks").select("*").order("due_date"),
        supabase.from("reminders").select("*").order("due_date"),
        supabase
          .from("attachments")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      const failed = results.slice(0, 7).find((x) => x.error)?.error;
      if (failed) {
        setSaveError(failed.message);
        setSyncState("error");
        setReady(true);
        return;
      }
      const [
        properties,
        units,
        contracts,
        charges,
        settings,
        candidates,
        assumptions,
        tasks,
        reminders,
        attachments,
      ] = results;
      for (const optional of [tasks, reminders, attachments]) {
        if (optional.error)
          console.warn(
            "Optional rental feature is not migrated yet:",
            optional.error.message,
          );
      }
      setData({
        properties: (properties.data ?? []) as Property[],
        units: (units.data ?? []) as Unit[],
        contracts: ((contracts.data ?? []) as Contract[]).map(
          normalizeContract,
        ),
        charges: (charges.data ?? []) as MonthlyCharge[],
        settings: settings.data
          ? {
              target_year: settings.data.target_year,
              prorate_enabled: settings.data.prorate_enabled,
              default_billing_day: settings.data.default_billing_day,
              default_payment_due_day: settings.data.default_payment_due_day,
              operation_start_date: settings.data.operation_start_date ?? null,
              opening_total_billed: Number(
                settings.data.opening_total_billed ?? 0,
              ),
              opening_total_paid: Number(settings.data.opening_total_paid ?? 0),
              opening_balance_through_date:
                settings.data.opening_balance_through_date ?? null,
            }
          : demoData.settings,
        purchaseCandidates: (
          (candidates.data ?? []) as Record<string, unknown>[]
        ).map(candidateFromDb),
        purchaseAssumptions: assumptionsFromDb(
          assumptions.data as Record<string, unknown> | undefined,
        ),
        tasks: (tasks.data ?? []) as Task[],
        reminders: (reminders.data ?? []) as Reminder[],
        attachments: (attachments.data ?? []) as Attachment[],
      });
      setSyncState("saved");
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [pathname, router, supabase]);

  useEffect(() => {
    if (ready && !supabase)
      localStorage.setItem("rental-manager-data", JSON.stringify(data));
  }, [data, ready, supabase]);
  const persist = useCallback(
    (key: string, operation: () => Promise<void>) => {
      if (!repository) return Promise.resolve();
      setSyncState("saving");
      setSaveError(null);
      const previous = queues.current.get(key) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(operation)
        .then(() => setSyncState("saved"))
        .catch((error: unknown) => {
          setSyncState("error");
          setSaveError(
            error instanceof Error ? error.message : "保存に失敗しました",
          );
          throw error;
        });
      queues.current.set(key, next);
      return next;
    },
    [repository],
  );
  const debounce = useCallback(
    (key: string, operation: () => Promise<void>) => {
      const old = timers.current.get(key);
      if (old) window.clearTimeout(old);
      timers.current.set(
        key,
        window.setTimeout(() => {
          timers.current.delete(key);
          void persist(key, operation).catch(() => undefined);
        }, 500),
      );
    },
    [persist],
  );

  const actions = useMemo<Actions>(() => {
    const add = <
      K extends
        | "properties"
        | "units"
        | "contracts"
        | "charges"
        | "tasks"
        | "reminders"
        | "attachments",
    >(
      key: K,
      row: AppData[K][number],
    ) => setData((d) => ({ ...d, [key]: [...d[key], row] }));
    const patch = <
      K extends
        | "properties"
        | "units"
        | "contracts"
        | "charges"
        | "tasks"
        | "reminders",
    >(
      key: K,
      id: string,
      values: object,
    ) =>
      setData((d) => ({
        ...d,
        [key]: d[key].map((row) =>
          row.id === id ? { ...row, ...values } : row,
        ),
      }));
    const remove = <
      K extends
        | "properties"
        | "units"
        | "contracts"
        | "charges"
        | "tasks"
        | "reminders"
        | "attachments",
    >(
      key: K,
      id: string,
    ) =>
      setData((d) => ({ ...d, [key]: d[key].filter((row) => row.id !== id) }));
    return {
      async createProperty(row) {
        add("properties", row);
        await persist(
          `property:${row.id}`,
          () => repository?.createProperty(row) ?? Promise.resolve(),
        );
      },
      async updateProperty(id, values) {
        patch("properties", id, values);
        await persist(
          `property:${id}`,
          () => repository?.updateProperty(id, values) ?? Promise.resolve(),
        );
      },
      async deleteProperty(id) {
        await persist(
          `property:${id}`,
          () => repository?.deleteProperty(id) ?? Promise.resolve(),
        );
        setData((d) => ({
          ...d,
          properties: d.properties.filter((x) => x.id !== id),
          units: d.units.filter((x) => x.property_id !== id),
          contracts: d.contracts.filter((x) => x.property_id !== id),
          charges: d.charges.filter((x) => x.property_id !== id),
          attachments: d.attachments.filter(
            (x) =>
              !d.contracts.some(
                (c) => c.property_id === id && c.id === x.contract_id,
              ),
          ),
        }));
      },
      async createUnit(row) {
        add("units", row);
        await persist(
          `unit:${row.id}`,
          () => repository?.createUnit(row) ?? Promise.resolve(),
        );
      },
      async updateUnit(id, values) {
        patch("units", id, values);
        await persist(
          `unit:${id}`,
          () => repository?.updateUnit(id, values) ?? Promise.resolve(),
        );
      },
      async deleteUnit(id) {
        await persist(
          `unit:${id}`,
          () => repository?.deleteUnit(id) ?? Promise.resolve(),
        );
        setData((d) => ({
          ...d,
          units: d.units.filter((x) => x.id !== id),
          contracts: d.contracts.filter((x) => x.unit_id !== id),
          charges: d.charges.filter((x) => x.unit_id !== id),
          attachments: d.attachments.filter(
            (x) =>
              !d.contracts.some(
                (c) => c.unit_id === id && c.id === x.contract_id,
              ),
          ),
        }));
      },
      async createContract(row) {
        add("contracts", row);
        await persist(
          `contract:${row.id}`,
          () => repository?.createContract(row) ?? Promise.resolve(),
        );
      },
      async updateContract(id, values) {
        patch("contracts", id, values);
        await persist(
          `contract:${id}`,
          () => repository?.updateContract(id, values) ?? Promise.resolve(),
        );
      },
      async deleteContract(id) {
        await persist(
          `contract:${id}`,
          () => repository?.deleteContract(id) ?? Promise.resolve(),
        );
        setData((d) => ({
          ...d,
          contracts: d.contracts.filter((x) => x.id !== id),
          charges: d.charges.filter((x) => x.contract_id !== id),
          attachments: d.attachments.filter((x) => x.contract_id !== id),
        }));
      },
      async createMonthlyCharge(row) {
        add("charges", row);
        await persist(
          `charge:${row.id}`,
          () => repository?.createMonthlyCharge(row) ?? Promise.resolve(),
        );
      },
      async createMonthlyCharges(rows) {
        setData((d) => ({ ...d, charges: [...d.charges, ...rows] }));
        await persist(
          "charges:create",
          () => repository?.createMonthlyCharges(rows) ?? Promise.resolve(),
        );
      },
      async updateMonthlyCharge(id, values) {
        patch("charges", id, values);
        await persist(
          `charge:${id}`,
          () =>
            repository?.updateMonthlyCharge(id, values) ?? Promise.resolve(),
        );
      },
      async deleteMonthlyCharge(id) {
        await persist(
          `charge:${id}`,
          () => repository?.deleteMonthlyCharge(id) ?? Promise.resolve(),
        );
        remove("charges", id);
      },
      async createTask(row) {
        add("tasks", row);
        await persist(
          `task:${row.id}`,
          () => repository?.createTask(row) ?? Promise.resolve(),
        );
      },
      async updateTask(id, values) {
        patch("tasks", id, values);
        await persist(
          `task:${id}`,
          () => repository?.updateTask(id, values) ?? Promise.resolve(),
        );
      },
      async deleteTask(id) {
        await persist(
          `task:${id}`,
          () => repository?.deleteTask(id) ?? Promise.resolve(),
        );
        remove("tasks", id);
      },
      async createReminder(row) {
        add("reminders", row);
        await persist(
          `reminder:${row.id}`,
          () => repository?.createReminder(row) ?? Promise.resolve(),
        );
      },
      async updateReminder(id, values) {
        patch("reminders", id, values);
        await persist(
          `reminder:${id}`,
          () => repository?.updateReminder(id, values) ?? Promise.resolve(),
        );
      },
      async deleteReminder(id) {
        await persist(
          `reminder:${id}`,
          () => repository?.deleteReminder(id) ?? Promise.resolve(),
        );
        remove("reminders", id);
      },
      async uploadAttachment(contractId, category, file) {
        if (!repository) {
          add("attachments", {
            id: crypto.randomUUID(),
            user_id: "demo-user",
            contract_id: contractId,
            category,
            file_name: file.name,
            storage_path: "",
            mime_type: file.type,
            file_size: file.size,
            created_at: new Date().toISOString(),
          });
          return;
        }
        let row: Attachment | null = null;
        await persist(`attachment-upload:${contractId}`, async () => {
          row = await repository.uploadAttachment(contractId, category, file);
        });
        if (row) add("attachments", row);
      },
      async attachmentUrl(row) {
        return repository ? repository.attachmentUrl(row.storage_path) : "";
      },
      async deleteAttachment(row) {
        await persist(
          `attachment:${row.id}`,
          () => repository?.deleteAttachment(row) ?? Promise.resolve(),
        );
        remove("attachments", row.id);
      },
      async createPurchaseCandidate(row) {
        setData((d) => ({
          ...d,
          purchaseCandidates: [...d.purchaseCandidates, row],
        }));
        await persist(
          `candidate:${row.id}`,
          () => repository?.createPurchaseCandidate(row) ?? Promise.resolve(),
        );
      },
      updatePurchaseCandidate(id, values) {
        setData((d) => ({
          ...d,
          purchaseCandidates: d.purchaseCandidates.map((row) =>
            row.id === id ? { ...row, ...values } : row,
          ),
        }));
        debounce(`candidate:${id}`, () => {
          const current = dataRef.current.purchaseCandidates.find(
            (row) => row.id === id,
          );
          return current && repository
            ? repository.updatePurchaseCandidate(current)
            : Promise.resolve();
        });
      },
      async deletePurchaseCandidate(id) {
        await persist(
          `candidate:${id}`,
          () => repository?.deletePurchaseCandidate(id) ?? Promise.resolve(),
        );
        setData((d) => ({
          ...d,
          purchaseCandidates: d.purchaseCandidates.filter(
            (row) => row.id !== id,
          ),
        }));
      },
      updateSettingsLocal(values) {
        setData((d) => ({ ...d, settings: { ...d.settings, ...values } }));
      },
      async saveSettings() {
        await persist(
          "settings",
          () =>
            repository?.updateSettings(dataRef.current.settings) ??
            Promise.resolve(),
        );
      },
      updatePurchaseAssumptions(values) {
        setData((d) => ({
          ...d,
          purchaseAssumptions: { ...d.purchaseAssumptions, ...values },
        }));
        debounce(
          "assumptions",
          () =>
            repository?.updatePurchaseAssumptions(
              dataRef.current.purchaseAssumptions,
            ) ?? Promise.resolve(),
        );
      },
      async nextCode(type, propertyCode, year) {
        if (repository) return repository.nextCode(type, propertyCode, year);
        const n = Date.now() % 10000;
        return type === "property"
          ? `P-${String(n).padStart(4, "0")}`
          : type === "unit"
            ? `${propertyCode ?? "P-0000"}-U-${String(n % 1000).padStart(3, "0")}`
            : `C-${year ?? new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
      },
    };
  }, [debounce, persist, repository]);

  return (
    <AppContext.Provider
      value={{
        data,
        actions,
        ready,
        mode,
        syncState,
        saveError,
        clearSaveError: () => setSaveError(null),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider is missing");
  return value;
}

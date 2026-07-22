import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Attachment,
  AttachmentCategory,
  AppSettings,
  Contract,
  GuaranteeCompanyMaster,
  BankAccountMaster,
  MonthlyCharge,
  Property,
  PurchaseAssumptions,
  PurchaseCandidate,
  Reminder,
  Task,
  Unit,
} from "@/types";

const assertOk = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export const candidateFromDb = (
  row: Record<string, unknown>,
): PurchaseCandidate => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  purchasePrice: Number(row.purchase_price),
  acquisitionCosts: Number(row.acquisition_costs),
  landValuation: Number(row.land_valuation),
  buildingValuation: Number(row.building_valuation),
  renovationCosts: Number(row.renovation_costs),
  tenYearRepairs: Number(row.ten_year_repairs),
  expectedMonthlyRent: Number(row.expected_monthly_rent),
  vacancyRate: Number(row.vacancy_rate),
  immediateSalePrice: Number(row.immediate_sale_price),
  holdingYears: Number(row.holding_years),
  futureSalePrice: Number(row.future_sale_price),
  loanAmount: Number(row.loan_amount),
  interestRate: Number(row.interest_rate),
  loanYears: Number(row.loan_years),
  annualOperatingCosts: Number(row.annual_operating_costs),
  notes: String(row.notes ?? ""),
});

export const candidateToDb = (row: PurchaseCandidate, userId: string) => ({
  id: row.id,
  user_id: userId,
  name: row.name,
  purchase_price: row.purchasePrice,
  acquisition_costs: row.acquisitionCosts,
  land_valuation: row.landValuation,
  building_valuation: row.buildingValuation,
  renovation_costs: row.renovationCosts,
  ten_year_repairs: row.tenYearRepairs,
  expected_monthly_rent: row.expectedMonthlyRent,
  vacancy_rate: row.vacancyRate,
  immediate_sale_price: row.immediateSalePrice,
  holding_years: row.holdingYears,
  future_sale_price: row.futureSalePrice,
  loan_amount: row.loanAmount,
  interest_rate: row.interestRate,
  loan_years: row.loanYears,
  annual_operating_costs: row.annualOperatingCosts,
  notes: row.notes,
});

export function createAppRepository(client: SupabaseClient, userId: string) {
  const insert = async <T extends { id: string }>(table: string, row: T) => {
    const { error } = await client
      .from(table)
      .insert({ ...row, user_id: userId });
    assertOk(error);
  };
  const update = async (table: string, id: string, patch: object) => {
    const { error } = await client
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId);
    assertOk(error);
  };
  const remove = async (table: string, id: string) => {
    const { error } = await client
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    assertOk(error);
  };
  const removeRelated = async (type: string, ids: string[]) => {
    if (!ids.length) return;
    for (const table of ["tasks", "reminders"]) {
      const { error } = await client
        .from(table)
        .delete()
        .eq("user_id", userId)
        .eq("related_type", type)
        .in("related_id", ids);
      assertOk(error);
    }
  };
  return {
    createProperty: (row: Property) => insert("properties", row),
    updateProperty: (id: string, patch: Partial<Property>) =>
      update("properties", id, patch),
    deleteProperty: async (id: string) => {
      const [{ data: units, error: unitReadError }, { data: contracts, error: contractReadError }] =
        await Promise.all([
          client.from("units").select("id").eq("property_id", id).eq("user_id", userId),
          client.from("contracts").select("id").eq("property_id", id).eq("user_id", userId),
        ]);
      assertOk(unitReadError);
      assertOk(contractReadError);
      await removeRelated("contract", (contracts ?? []).map((row) => row.id));
      await removeRelated("unit", (units ?? []).map((row) => row.id));
      await removeRelated("property", [id]);
      assertOk(
        (
          await client
            .from("monthly_charges")
            .delete()
            .eq("property_id", id)
            .eq("user_id", userId)
        ).error,
      );
      assertOk(
        (
          await client
            .from("contracts")
            .delete()
            .eq("property_id", id)
            .eq("user_id", userId)
        ).error,
      );
      assertOk(
        (
          await client
            .from("units")
            .delete()
            .eq("property_id", id)
            .eq("user_id", userId)
        ).error,
      );
      await remove("properties", id);
    },
    createUnit: (row: Unit) => insert("units", row),
    updateUnit: (id: string, patch: Partial<Unit>) =>
      update("units", id, patch),
    deleteUnit: async (id: string) => {
      const { data: contracts, error: contractReadError } = await client
        .from("contracts")
        .select("id")
        .eq("unit_id", id)
        .eq("user_id", userId);
      assertOk(contractReadError);
      await removeRelated("contract", (contracts ?? []).map((row) => row.id));
      await removeRelated("unit", [id]);
      assertOk(
        (
          await client
            .from("monthly_charges")
            .delete()
            .eq("unit_id", id)
            .eq("user_id", userId)
        ).error,
      );
      assertOk(
        (
          await client
            .from("contracts")
            .delete()
            .eq("unit_id", id)
            .eq("user_id", userId)
        ).error,
      );
      await remove("units", id);
    },
    createContract: (row: Contract) => insert("contracts", row),
    updateContract: (id: string, patch: Partial<Contract>) =>
      update("contracts", id, patch),
    deleteContract: async (id: string) => {
      await removeRelated("contract", [id]);
      const { data: documents, error: documentReadError } = await client
        .from("attachments")
        .select("storage_path")
        .eq("contract_id", id)
        .eq("user_id", userId);
      assertOk(documentReadError);
      if (documents?.length)
        assertOk(
          (
            await client.storage
              .from("contract-documents")
              .remove(documents.map((row) => row.storage_path))
          ).error,
        );
      assertOk(
        (
          await client
            .from("monthly_charges")
            .delete()
            .eq("contract_id", id)
            .eq("user_id", userId)
        ).error,
      );
      await remove("contracts", id);
    },
    deleteContractCharges: async (contractId: string) => {
      const { error } = await client
        .from("monthly_charges")
        .delete()
        .eq("contract_id", contractId)
        .eq("user_id", userId);
      assertOk(error);
    },
    createMonthlyCharge: (row: MonthlyCharge) => insert("monthly_charges", row),
    createMonthlyCharges: async (rows: MonthlyCharge[]) => {
      if (!rows.length) return;
      const { error } = await client
        .from("monthly_charges")
        .insert(rows.map((row) => ({ ...row, user_id: userId })));
      assertOk(error);
    },
    updateMonthlyCharge: (id: string, patch: Partial<MonthlyCharge>) =>
      update("monthly_charges", id, patch),
    deleteMonthlyCharge: (id: string) => remove("monthly_charges", id),
    createTask: (row: Task) => insert("tasks", row),
    updateTask: (id: string, patch: Partial<Task>) =>
      update("tasks", id, patch),
    deleteTask: (id: string) => remove("tasks", id),
    createReminder: (row: Reminder) => insert("reminders", row),
    updateReminder: (id: string, patch: Partial<Reminder>) =>
      update("reminders", id, patch),
    deleteReminder: (id: string) => remove("reminders", id),
    createGuaranteeCompanyMaster: (row: GuaranteeCompanyMaster) =>
      insert("guarantee_company_masters", row),
    updateGuaranteeCompanyMaster: (id: string, patch: Partial<GuaranteeCompanyMaster>) =>
      update("guarantee_company_masters", id, patch),
    deleteGuaranteeCompanyMaster: (id: string) =>
      remove("guarantee_company_masters", id),
    createBankAccountMaster: (row: BankAccountMaster) =>
      insert("bank_account_masters", row),
    updateBankAccountMaster: (id: string, patch: Partial<BankAccountMaster>) =>
      update("bank_account_masters", id, patch),
    deleteBankAccountMaster: (id: string) => remove("bank_account_masters", id),
    uploadAttachment: async (
      contractId: string,
      category: AttachmentCategory,
      file: File,
    ) => {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${userId}/${contractId}/${id}-${safeName}`;
      const { error: uploadError } = await client.storage
        .from("contract-documents")
        .upload(storagePath, file);
      assertOk(uploadError);
      const row: Attachment = {
        id,
        user_id: userId,
        contract_id: contractId,
        category,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
      const { error } = await client.from("attachments").insert(row);
      if (error) {
        await client.storage.from("contract-documents").remove([storagePath]);
        assertOk(error);
      }
      return row;
    },
    attachmentUrl: async (storagePath: string) => {
      const { data, error } = await client.storage
        .from("contract-documents")
        .createSignedUrl(storagePath, 60);
      assertOk(error);
      return data?.signedUrl ?? "";
    },
    deleteAttachment: async (row: Attachment) => {
      assertOk(
        (
          await client.storage
            .from("contract-documents")
            .remove([row.storage_path])
        ).error,
      );
      await remove("attachments", row.id);
    },
    createPurchaseCandidate: async (row: PurchaseCandidate) => {
      const { error } = await client
        .from("purchase_candidates")
        .insert(candidateToDb(row, userId));
      assertOk(error);
    },
    updatePurchaseCandidate: async (row: PurchaseCandidate) => {
      const values = candidateToDb(row, userId);
      const { id, user_id: _userId, ...patch } = values;
      void _userId;
      await update("purchase_candidates", id, patch);
    },
    deletePurchaseCandidate: (id: string) => remove("purchase_candidates", id),
    updateSettings: async (settings: AppSettings) => {
      const { error } = await client
        .from("app_settings")
        .upsert({ user_id: userId, ...settings }, { onConflict: "user_id" });
      assertOk(error);
    },
    updatePurchaseAssumptions: async (a: PurchaseAssumptions) => {
      const { error } = await client.from("purchase_assumptions").upsert(
        {
          user_id: userId,
          property_tax_rate: a.propertyTaxRate,
          city_planning_tax_rate: a.cityPlanningTaxRate,
          land_acquisition_base_rate: a.landAcquisitionBaseRate,
          land_acquisition_tax_rate: a.landAcquisitionTaxRate,
          building_acquisition_tax_rate: a.buildingAcquisitionTaxRate,
          land_registration_tax_rate: a.landRegistrationTaxRate,
          building_registration_tax_rate: a.buildingRegistrationTaxRate,
        },
        { onConflict: "user_id" },
      );
      assertOk(error);
    },
    nextCode: async (
      codeType: "property" | "unit" | "contract" | "billing",
      propertyCode?: string,
      year?: number,
    ) => {
      const { data, error } = await client.rpc("next_entity_code", {
        p_code_type: codeType,
        p_property_code: propertyCode ?? null,
        p_year: year ?? null,
      });
      assertOk(error);
      return String(data);
    },
  };
}

export type AppRepository = ReturnType<typeof createAppRepository>;

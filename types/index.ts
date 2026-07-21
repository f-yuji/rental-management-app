export type PropertyType =
  | "資材置き場"
  | "貸地"
  | "倉庫"
  | "月極駐車場"
  | "戸建"
  | "アパート"
  | "その他"
  | string;
export type UnitStatus = "空き" | "稼働" | "募集中" | "使用停止";
export type ContractStatus = "契約中" | "終了予定" | "終了" | "解約" | "下書き";
export type ContractType = "継続" | "定期" | "短期" | "その他";
export type PaymentStatus = "未入金" | "一部入金" | "入金済" | "対象外";

export interface Property {
  id: string;
  user_id: string;
  property_code: string;
  name: string;
  property_type: PropertyType;
  address: string;
  acquisition_date: string | null;
  acquisition_price: number;
  acquisition_costs: number;
  development_costs: number;
  current_valuation: number;
  remaining_debt: number;
  annual_property_tax: number;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Unit {
  id: string;
  user_id: string;
  property_id: string;
  unit_code: string;
  name: string;
  usage_type: string;
  area_sqm: number | null;
  vehicle_capacity: number | null;
  has_power: boolean;
  heavy_machinery_allowed: boolean;
  standard_rent: number;
  status: UnitStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Contract {
  id: string;
  user_id: string;
  contract_code: string;
  property_id: string;
  unit_id: string;
  tenant_name: string;
  tenant_phone: string | null;
  tenant_email: string | null;
  tenant_address: string | null;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  billing_day: number;
  payment_due_day: number;
  contract_type: ContractType;
  status: ContractStatus;
  deposit_amount: number;
  renewal_date: string | null;
  renewal_method: string;
  auto_renew: boolean;
  requires_recontract: boolean;
  renewal_cycle_months: number | null;
  renewal_fee: number;
  guarantor_enabled: boolean;
  guarantor_company_name: string;
  guarantor_contract_number: string;
  guarantor_start_date: string | null;
  guarantor_end_date: string | null;
  guarantor_renewal_date: string | null;
  guarantor_fee: number;
  guarantor_notes: string;
  bank_name: string;
  bank_branch: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  transfer_name: string;
  cancellation_notice_date: string | null;
  cancellation_planned_date: string | null;
  cancellation_completed_date: string | null;
  restoration_cost: number;
  deposit_refund: number;
  cancellation_notes: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export type RelatedEntityType =
  "property" | "unit" | "contract" | "construction" | "free";
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: "高" | "中" | "低";
  completed: boolean;
  related_type: RelatedEntityType;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}
export type ReminderType =
  | "契約更新"
  | "契約終了"
  | "保証会社更新"
  | "固定資産税"
  | "その他"
  | string;
export interface Reminder {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  title: string;
  due_date: string;
  related_type: RelatedEntityType;
  related_id: string | null;
  notes: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}
export type AttachmentCategory =
  "契約書" | "保証会社書類" | "本人確認" | "請求書" | "その他";
export interface Attachment {
  id: string;
  user_id: string;
  contract_id: string;
  category: AttachmentCategory;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}
export interface MonthlyCharge {
  id: string;
  user_id: string;
  billing_month: string;
  property_id: string;
  unit_id: string;
  contract_id: string;
  billed_amount: number;
  paid_amount: number;
  payment_date: string | null;
  payment_status: PaymentStatus;
  memo: string;
  created_at: string;
  updated_at: string;
}
export interface AppSettings {
  target_year: number;
  prorate_enabled: boolean;
  default_billing_day: number;
  default_payment_due_day: number;
  operation_start_date: string | null;
  opening_total_billed: number;
  opening_total_paid: number;
  opening_balance_through_date: string | null;
}
export interface PurchaseCandidate {
  id: string;
  name: string;
  purchasePrice: number;
  acquisitionCosts: number;
  landValuation: number;
  buildingValuation: number;
  renovationCosts: number;
  tenYearRepairs: number;
  expectedMonthlyRent: number;
  vacancyRate: number;
  immediateSalePrice: number;
  holdingYears: number;
  futureSalePrice: number;
  loanAmount: number;
  interestRate: number;
  loanYears: number;
  annualOperatingCosts: number;
  notes: string;
}
export interface PurchaseAssumptions {
  propertyTaxRate: number;
  cityPlanningTaxRate: number;
  landAcquisitionBaseRate: number;
  landAcquisitionTaxRate: number;
  buildingAcquisitionTaxRate: number;
  landRegistrationTaxRate: number;
  buildingRegistrationTaxRate: number;
}
export interface AppData {
  properties: Property[];
  units: Unit[];
  contracts: Contract[];
  charges: MonthlyCharge[];
  settings: AppSettings;
  purchaseCandidates: PurchaseCandidate[];
  purchaseAssumptions: PurchaseAssumptions;
  tasks: Task[];
  reminders: Reminder[];
  attachments: Attachment[];
}

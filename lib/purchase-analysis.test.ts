import { describe, expect, it } from "vitest";
import {
  analyzePurchase,
  annualPayment,
  remainingLoan,
  stressPurchase,
} from "./purchase-analysis";
import type { PurchaseAssumptions, PurchaseCandidate } from "@/types";
const assumptions: PurchaseAssumptions = {
  propertyTaxRate: 0.014,
  cityPlanningTaxRate: 0.003,
  landAcquisitionBaseRate: 0.5,
  landAcquisitionTaxRate: 0.03,
  buildingAcquisitionTaxRate: 0.04,
  landRegistrationTaxRate: 0.015,
  buildingRegistrationTaxRate: 0.02,
};
const candidate: PurchaseCandidate = {
  id: "1",
  name: "候補",
  purchasePrice: 10000000,
  acquisitionCosts: 500000,
  landValuation: 6000000,
  buildingValuation: 2000000,
  renovationCosts: 500000,
  tenYearRepairs: 1000000,
  expectedMonthlyRent: 120000,
  vacancyRate: 0.1,
  immediateSalePrice: 9000000,
  holdingYears: 10,
  futureSalePrice: 11000000,
  loanAmount: 7000000,
  interestRate: 0.02,
  loanYears: 20,
  annualOperatingCosts: 100000,
  notes: "",
};
describe("購入検討計算", () => {
  it("元利均等返済", () =>
    expect(Math.round(annualPayment(7000000, 0.02, 20))).toBe(428097));
  it("総投資額とNOI", () => {
    const a = analyzePurchase(candidate, assumptions);
    expect(a.initialTaxes).toBe(300000);
    expect(a.total).toBe(11300000);
    expect(a.noi).toBe(960000);
  });
  it("残債は返済により減少", () => {
    const p = annualPayment(7000000, 0.02, 20);
    expect(remainingLoan(7000000, 0.02, 20, p, 10)).toBeLessThan(7000000);
  });
  it("複合悪化でCFとDSCRが低下", () => {
    const base = stressPurchase(candidate, assumptions, 0, null, 0),
      bad = stressPurchase(candidate, assumptions, -0.1, 0.2, 0.01);
    expect(bad.cashFlow).toBeLessThan(base.cashFlow);
    expect(bad.dscr!).toBeLessThan(base.dscr!);
  });
});

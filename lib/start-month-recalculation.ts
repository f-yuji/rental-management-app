import { calculateCharge, paymentStatus } from "@/lib/calculations";
import type { Contract, MonthlyCharge, PaymentStatus } from "@/types";

export type StartMonthRecalculation = {
  charge: MonthlyCharge;
  contract: Contract;
  previousAmount: number;
  recalculatedAmount: number;
  difference: number;
  paymentStatus: PaymentStatus;
};

export function previewStartMonthRecalculations(
  contracts: Contract[],
  charges: MonthlyCharge[],
): StartMonthRecalculation[] {
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  return charges.flatMap((charge) => {
    const contract = contractsById.get(charge.contract_id);
    if (!contract || charge.billing_month.slice(0, 7) !== contract.start_date.slice(0, 7))
      return [];
    const recalculatedAmount = calculateCharge(contract, charge.billing_month, true);
    if (
      recalculatedAmount === charge.billed_amount &&
      charge.paid_amount <= recalculatedAmount
    )
      return [];
    return [{
      charge,
      contract,
      previousAmount: charge.billed_amount,
      recalculatedAmount,
      difference: recalculatedAmount - charge.billed_amount,
      paymentStatus: paymentStatus(recalculatedAmount, charge.paid_amount),
    }];
  }).sort((a, b) =>
    a.charge.billing_month.localeCompare(b.charge.billing_month) ||
    a.contract.contract_code.localeCompare(b.contract.contract_code),
  );
}

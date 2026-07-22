-- Historical recalculation may make an already received payment exceed the corrected bill.
-- Keep the actual receipt instead of silently reducing paid_amount.
alter table public.monthly_charges
  drop constraint if exists monthly_charges_paid_amount_check;
alter table public.monthly_charges
  drop constraint if exists monthly_charges_check;

alter table public.monthly_charges
  add constraint monthly_charges_paid_amount_check check (paid_amount >= 0);

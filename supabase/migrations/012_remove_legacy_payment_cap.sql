-- 001_initial.sql created this unnamed multi-column check as monthly_charges_check.
-- Remove it for databases where 011 was already applied before the legacy name was known.
alter table public.monthly_charges
  drop constraint if exists monthly_charges_check;

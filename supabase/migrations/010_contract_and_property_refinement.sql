alter table public.properties add column if not exists estimated_sale_price bigint check (estimated_sale_price is null or estimated_sale_price >= 0);
alter table public.properties add column if not exists estimated_sale_price_updated_at date;
alter table public.properties add column if not exists estimated_sale_price_notes text not null default '';

create table if not exists public.guarantee_company_masters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, contact_name text not null default '', phone text not null default '', email text not null default '',
  notes text not null default '', display_order integer not null default 0, is_active boolean not null default true,
  renewal_cycle_months integer check (renewal_cycle_months is null or renewal_cycle_months > 0),
  renewal_fee bigint not null default 0 check (renewal_fee >= 0), contract_number_default text not null default '',
  url text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bank_account_masters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  account_name text not null, bank_name text not null default '', bank_code text not null default '',
  branch_name text not null default '', branch_code text not null default '', account_type text not null default '普通',
  account_number text not null default '', account_holder text not null default '', notes text not null default '',
  display_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.contracts add column if not exists guarantee_company_master_id uuid references public.guarantee_company_masters(id) on delete set null;
alter table public.contracts add column if not exists guarantor_contact_name text not null default '';
alter table public.contracts add column if not exists guarantor_phone text not null default '';
alter table public.contracts add column if not exists guarantor_email text not null default '';
alter table public.contracts add column if not exists guarantor_url text not null default '';
alter table public.contracts add column if not exists bank_account_master_id uuid references public.bank_account_masters(id) on delete set null;

alter table public.contracts drop constraint if exists contracts_status_check;
alter table public.contracts drop constraint if exists contracts_contract_type_check;
alter table public.contracts drop constraint if exists contracts_termination_reason_check;
update public.contracts set contract_type = case contract_type
  when '継続' then '一般契約' when '定期' then '定期契約' when '短期' then '短期契約' else contract_type end;
update public.contracts set termination_reason = case termination_reason
  when '退去' then '途中解約' when '解約' then '途中解約' when '更新による終了' then '更新' else termination_reason end;
update public.contracts set status = case
  when status = '解約' then '終了'
  when status = '終了予定' and end_date < current_date then '終了'
  when status = '終了予定' then '契約中'
  else status end;
alter table public.contracts add constraint contracts_status_check check (status in ('契約中','終了','下書き'));
alter table public.contracts add constraint contracts_contract_type_check check (contract_type in ('一般契約','定期契約','短期契約','その他'));
alter table public.contracts add constraint contracts_termination_reason_check check (termination_reason in ('','契約満了','途中解約','更新','貸主都合','滞納・強制終了','その他'));

do $$ begin create trigger set_updated_at before update on public.guarantee_company_masters for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
do $$ begin create trigger set_updated_at before update on public.bank_account_masters for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
alter table public.guarantee_company_masters enable row level security;
alter table public.bank_account_masters enable row level security;
drop policy if exists "own guarantee company masters" on public.guarantee_company_masters;
create policy "own guarantee company masters" on public.guarantee_company_masters for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "own bank account masters" on public.bank_account_masters;
create policy "own bank account masters" on public.bank_account_masters for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.process_automatic_billing(target_date date default current_date)
returns table(created_count integer, paid_count integer, skipped_count integer)
language plpgsql security invoker as $$
declare
  c record; charge_id uuid; charge_billed bigint; charge_paid bigint; charge_memo text;
  month_start date := date_trunc('month', target_date)::date;
  month_end date := (date_trunc('month', target_date) + interval '1 month - 1 day')::date;
  billing_date date; payment_date_for_month date; rent_start date;
  amount bigint; days_in_month integer; active_days integer;
  made integer := 0; paid integer := 0; skipped integer := 0;
begin
  for c in select * from public.contracts where user_id=auth.uid() and status='契約中'
    and start_date<=month_end and (end_date is null or end_date>=month_start)
  loop
    billing_date := make_date(extract(year from month_start)::integer, extract(month from month_start)::integer, least(c.billing_day, extract(day from month_end)::integer));
    payment_date_for_month := make_date(extract(year from month_start)::integer, extract(month from month_start)::integer, least(c.payment_due_day, extract(day from month_end)::integer));
    charge_id := null; charge_billed := null; charge_paid := null; charge_memo := null;
    select id,billed_amount,paid_amount,memo into charge_id,charge_billed,charge_paid,charge_memo
      from public.monthly_charges where user_id=auth.uid() and billing_month=month_start and contract_id=c.id;
    if charge_id is null and target_date>=billing_date then
      rent_start := (c.start_date + make_interval(months=>c.free_rent_months))::date;
      amount := 0;
      if rent_start<=month_end then
        amount := c.monthly_rent;
        if date_trunc('month', rent_start)::date=month_start and extract(day from rent_start)::integer>1 then
          days_in_month := extract(day from month_end)::integer;
          active_days := month_end-rent_start+1;
          amount := round(c.monthly_rent::numeric*active_days/days_in_month)::bigint;
        end if;
      end if;
      if date_trunc('month',c.start_date)::date=month_start then amount:=amount+c.key_money; end if;
      if amount>0 then
        insert into public.monthly_charges(user_id,billing_month,property_id,unit_id,contract_id,billed_amount,paid_amount,payment_status,memo)
        values(auth.uid(),month_start,c.property_id,c.unit_id,c.id,amount,0,'未入金',case when c.key_money>0 and date_trunc('month',c.start_date)::date=month_start then '自動生成（礼金含む）' else '自動生成' end)
        returning id,billed_amount,paid_amount,memo into charge_id,charge_billed,charge_paid,charge_memo;
        made:=made+1;
      end if;
    elsif charge_id is not null then skipped:=skipped+1; end if;
    if charge_id is not null and target_date>=payment_date_for_month and charge_paid<charge_billed and coalesce(charge_memo,'') not like '%[手動管理]%' then
      update public.monthly_charges set paid_amount=billed_amount,payment_date=payment_date_for_month,payment_status='入金済',memo=case when memo='' then '自動入金' else memo||' / 自動入金' end where id=charge_id;
      paid:=paid+1;
    end if;
  end loop;
  return query select made,paid,skipped;
end; $$;
grant execute on function public.process_automatic_billing(date) to authenticated;

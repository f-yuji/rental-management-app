create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), property_code text not null,
  name text not null, property_type text not null, address text not null default '', acquisition_date date,
  acquisition_price bigint not null default 0 check(acquisition_price>=0), acquisition_costs bigint not null default 0 check(acquisition_costs>=0),
  development_costs bigint not null default 0 check(development_costs>=0), current_valuation bigint not null default 0 check(current_valuation>=0),
  remaining_debt bigint not null default 0 check(remaining_debt>=0), annual_property_tax bigint not null default 0 check(annual_property_tax>=0),
  notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,property_code)
);
create table public.units (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), property_id uuid not null references public.properties(id) on delete restrict,
  unit_code text not null, name text not null, usage_type text not null default '', area_sqm numeric check(area_sqm>=0), vehicle_capacity integer check(vehicle_capacity>=0),
  has_power boolean not null default false, heavy_machinery_allowed boolean not null default false, standard_rent bigint not null default 0 check(standard_rent>=0),
  status text not null check(status in ('空き','稼働','募集中','使用停止')), notes text not null default '', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(user_id,unit_code), unique(id,property_id), unique(id,user_id)
);
create table public.contracts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), contract_code text not null,
  property_id uuid not null references public.properties(id) on delete restrict, unit_id uuid not null,
  tenant_name text not null, tenant_phone text, tenant_email text, tenant_address text, start_date date not null, end_date date,
  monthly_rent bigint not null default 0 check(monthly_rent>=0), billing_day integer not null check(billing_day between 1 and 31),
  payment_due_day integer not null check(payment_due_day between 1 and 31), contract_type text not null check(contract_type in ('継続','定期','短期','その他')),
  status text not null check(status in ('契約中','終了予定','終了','解約','下書き')), deposit_amount bigint not null default 0 check(deposit_amount>=0),
  renewal_date date, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date is null or end_date>=start_date), unique(user_id,contract_code), unique(id,user_id),
  foreign key(unit_id,property_id) references public.units(id,property_id) on delete restrict,
  foreign key(unit_id,user_id) references public.units(id,user_id) on delete restrict
);
create table public.monthly_charges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), billing_month date not null check(billing_month=date_trunc('month',billing_month)::date),
  property_id uuid not null references public.properties(id) on delete restrict, unit_id uuid not null references public.units(id) on delete restrict,
  contract_id uuid not null, billed_amount bigint not null default 0 check(billed_amount>=0), paid_amount bigint not null default 0 check(paid_amount>=0 and paid_amount<=billed_amount),
  payment_date date, payment_status text not null check(payment_status in ('未入金','一部入金','入金済','対象外')), memo text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,billing_month,contract_id),
  foreign key(contract_id,user_id) references public.contracts(id,user_id) on delete restrict
);
create table public.app_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id), target_year integer not null,
  prorate_enabled boolean not null default false, default_billing_day integer not null check(default_billing_day between 1 and 31),
  default_payment_due_day integer not null check(default_payment_due_day between 1 and 31), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','properties','units','contracts','monthly_charges','app_settings'] loop
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t); end loop; end $$;

alter table public.profiles enable row level security; alter table public.properties enable row level security;
alter table public.units enable row level security; alter table public.contracts enable row level security;
alter table public.monthly_charges enable row level security; alter table public.app_settings enable row level security;
create policy "own profile" on public.profiles for all using(id=auth.uid()) with check(id=auth.uid());
create policy "own properties" on public.properties for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own units" on public.units for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own contracts" on public.contracts for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own monthly charges" on public.monthly_charges for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own settings" on public.app_settings for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.generate_monthly_charges(target_month date)
returns table(created_count integer, skipped_count integer) language plpgsql security invoker as $$
declare c record; amount bigint; made integer:=0; skipped integer:=0; days_in_month integer; active_days integer; settings_prorate boolean;
begin
  target_month:=date_trunc('month',target_month)::date;
  select coalesce(prorate_enabled,false) into settings_prorate from public.app_settings where user_id=auth.uid();
  for c in select * from public.contracts where user_id=auth.uid() and status not in ('解約','下書き')
    and start_date <= (target_month+interval '1 month-1 day')::date and (end_date is null or end_date>=target_month)
  loop
    if exists(select 1 from public.monthly_charges where user_id=auth.uid() and billing_month=target_month and contract_id=c.id) then skipped:=skipped+1; continue; end if;
    amount:=c.monthly_rent;
    if settings_prorate then
      days_in_month:=extract(day from (target_month+interval '1 month-1 day'))::integer;
      active_days:=least(coalesce(c.end_date,(target_month+interval '1 month-1 day')::date),(target_month+interval '1 month-1 day')::date)-greatest(c.start_date,target_month)+1;
      amount:=round(c.monthly_rent::numeric*active_days/days_in_month)::bigint;
    end if;
    insert into public.monthly_charges(user_id,billing_month,property_id,unit_id,contract_id,billed_amount,paid_amount,payment_status)
      values(auth.uid(),target_month,c.property_id,c.unit_id,c.id,amount,0,'未入金'); made:=made+1;
  end loop;
  return query select made,skipped;
end $$;

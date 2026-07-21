alter table public.app_settings add column if not exists operation_start_date date;
alter table public.app_settings add column if not exists opening_total_billed bigint not null default 0 check (opening_total_billed >= 0);
alter table public.app_settings add column if not exists opening_total_paid bigint not null default 0 check (opening_total_paid >= 0);
alter table public.app_settings add column if not exists opening_balance_through_date date;

create table if not exists public.code_sequences (
  user_id uuid not null references auth.users(id) on delete cascade,
  code_type text not null,
  sequence_year integer not null default 0,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, code_type, sequence_year)
);

alter table public.code_sequences enable row level security;
drop policy if exists "own code sequences" on public.code_sequences;
create policy "own code sequences" on public.code_sequences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.code_sequences (user_id, code_type, sequence_year, last_number)
select user_id, 'property', 0, max(substring(property_code from '^P-([0-9]+)$')::integer)
from public.properties where property_code ~ '^P-[0-9]+$' group by user_id
on conflict (user_id, code_type, sequence_year) do update set last_number = greatest(code_sequences.last_number, excluded.last_number);

insert into public.code_sequences (user_id, code_type, sequence_year, last_number)
select u.user_id, 'unit:' || upper(trim(p.property_code)), 0,
       max(substring(u.unit_code from '-U-([0-9]+)$')::integer)
from public.units u join public.properties p on p.id = u.property_id
where u.unit_code ~ '-U-[0-9]+$'
group by u.user_id, p.property_code
on conflict (user_id, code_type, sequence_year) do update set last_number = greatest(code_sequences.last_number, excluded.last_number);

insert into public.code_sequences (user_id, code_type, sequence_year, last_number)
select user_id, 'contract', substring(contract_code from '^C-([0-9]{4})-')::integer,
       max(substring(contract_code from '^C-[0-9]{4}-([0-9]+)$')::integer)
from public.contracts where contract_code ~ '^C-[0-9]{4}-[0-9]+$' group by user_id, substring(contract_code from '^C-([0-9]{4})-')
on conflict (user_id, code_type, sequence_year) do update set last_number = greatest(code_sequences.last_number, excluded.last_number);

create or replace function public.next_entity_code(
  p_code_type text,
  p_property_code text default null,
  p_year integer default null
) returns text language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_year integer := coalesce(p_year, extract(year from current_date)::integer);
  v_number integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_code_type not in ('property', 'unit', 'contract', 'billing') then raise exception 'Unknown code type'; end if;
  if p_code_type = 'unit' and coalesce(trim(p_property_code), '') = '' then raise exception 'Property code is required'; end if;
  v_key := case when p_code_type = 'unit' then 'unit:' || upper(trim(p_property_code)) else p_code_type end;
  insert into public.code_sequences(user_id, code_type, sequence_year, last_number)
  values(v_user, v_key, case when p_code_type in ('contract', 'billing') then v_year else 0 end, 1)
  on conflict(user_id, code_type, sequence_year) do update
    set last_number = code_sequences.last_number + 1, updated_at = now()
  returning last_number into v_number;
  return case p_code_type
    when 'property' then 'P-' || lpad(v_number::text, 4, '0')
    when 'unit' then upper(trim(p_property_code)) || '-U-' || lpad(v_number::text, 3, '0')
    when 'contract' then 'C-' || v_year::text || '-' || lpad(v_number::text, 4, '0')
    else 'B-' || v_year::text || '-' || lpad(v_number::text, 4, '0')
  end;
end $$;

grant execute on function public.next_entity_code(text, text, integer) to authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_user_code_unique') then
    alter table public.properties add constraint properties_user_code_unique unique(user_id, property_code);
  end if;
exception when duplicate_object then null; end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'units_user_code_unique') then
    alter table public.units add constraint units_user_code_unique unique(user_id, unit_code);
  end if;
exception when duplicate_object then null; end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_user_code_unique') then
    alter table public.contracts add constraint contracts_user_code_unique unique(user_id, contract_code);
  end if;
exception when duplicate_object then null; end $$;

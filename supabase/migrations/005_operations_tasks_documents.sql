alter table public.contracts add column if not exists renewal_method text not null default '';
alter table public.contracts add column if not exists auto_renew boolean not null default false;
alter table public.contracts add column if not exists requires_recontract boolean not null default false;
alter table public.contracts add column if not exists renewal_cycle_months integer check (renewal_cycle_months is null or renewal_cycle_months > 0);
alter table public.contracts add column if not exists renewal_fee bigint not null default 0 check (renewal_fee >= 0);
alter table public.contracts add column if not exists guarantor_enabled boolean not null default false;
alter table public.contracts add column if not exists guarantor_company_name text not null default '';
alter table public.contracts add column if not exists guarantor_contract_number text not null default '';
alter table public.contracts add column if not exists guarantor_start_date date;
alter table public.contracts add column if not exists guarantor_end_date date;
alter table public.contracts add column if not exists guarantor_renewal_date date;
alter table public.contracts add column if not exists guarantor_fee bigint not null default 0 check (guarantor_fee >= 0);
alter table public.contracts add column if not exists guarantor_notes text not null default '';
alter table public.contracts add column if not exists bank_name text not null default '';
alter table public.contracts add column if not exists bank_branch text not null default '';
alter table public.contracts add column if not exists bank_account_type text not null default '';
alter table public.contracts add column if not exists bank_account_number text not null default '';
alter table public.contracts add column if not exists bank_account_holder text not null default '';
alter table public.contracts add column if not exists transfer_name text not null default '';
alter table public.contracts add column if not exists cancellation_notice_date date;
alter table public.contracts add column if not exists cancellation_planned_date date;
alter table public.contracts add column if not exists cancellation_completed_date date;
alter table public.contracts add column if not exists restoration_cost bigint not null default 0 check (restoration_cost >= 0);
alter table public.contracts add column if not exists deposit_refund bigint not null default 0 check (deposit_refund >= 0);
alter table public.contracts add column if not exists cancellation_notes text not null default '';

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text not null default '', due_date date,
  priority text not null default '中' check (priority in ('高','中','低')), completed boolean not null default false,
  related_type text not null default 'free' check (related_type in ('property','unit','contract','construction','free')),
  related_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null, title text not null, due_date date not null,
  related_type text not null default 'free' check (related_type in ('property','unit','contract','construction','free')),
  related_id uuid, notes text not null default '', completed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  category text not null check (category in ('契約書','保証会社書類','本人確認','請求書','その他')),
  file_name text not null, storage_path text not null unique, mime_type text not null default '', file_size bigint not null default 0 check(file_size >= 0),
  created_at timestamptz not null default now()
);

do $$ begin create trigger set_updated_at before update on public.tasks for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
do $$ begin create trigger set_updated_at before update on public.reminders for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.attachments enable row level security;
drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "own attachments" on public.attachments;
create policy "own attachments" on public.attachments for all using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public) values('contract-documents','contract-documents',false)
on conflict(id) do nothing;
drop policy if exists "own contract documents select" on storage.objects;
create policy "own contract documents select" on storage.objects for select to authenticated
using(bucket_id='contract-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "own contract documents insert" on storage.objects;
create policy "own contract documents insert" on storage.objects for insert to authenticated
with check(bucket_id='contract-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "own contract documents delete" on storage.objects;
create policy "own contract documents delete" on storage.objects for delete to authenticated
using(bucket_id='contract-documents' and (storage.foldername(name))[1]=auth.uid()::text);

alter table public.contracts
  add column if not exists termination_reason text not null default '';

alter table public.contracts
  drop constraint if exists contracts_termination_reason_check;
alter table public.contracts
  add constraint contracts_termination_reason_check
  check (termination_reason in ('', '更新による終了', '退去', '解約', 'その他'));

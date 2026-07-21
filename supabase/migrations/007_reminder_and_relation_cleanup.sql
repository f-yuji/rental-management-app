-- Preserve old free-form reminder work by moving it to tasks.
insert into public.tasks (
  id, user_id, title, description, due_date, priority, completed,
  related_type, related_id, created_at, updated_at
)
select id, user_id, title, notes, due_date, '中', completed,
       case when related_type = 'construction' then 'free' else related_type end,
       related_id, created_at, updated_at
  from public.reminders
 where reminder_type = '任意タスク'
on conflict (id) do nothing;

-- Contract dates are displayed directly from contracts and must not be duplicated.
delete from public.reminders
 where reminder_type in ('任意タスク', '契約更新', '契約終了', '保証会社更新',
                         '車検', '建設業許可更新', '宅建更新');

alter table public.reminders
  drop constraint if exists reminders_reminder_type_check;
alter table public.reminders
  add constraint reminders_reminder_type_check
  check (reminder_type in ('固定資産税', 'その他'));

create or replace function public.cleanup_related_rows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.tasks
   where user_id = old.user_id
     and related_type = tg_argv[0]
     and related_id = old.id;
  delete from public.reminders
   where user_id = old.user_id
     and related_type = tg_argv[0]
     and related_id = old.id;
  return old;
end;
$$;

drop trigger if exists cleanup_property_relations on public.properties;
create trigger cleanup_property_relations before delete on public.properties
for each row execute function public.cleanup_related_rows('property');
drop trigger if exists cleanup_unit_relations on public.units;
create trigger cleanup_unit_relations before delete on public.units
for each row execute function public.cleanup_related_rows('unit');
drop trigger if exists cleanup_contract_relations on public.contracts;
create trigger cleanup_contract_relations before delete on public.contracts
for each row execute function public.cleanup_related_rows('contract');

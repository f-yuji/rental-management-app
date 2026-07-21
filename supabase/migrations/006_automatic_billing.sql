create or replace function public.process_automatic_billing(target_date date default current_date)
returns table(created_count integer, paid_count integer, skipped_count integer)
language plpgsql
security invoker
as $$
declare
  c record;
  charge record;
  month_start date := date_trunc('month', target_date)::date;
  month_end date := (date_trunc('month', target_date) + interval '1 month - 1 day')::date;
  billing_date date;
  payment_date_for_month date;
  amount bigint;
  days_in_month integer;
  active_days integer;
  settings_prorate boolean := false;
  made integer := 0;
  paid integer := 0;
  skipped integer := 0;
begin
  select coalesce(prorate_enabled, false)
    into settings_prorate
    from public.app_settings
   where user_id = auth.uid();

  for c in
    select * from public.contracts
     where user_id = auth.uid()
       and status not in ('解約', '下書き', '終了')
       and start_date <= month_end
       and (end_date is null or end_date >= month_start)
  loop
    billing_date := make_date(
      extract(year from month_start)::integer,
      extract(month from month_start)::integer,
      least(c.billing_day, extract(day from month_end)::integer)
    );
    payment_date_for_month := make_date(
      extract(year from month_start)::integer,
      extract(month from month_start)::integer,
      least(c.payment_due_day, extract(day from month_end)::integer)
    );

    select * into charge
      from public.monthly_charges
     where user_id = auth.uid()
       and billing_month = month_start
       and contract_id = c.id;

    if charge.id is null and target_date >= billing_date then
      amount := c.monthly_rent;
      if settings_prorate then
        days_in_month := extract(day from month_end)::integer;
        active_days := least(coalesce(c.end_date, month_end), month_end)
          - greatest(c.start_date, month_start) + 1;
        amount := round(c.monthly_rent::numeric * active_days / days_in_month)::bigint;
      end if;
      insert into public.monthly_charges(
        user_id, billing_month, property_id, unit_id, contract_id,
        billed_amount, paid_amount, payment_status, memo
      ) values (
        auth.uid(), month_start, c.property_id, c.unit_id, c.id,
        amount, 0, '未入金', '自動生成'
      )
      returning * into charge;
      made := made + 1;
    elsif charge.id is not null then
      skipped := skipped + 1;
    end if;

    if charge.id is not null
       and target_date >= payment_date_for_month
       and charge.paid_amount < charge.billed_amount
       and charge.memo not like '%[手動管理]%'
    then
      update public.monthly_charges
         set paid_amount = billed_amount,
             payment_date = payment_date_for_month,
             payment_status = '入金済',
             memo = case when memo = '' then '自動入金' else memo || ' / 自動入金' end
       where id = charge.id;
      paid := paid + 1;
    end if;
  end loop;

  return query select made, paid, skipped;
end;
$$;

grant execute on function public.process_automatic_billing(date) to authenticated;

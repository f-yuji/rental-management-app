-- Supabase Authで作成したユーザーIDへ置換して実行してください。
do $$ declare uid uuid := '00000000-0000-0000-0000-000000000001'; p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid(); u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); c3 uuid:=gen_random_uuid(); begin
insert into public.properties(id,user_id,property_code,name,property_type,address,acquisition_date,acquisition_price,acquisition_costs,development_costs,current_valuation,remaining_debt,annual_property_tax) values
(p1,uid,'P001','市沢資材置き場','資材置き場','横浜市旭区','2023-04-01',3200000,200000,500000,4500000,0,80000),
(p2,uid,'P002','大和資材置き場','資材置き場','大和市','2024-03-01',5000000,300000,700000,6500000,0,120000),
(p3,uid,'P003','相模原貸地','貸地','相模原市','2024-07-01',3800000,300000,700000,4000000,0,170000);
insert into public.units(id,user_id,property_id,unit_code,name,usage_type,area_sqm,vehicle_capacity,has_power,heavy_machinery_allowed,standard_rent,status) values
(u1,uid,p1,'A001','市沢1区画','資材置き場',80,2,true,true,30000,'稼働'),(u2,uid,p1,'A002','市沢2区画','資材置き場',90,3,false,true,32000,'稼働'),(u3,uid,p2,'B001','大和1区画','資材置き場',120,4,true,true,30000,'稼働');
insert into public.contracts(id,user_id,contract_code,property_id,unit_id,tenant_name,start_date,end_date,monthly_rent,billing_day,payment_due_day,contract_type,status,deposit_amount) values
(c1,uid,'C001',p1,u1,'借主A','2026-01-01',null,30000,1,31,'継続','契約中',0),(c2,uid,'C002',p1,u2,'借主B','2026-02-01','2026-08-31',32000,1,31,'定期','終了予定',0),(c3,uid,'C003',p2,u3,'借主C','2026-04-01',null,30000,1,31,'継続','契約中',0);
insert into public.monthly_charges(user_id,billing_month,property_id,unit_id,contract_id,billed_amount,paid_amount,payment_date,payment_status) values
(uid,'2026-04-01',p1,u1,c1,30000,30000,'2026-04-01','入金済'),(uid,'2026-04-01',p1,u2,c2,32000,32000,'2026-04-01','入金済'),(uid,'2026-04-01',p2,u3,c3,30000,30000,'2026-04-01','入金済');
insert into public.app_settings(user_id,target_year,prorate_enabled,default_billing_day,default_payment_due_day) values(uid,2026,false,1,31);
end $$;

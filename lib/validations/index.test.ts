import { expect,it } from "vitest";import { contractSchema } from ".";
it("終了日が開始日より前ならエラー",()=>expect(contractSchema.safeParse({contract_code:"C1",property_id:"p",unit_id:"u",tenant_name:"A",start_date:"2026-02-01",end_date:"2026-01-31",monthly_rent:0,billing_day:1,payment_due_day:31}).success).toBe(false));

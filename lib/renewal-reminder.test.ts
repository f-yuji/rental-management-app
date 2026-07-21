import { describe, expect, it } from "vitest";
import { renewalReminder } from "@/lib/calculations";

describe("renewal reminder", () => {
  const today = new Date(2026, 6, 21);

  it("does not show dates more than 60 days away", () => {
    expect(renewalReminder("2026-09-20", today)).toBeNull();
  });

  it("shows an upcoming renewal within 60 days", () => {
    expect(renewalReminder("2026-09-01", today)?.level).toBe("upcoming");
  });

  it("marks a renewal within 30 days as urgent", () => {
    expect(renewalReminder("2026-08-01", today)).toMatchObject({
      daysRemaining: 11,
      level: "urgent",
    });
  });

  it("keeps overdue renewals visible", () => {
    expect(renewalReminder("2026-07-01", today)).toMatchObject({
      daysRemaining: -20,
      level: "overdue",
    });
  });
});

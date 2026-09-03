import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/0005_staff_and_escalations.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("staff and escalation migration", () => {
  it("is atomic and contains no pasted Markdown", () => {
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("```");
    expect(migration).not.toMatch(/\[cite(?:ation)?:/i);
  });

  it("keeps all public workflow functions service-role only", () => {
    for (const signature of [
      "resolve_staff_identity(uuid, uuid)",
      "load_escalation_context(uuid, uuid, uuid, uuid, uuid)",
      "create_patient_escalation(uuid, uuid, uuid, uuid, uuid, text[], uuid[], text)",
      "list_warm_leads(uuid, uuid)",
      "list_staff_escalations(uuid, uuid)",
      "create_staff_referral(uuid, uuid, text, text, integer, text)",
      "get_staff_funnel_metrics(uuid, uuid)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(normalized).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }
  });

  it("uses role-specific staff access", () => {
    expect(normalized).toContain("array['staff', 'nurse', 'clinician']");
    expect(normalized).toContain("array['nurse', 'clinician']");
    expect(normalized).toContain("staff_user.clinic_id = p_clinic_id");
  });

  it("creates an idempotent, consented escalation and funnel event", () => {
    expect(normalized).toContain("current_consent_status is distinct from 'granted'");
    expect(normalized).toContain("where escalation.trigger_message_id = p_trigger_message_id");
    expect(normalized).toContain("insert into public.escalations");
    expect(normalized).toContain("'escalation_sent'");
    expect(normalized).not.toContain("'12-18 hours'");
  });

  it("never returns the stored referral-token hash", () => {
    expect(normalized).toContain("p_token_hash text");
    expect(normalized).toContain("return to_jsonb(referral_row) - 'token_hash'");
    expect(normalized).not.toMatch(/\bp_raw_token\b/);
  });

  it("derives lead scores without clinical risk", () => {
    const warmLeadFunction = normalized.slice(
      normalized.indexOf("create function public.list_warm_leads"),
      normalized.indexOf("create function public.list_staff_escalations"),
    );
    expect(warmLeadFunction).toContain("warm_lead_score");
    expect(warmLeadFunction).toContain("source_channel");
    expect(warmLeadFunction).toContain("identity_level");
    expect(warmLeadFunction).toContain("stage_rank");
    expect(warmLeadFunction).not.toContain("risk_level");
  });

  it("calculates every metric from stored funnel events", () => {
    expect(normalized).toContain("from channels as channel left join public.funnel_events");
    expect(normalized).toContain("event.event_name = 'visitor'");
    expect(normalized).toContain("event.event_name = 'patient_created'");
    expect(normalized).toContain("event.event_name = 'escalation_sent'");
  });
});

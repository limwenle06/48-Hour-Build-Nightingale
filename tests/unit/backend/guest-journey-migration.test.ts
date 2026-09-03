import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0003_guest_journey.sql", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("guest journey migration", () => {
  it("is atomic and contains no pasted Markdown", () => {
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("```");
    expect(migration).not.toMatch(/\[cite(?:ation)?:/i);
  });

  it("keeps all guest functions service-role only", () => {
    for (const signature of [
      "recover_lead_session(uuid, text)",
      "create_lead_session(uuid, text, text, text, text, text, text, text)",
      "append_guest_exchange(uuid, text, text, text, text)",
      "record_guest_funnel_event(uuid, text, text, jsonb)",
      "record_patient_consent_with_recovery(uuid, uuid, text, text, text, text)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(normalized).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }
    expect(migration.match(/security definer/gi)).toHaveLength(5);
    expect(migration.match(/set search_path = pg_catalog/gi)).toHaveLength(5);
  });

  it("creates attributed visitors and stores only token hashes", () => {
    expect(normalized).toContain("p_recovery_token_hash text");
    expect(normalized).toContain("p_referral_token_hash text");
    expect(normalized).not.toMatch(/\bp_(?:recovery|referral)_token\s+text\b/);
    expect(normalized).toContain("'visitor'");
    expect(normalized).toContain("lead_row.source_channel");
    expect(normalized).toContain("lead_row.campaign_id");
  });

  it("recovers messages and slides expiry by seven days", () => {
    expect(normalized).toContain("'recovered_messages', recovered_messages");
    expect(normalized).toContain("now() + interval '7 days'");
    expect(normalized).toContain("lead.recovery_token_hash = p_recovery_token_hash");
    expect(normalized).toContain("lead.recovery_expires_at > now()");
  });

  it("atomically stores both guest messages and authoritative funnel events", () => {
    expect(normalized).toContain("'guest', 'text', p_guest_content");
    expect(normalized).toContain("'ai', 'text', p_assistant_content");
    expect(normalized).toContain("'conversation_started'");
    expect(normalized).toContain("'value_event'");
    expect(normalized).toContain("p_event_name not in ('value_event', 'auth_started')");
  });

  it("records consented with recovered attribution before conversion", () => {
    expect(normalized).toContain("public.record_patient_consent(");
    expect(normalized).toContain("'consented'");
    expect(normalized).toContain("p_recovery_token_hash is not null");
    expect(normalized).toContain("'consent_type', 'health_data_sharing'");
  });
});

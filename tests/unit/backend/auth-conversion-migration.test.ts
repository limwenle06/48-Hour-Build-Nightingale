import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/0002_auth_and_conversion.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("authentication and conversion migration", () => {
  it("is atomic and contains no pasted Markdown", () => {
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("```");
    expect(migration).not.toMatch(/\[cite(?:ation)?:/i);
  });

  it("preserves original attribution identity separately", () => {
    expect(normalized).toContain("add column attribution_identity_level text");
    expect(normalized).toContain(
      "set attribution_identity_level = identity_level",
    );
    expect(normalized).toContain("lead_row.attribution_identity_level");
  });

  it("creates only service-role callable privileged functions", () => {
    for (const signature of [
      "ensure_patient_identity(uuid, text, text, uuid)",
      "record_patient_consent(uuid, uuid, text, text, text)",
      "convert_lead_session(uuid, uuid, uuid, text)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(normalized).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }

    expect(migration.match(/security definer/gi)).toHaveLength(3);
    expect(migration.match(/set search_path = pg_catalog/gi)).toHaveLength(3);
  });

  it("rechecks verified auth identity, clinic ownership, and current consent", () => {
    expect(normalized).toContain("from auth.users as auth_user");
    expect(normalized).toContain("auth_user.email_confirmed_at is not null");
    expect(normalized).toContain("patient.clinic_id = lead_row.clinic_id");
    expect(normalized).toContain(
      "order by consent.created_at desc, consent.consent_id desc limit 1",
    );
    expect(normalized).toContain("consent_row.status <> 'granted'");
  });

  it("locks and validates the hashed recovery session before conversion", () => {
    expect(normalized).toContain("lead.recovery_token_hash = p_recovery_token_hash");
    expect(normalized).toContain("for update;");
    expect(normalized).not.toMatch(/^\s*p_recovery_token\s+/im);
    expect(normalized).toContain("lead_row.recovery_expires_at <= now()");
  });

  it("is idempotent and preserves original guest message IDs", () => {
    expect(normalized).toContain("if lead_row.status = 'converted' then");
    expect(normalized).toContain("lead_row.converted_patient_session_id");
    expect(normalized).toContain(
      "array_agg(message.message_id order by message.created_at, message.message_id)",
    );
    expect(normalized).not.toContain("update public.messages");
  });

  it("records patient_created from stored attribution after consent was recorded", () => {
    const conversionFunction = normalized.slice(
      normalized.indexOf("create function public.convert_lead_session"),
    );
    expect(normalized).toContain("'patient_created'");
    expect(normalized).toContain("lead_row.source_channel");
    expect(normalized).toContain("lead_row.campaign_id");
    expect(conversionFunction).not.toContain("'consented'");
  });
});

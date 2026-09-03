import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0001_initial_schema.sql", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

const tableNames = [
  "clinics",
  "users",
  "patients",
  "staff_users",
  "staff_referrals",
  "lead_sessions",
  "patient_sessions",
  "messages",
  "consents",
  "risk_assessments",
  "memory_items",
  "citations",
  "escalations",
  "funnel_events",
  "audit_logs",
] as const;

describe("initial Supabase migration", () => {
  it("is one atomic SQL migration without pasted Markdown", () => {
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("```");
    expect(migration).not.toMatch(/\[cite(?:ation)?:/i);
  });

  it("creates every canonical table", () => {
    for (const tableName of tableNames) {
      expect(normalized).toContain(`create table public.${tableName} (`);
    }
  });

  it("uses server-generated UUIDs and a UUID Supabase auth reference", () => {
    expect(normalized).toContain(
      "auth_user_id uuid not null unique references auth.users(id)",
    );
    expect(normalized.match(/uuid primary key default gen_random_uuid\(\)/g)).toHaveLength(
      tableNames.length,
    );
  });

  it("stores only hashed recovery and referral tokens", () => {
    expect(normalized).toContain("recovery_token_hash text not null unique");
    expect(normalized).toContain("token_hash text not null unique");
    expect(migration).not.toMatch(/^\s*(?:recovery_token|referral_token)\s+/im);
    expect(normalized).toContain("token_hash ~ '^[0-9a-f]{64}$'");
  });

  it("enforces conversion, risk, memory, and escalation integrity", () => {
    expect(normalized).toContain("source_lead_session_id uuid unique");
    expect(normalized).toContain("message_id uuid not null unique references public.messages");
    expect(normalized).toContain("escalation_required = (");
    expect(normalized).toContain("supersedes_memory_item_id uuid unique");
    expect(normalized).toContain("create function private.validate_memory_provenance()");
    expect(normalized).toContain("create function private.validate_escalation_context()");
  });

  it("enables and forces RLS on every table", () => {
    for (const tableName of tableNames) {
      expect(normalized).toContain(
        `alter table public.${tableName} enable row level security;`,
      );
      expect(normalized).toContain(
        `alter table public.${tableName} force row level security;`,
      );
    }
  });

  it("keeps anonymous users out of direct database access", () => {
    expect(normalized).toContain("from anon, authenticated;");
    expect(normalized).not.toContain("to anon;");
    expect(normalized).toContain("to service_role;");
  });

  it("uses self, clinic-role, and current-consent authorization helpers", () => {
    expect(normalized).toContain("create function private.current_user_id()");
    expect(normalized).toContain("create function private.is_current_patient(");
    expect(normalized).toContain("create function private.has_staff_role(");
    expect(normalized).toContain("array['staff', 'nurse', 'clinician']");
    expect(normalized).toContain("array['nurse', 'clinician']");
    expect(normalized).toContain("create function private.has_current_health_consent(");
    expect(normalized).toContain("and consent.consent_type = 'health_data_sharing'");
  });

  it("fixes the search path on every privileged helper", () => {
    const privilegedHelpers = migration.match(/security definer/gi) ?? [];
    const fixedSearchPaths = migration.match(/set search_path = pg_catalog/gi) ?? [];

    expect(privilegedHelpers.length).toBeGreaterThan(0);
    expect(fixedSearchPaths.length).toBeGreaterThanOrEqual(privilegedHelpers.length);
    expect(normalized).toContain(
      "revoke all on all functions in schema private from public;",
    );
  });

  it("prevents updates to append-only healthcare and audit records", () => {
    for (const tableName of [
      "messages",
      "consents",
      "risk_assessments",
      "memory_items",
      "citations",
      "funnel_events",
      "audit_logs",
    ]) {
      expect(normalized).toContain(`before update on public.${tableName}`);
      expect(normalized).toContain("execute function private.reject_row_update()");
    }
  });
});

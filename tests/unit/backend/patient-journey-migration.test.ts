import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0004_patient_journey.sql", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("patient journey migration", () => {
  it("is atomic and contains no pasted Markdown", () => {
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("```");
    expect(migration).not.toMatch(/\[cite(?:ation)?:/i);
  });

  it("keeps every patient workflow function service-role only", () => {
    for (const signature of [
      "begin_patient_message(uuid, uuid, uuid, text, text)",
      "finalize_patient_message(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text)",
      "get_patient_profile(uuid, uuid)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(normalized).toContain(
        `grant execute on function public.${signature} to service_role;`,
      );
    }
  });

  it("checks identity, clinic, active session, and latest consent", () => {
    expect(normalized).toContain("app_user.auth_user_id = p_auth_user_id");
    expect(normalized).toContain("patient.clinic_id = p_clinic_id");
    expect(normalized).toContain("patient_session.ended_at is null");
    expect(normalized).toContain("current_consent_status is distinct from 'granted'");
    expect(normalized).toContain("using errcode = 'nhc01'");
  });

  it("persists the message before processing and rate limits bursts", () => {
    expect(normalized).toContain("recent_message_count >= 12");
    expect(normalized).toContain("using errcode = 'ngr01'");
    expect(normalized).toContain("'patient', 'text', btrim(p_content)");
    expect(normalized).toContain("'patient_message_saved'");
  });

  it("atomically persists the validated processing result", () => {
    expect(normalized).toContain("insert into public.risk_assessments");
    expect(normalized).toContain("insert into public.memory_items");
    expect(normalized).toContain("insert into public.citations");
    expect(normalized).toContain("'patient_message_processed'");
    expect(normalized).toContain("to_jsonb(risk_row) - 'processing_status'");
  });

  it("makes finalization idempotent by patient message", () => {
    expect(normalized).toContain("where risk.message_id = p_message_id");
    expect(normalized).toContain(
      "if risk_row.risk_assessment_id is not null then return private.patient_message_result(p_message_id);",
    );
    expect(normalized).toContain("messages_one_reply_per_patient_message_idx");
  });

  it("returns only non-superseded Living Profile items", () => {
    expect(normalized).toContain(
      "where later_item.supersedes_memory_item_id = item.memory_item_id",
    );
  });
});


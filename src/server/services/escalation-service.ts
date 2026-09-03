import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEscalation } from "@/server/escalation/generate-escalation";
import {
  loadEscalationContext,
  persistEscalation,
} from "@/server/data/staff-repository";
import { redactPhi } from "@/server/safety/redaction";

export async function createPatientEscalation(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    trigger_message_id: string;
    risk_assessment_id: string;
    request_id: string;
  },
) {
  const context = await loadEscalationContext(admin, input);
  const generated = generateEscalation({
    risk: context.risk,
    redaction: redactPhi(context.raw_content),
    profile_snapshot: context.current_profile,
  });

  const triageSummary = generated?.triage_summary ?? [
    "This message requires review by clinic staff.",
  ];
  const provenance = generated?.provenance ?? [input.trigger_message_id];

  return persistEscalation(admin, {
    ...input,
    triage_summary: triageSummary,
    provenance,
  });
}


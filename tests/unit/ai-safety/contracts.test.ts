import { describe, expect, it } from "vitest";

import {
  escalationGenerationSchema,
  patientMessageProcessingInputSchema,
  patientMessageProcessingOutputSchema,
  riskAssessmentSchema,
} from "../../../src/contracts";

const clinicId = "9f4b50df-b460-49f0-8c10-7f2c410f7f86";
const patientId = "eb5ab4f7-a92d-437f-9258-1057db2b04dc";
const patientSessionId = "13e31a72-5b23-457b-9824-17b9092e2555";
const messageId = "78b3b189-b95a-41ea-bda5-27857f675425";
const riskAssessmentId = "8bfba3eb-2675-4868-ae1b-f015106f3e52";

const validRiskDecision = {
  patient_id: patientId,
  patient_session_id: patientSessionId,
  message_id: messageId,
  risk_level: "low" as const,
  risk_reason: "No deterministic high-risk rule matched.",
  confidence: "high" as const,
  risk_provenance: "deterministic" as const,
  matched_rule_ids: [],
  escalation_required: false,
};

describe("Person 3 shared contracts", () => {
  it("accepts a valid patient-message processing input", () => {
    const result = patientMessageProcessingInputSchema.safeParse({
      clinic_id: clinicId,
      patient_id: patientId,
      patient_session_id: patientSessionId,
      message_id: messageId,
      raw_content: "I have had a mild headache since this morning.",
      current_profile: [],
      recent_messages: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a risk level outside the canonical enum", () => {
    const result = riskAssessmentSchema.safeParse({
      ...validRiskDecision,
      risk_assessment_id: riskAssessmentId,
      risk_level: "critical",
      created_at: "2026-09-01T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("rejects medium risk when escalation_required is false", () => {
    const result = riskAssessmentSchema.safeParse({
      ...validRiskDecision,
      risk_assessment_id: riskAssessmentId,
      risk_level: "medium",
      created_at: "2026-09-01T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid low-risk processing output", () => {
    const result = patientMessageProcessingOutputSchema.safeParse({
      processing_status: "success",
      risk: validRiskDecision,
      assistant_response: {
        content: "I can share general information, but I cannot diagnose the cause.",
        response_kind: "normal",
      },
      memory_mutations: [],
      escalation: null,
      citations: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects normal advice when escalation is required", () => {
    const result = patientMessageProcessingOutputSchema.safeParse({
      processing_status: "blocked",
      risk: {
        ...validRiskDecision,
        risk_level: "high",
        risk_reason: "Severe chest symptom rule matched.",
        matched_rule_ids: ["high_risk_chest_001"],
        escalation_required: true,
      },
      assistant_response: {
        content: "This is probably nothing serious.",
        response_kind: "normal",
      },
      memory_mutations: [],
      escalation: {
        required: true,
        triage_summary: ["Patient reported severe chest symptoms."],
        provenance: [messageId],
      },
      citations: [],
    });

    expect(result.success).toBe(false);
  });

  it("requires escalation details when the risk result requires escalation", () => {
    const result = patientMessageProcessingOutputSchema.safeParse({
      processing_status: "blocked",
      risk: {
        ...validRiskDecision,
        risk_level: "medium",
        confidence: "low",
        risk_reason: "The symptom description is ambiguous.",
        risk_provenance: "system_fallback",
        escalation_required: true,
      },
      assistant_response: {
        content: "I am unable to assess this safely. Please send it to the clinic.",
        response_kind: "fallback",
      },
      memory_mutations: [],
      escalation: null,
      citations: [],
    });

    expect(result.success).toBe(false);
  });

  it("limits a triage summary to five bullets", () => {
    const result = escalationGenerationSchema.safeParse({
      required: true,
      triage_summary: ["One", "Two", "Three", "Four", "Five", "Six"],
      provenance: [messageId],
    });

    expect(result.success).toBe(false);
  });
});

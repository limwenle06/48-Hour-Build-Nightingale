import { describe, expect, it } from "vitest";

import type {
  ProfileSnapshotItem,
  RiskDecision,
} from "../../../src/contracts";
import { generateEscalation } from "../../../src/server/escalation/generate-escalation";
import { redactPhi } from "../../../src/server/safety/redaction";

const patientId = "eb5ab4f7-a92d-437f-9258-1057db2b04dc";
const patientSessionId = "13e31a72-5b23-457b-9824-17b9092e2555";
const triggerMessageId = "78b3b189-b95a-41ea-bda5-27857f675425";
const medicationMessageId = "7599d7da-48b3-45c9-bde5-a9d73570dbd6";

const highRisk: RiskDecision = {
  patient_id: patientId,
  patient_session_id: patientSessionId,
  message_id: triggerMessageId,
  risk_level: "high",
  risk_reason: "Serious breathing difficulty was reported.",
  confidence: "high",
  risk_provenance: "deterministic",
  matched_rule_ids: ["high_risk_breathing_001"],
  escalation_required: true,
};

const profile: ProfileSnapshotItem[] = [
  {
    memory_item_id: "15ed6fc9-9ca9-409d-b00a-a1f72237bfb4",
    type: "symptom",
    value: "shortness of breath",
    status: "active",
    provenance_pointer: triggerMessageId,
  },
  {
    memory_item_id: "12def29a-6036-41e9-87a2-8262430f27dc",
    type: "medication",
    value: "Advil",
    status: "stopped",
    provenance_pointer: medicationMessageId,
  },
  {
    memory_item_id: "f6023b52-5886-4149-ac37-f8bb744b1c40",
    type: "allergy",
    value: "penicillin",
    status: "active",
    provenance_pointer: medicationMessageId,
  },
];

describe("generateEscalation", () => {
  it("builds a redacted 1-5 bullet summary with profile provenance", () => {
    const name = "Amelia Tan";
    const phone = "011-3343 4403";
    const result = generateEscalation({
      risk: highRisk,
      redaction: redactPhi(
        `My name is ${name}. I cannot breathe. Call ${phone}.`,
      ),
      profile_snapshot: profile,
    });

    expect(result).not.toBeNull();
    expect(result?.triage_summary.length).toBeGreaterThanOrEqual(1);
    expect(result?.triage_summary.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(result)).not.toContain(name);
    expect(JSON.stringify(result)).not.toContain(phone);
    expect(result?.triage_summary).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Risk: high"),
        expect.stringContaining("Triggering message"),
        expect.stringContaining("Medications: Advil (stopped)"),
        expect.stringContaining("Allergies: penicillin (active)"),
      ]),
    );
    expect(result?.provenance).toEqual([
      triggerMessageId,
      medicationMessageId,
    ]);
  });

  it("does not generate escalation when risk is low", () => {
    const result = generateEscalation({
      risk: {
        ...highRisk,
        risk_level: "low",
        confidence: "med",
        risk_reason: "No deterministic rule matched.",
        matched_rule_ids: [],
        escalation_required: false,
      },
      redaction: redactPhi("I want general clinic information."),
      profile_snapshot: [],
    });

    expect(result).toBeNull();
  });

  it("generates a safe summary even when redaction failed", () => {
    const result = generateEscalation({
      risk: highRisk,
      redaction: redactPhi(null),
      profile_snapshot: [],
    });

    expect(result?.triage_summary).toContain(
      "Triggering message content unavailable because redaction failed.",
    );
    expect(result?.provenance).toEqual([triggerMessageId]);
  });

  it("returns null for invalid input instead of inventing an escalation", () => {
    expect(generateEscalation({ risk: "invalid" })).toBeNull();
  });

  it("keeps every summary bullet within the contract limit", () => {
    const result = generateEscalation({
      risk: highRisk,
      redaction: redactPhi("I cannot breathe."),
      profile_snapshot: [
        {
          ...profile[0],
          value: "symptom ".repeat(100),
        },
      ],
    });

    expect(result?.triage_summary.every((bullet) => bullet.length <= 500)).toBe(
      true,
    );
  });
});

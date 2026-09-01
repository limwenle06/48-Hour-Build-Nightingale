import { z } from "zod";

import { confidenceSchema, isoDateTimeSchema, uuidSchema } from "./common";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskProvenanceSchema = z.enum([
  "deterministic",
  "model",
  "combined",
  "system_fallback",
]);
export type RiskProvenance = z.infer<typeof riskProvenanceSchema>;

const riskDecisionObjectSchema = z.object({
  patient_id: uuidSchema,
  patient_session_id: uuidSchema,
  message_id: uuidSchema,
  risk_level: riskLevelSchema,
  risk_reason: z.string().trim().min(1).max(500),
  confidence: confidenceSchema,
  risk_provenance: riskProvenanceSchema,
  matched_rule_ids: z.array(z.string().trim().min(1)).max(50),
  escalation_required: z.boolean(),
});

const enforceEscalationRelationship = (
  risk: z.infer<typeof riskDecisionObjectSchema>,
  context: z.RefinementCtx,
) => {
  const escalationRequired =
    risk.risk_level !== "low" || risk.confidence === "low";

  if (risk.escalation_required !== escalationRequired) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["escalation_required"],
      message:
        "Escalation is required for medium/high risk or low-confidence processing.",
    });
  }
};

export const riskDecisionSchema = riskDecisionObjectSchema.superRefine(
  enforceEscalationRelationship,
);
export type RiskDecision = z.infer<typeof riskDecisionSchema>;

export const riskAssessmentSchema = riskDecisionObjectSchema
  .extend({
    risk_assessment_id: uuidSchema,
    created_at: isoDateTimeSchema,
  })
  .superRefine(enforceEscalationRelationship);
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

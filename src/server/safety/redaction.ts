import {
  redactionResultSchema,
  type RedactionDetectedType,
  type RedactionResult,
} from "../../contracts";

export const REDACTION_PLACEHOLDER = "[REDACTED]";

export interface RedactionAuditEvent {
  event_type: "phi_redaction";
  status: RedactionResult["status"];
  detected_types: RedactionDetectedType[];
  replacement_count: number;
  failure_reason: string | null;
}

export interface RedactionOptions {
  audit?: (event: RedactionAuditEvent) => void;
}

interface ReplacementState {
  text: string;
  detectedTypes: Set<RedactionDetectedType>;
  replacementCount: number;
}

const NATIONAL_ID_PATTERN = /\b\d{6}-?\d{2}-?\d{4}\b/g;
const PHONE_PATTERN = /(?<!\d)(?:\+?60|0)(?:[\s-]?\d){8,10}(?!\d)/g;

const EXPLICIT_NAME_PATTERN =
  /\b(my\s+name\s+is|patient(?:'s)?\s+name\s+(?:is|:)|name\s*(?:is|:))\s+([\p{L}'’\-]+(?:\s+[\p{L}'’\-]+){0,3}?)(?=\s+(?:and|i|my|please|because|from|with|have|am)\b|[,.;!\n]|$)/giu;

const HONORIFIC_NAME_PATTERN =
  /\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[\p{Lu}][\p{L}'’\-]*(?:\s+[\p{Lu}][\p{L}'’\-]*){0,3}/gu;

function replaceMatches(
  state: ReplacementState,
  pattern: RegExp,
  detectedType: RedactionDetectedType,
  replacement: string | ((...matches: string[]) => string) = REDACTION_PLACEHOLDER,
): void {
  state.text = state.text.replace(pattern, (...args: unknown[]) => {
    state.detectedTypes.add(detectedType);
    state.replacementCount += 1;

    if (typeof replacement === "string") {
      return replacement;
    }

    const matchedGroups = args.slice(0, -2).map(String);
    return replacement(...matchedGroups);
  });
}

function failureResult(failureReason: string): RedactionResult {
  return redactionResultSchema.parse({
    status: "failed",
    redacted_text: null,
    detected_types: [],
    replacement_count: 0,
    failure_reason: failureReason,
  });
}

function emitAudit(
  result: RedactionResult,
  audit: RedactionOptions["audit"],
): RedactionResult {
  if (!audit) {
    return result;
  }

  try {
    audit({
      event_type: "phi_redaction",
      status: result.status,
      detected_types: [...result.detected_types],
      replacement_count: result.replacement_count,
      failure_reason: result.failure_reason,
    });
    return result;
  } catch {
    return failureResult("redaction_audit_failed");
  }
}

/**
 * Redacts the minimum PHI categories required by the Nightingale contract.
 * Raw input is used only in memory and is never included in the audit event.
 */
export function redactPhi(
  rawText: unknown,
  options: RedactionOptions = {},
): RedactionResult {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    return emitAudit(failureResult("invalid_redaction_input"), options.audit);
  }

  try {
    const state: ReplacementState = {
      text: rawText,
      detectedTypes: new Set<RedactionDetectedType>(),
      replacementCount: 0,
    };

    replaceMatches(state, NATIONAL_ID_PATTERN, "national_id");
    replaceMatches(state, PHONE_PATTERN, "phone");
    replaceMatches(
      state,
      EXPLICIT_NAME_PATTERN,
      "name",
      (_fullMatch, label) => `${label} ${REDACTION_PLACEHOLDER}`,
    );
    replaceMatches(state, HONORIFIC_NAME_PATTERN, "name");

    const result = redactionResultSchema.parse({
      status: "success",
      redacted_text: state.text,
      detected_types: [...state.detectedTypes],
      replacement_count: state.replacementCount,
      failure_reason: null,
    });

    return emitAudit(result, options.audit);
  } catch {
    return emitAudit(failureResult("redaction_processing_failed"), options.audit);
  }
}

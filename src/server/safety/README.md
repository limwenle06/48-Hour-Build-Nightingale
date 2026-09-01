# PHI redaction and risk gating

**Owner:** Person 3

This module contains safety checks that run before normal AI processing.

`redaction.ts` currently removes the minimum contract categories:

- explicitly introduced names and honorific names;
- Malaysian IC/ID-like values;
- Malaysian phone-number-like values.

Person 2 must call `redactPhi` before sending any message or context to an LLM. Only `redacted_text` from a successful result may cross the LLM boundary. A failed result has `redacted_text = null` and must block the provider request.

The optional audit callback receives counts and categories only. It never receives raw or redacted message content.

`risk-assessment.ts` runs after successful redaction. It checks stable rules from `risk-rules.ts` in this order:

1. High-risk emergency signs, including chest symptoms, breathing difficulty, uncontrolled bleeding, self-harm intent, stroke signs, loss of consciousness/seizure, severe allergic reaction, overdose/poisoning, and choking.
2. Medium-risk requests that need real clinical judgement, including diagnosis, medication changes, test interpretation, urgency decisions, worsening symptoms, explicit human review, and concerning ambiguity.
3. Low risk when no deterministic rule matches.

Invalid or failed risk processing returns a medium-risk, low-confidence `system_fallback` result that requires escalation. Invalid patient/session/message IDs are rejected because the system must not fabricate record identity.

These rules are a conservative prototype safety gate, not a complete clinical protocol. A high or medium result blocks normal AI advice and must lead to the human escalation path.

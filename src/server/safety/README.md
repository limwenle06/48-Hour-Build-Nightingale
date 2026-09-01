# PHI redaction and risk gating

**Owner:** Person 3

This module contains safety checks that run before normal AI processing.

`redaction.ts` currently removes the minimum contract categories:

- explicitly introduced names and honorific names;
- Malaysian IC/ID-like values;
- Malaysian phone-number-like values.

Person 2 must call `redactPhi` before sending any message or context to an LLM. Only `redacted_text` from a successful result may cross the LLM boundary. A failed result has `redacted_text = null` and must block the provider request.

The optional audit callback receives counts and categories only. It never receives raw or redacted message content.

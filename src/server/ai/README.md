# AI provider and policy

**Owner:** Person 3

This module contains the provider-neutral LLM boundary and Nightingale response policy.

- `provider.ts` defines the small interface used by the application.
- `fake-provider.ts` provides deterministic tests without network calls.
- `openai-provider.ts` uses the server-side OpenAI Responses API with `store: false`.
- `provider-factory.ts` reads `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY` from server environment configuration.
- `nightingale-policy.ts` contains non-diagnostic instructions, the trust response, and output guard rules.
- `fallback-response.ts` contains deterministic safety/failure messages.
- `generate-safe-response.ts` allows provider use only for successfully redacted, low-risk text.
- `process-patient-message.ts` is the single Person 3 facade called by Person 2 after access and consent checks. It returns validated risk, response, Memory proposals, escalation generation, and processing status without writing to the database.

Never instantiate a provider in browser code. Never pass raw message content to a provider. Medium/high risk, redaction failure, provider timeout, provider error, empty output, or unsafe output returns deterministic safe text instead.

Recent messages are validated at the boundary but are not sent to the provider in the core prototype. Any future use must redact every included message first.

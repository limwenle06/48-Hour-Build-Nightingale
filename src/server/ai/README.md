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

Never instantiate a provider in browser code. Never pass raw message content to a provider. Medium/high risk, redaction failure, provider timeout, provider error, empty output, or unsafe output returns deterministic safe text instead.

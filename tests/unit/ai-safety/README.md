# AI and safety unit tests

**Owner:** Person 3

Implemented coverage:

- `contracts.test.ts`: shared runtime contract validation
- `redaction.test.ts`: names, Malaysian IDs, phone numbers, and PHI-free audit events
- `risk-assessment.test.ts`: deterministic emergency and human-review rules
- `ai-response.test.ts`: safe responses, trust disclosure, output guards, failures, and timeouts
- `openai-provider.test.ts`: server-side OpenAI request shape and configuration
- `memory-extraction.test.ts`: deterministic/model extraction, redaction, invalid output, and timeout fallback
- `memory-mutation.test.ts`: duplicate, correction, uncertainty, and provenance behaviour
- `escalation.test.ts`: escalation summaries, limits, and provenance

Run all tests from the repository root with `npm test` or `npm.cmd test` in PowerShell.

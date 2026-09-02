# Escalation generation and persistence boundary

**Generation owner:** Person 3  
**Persistence/API owner:** Person 2

`generate-escalation.ts` builds a deterministic, validated triage summary when `escalation_required` is true. It uses the safe risk reason, successfully redacted triggering message, and current profile to produce one to five concise bullets plus unique message provenance.

It does not diagnose, call an LLM, write to the database, attach acquisition data, or claim the escalation was sent. Person 2 must add the immutable profile/risk/attribution snapshots and persist the full Escalation through an authorized backend workflow before Person 1 shows a success confirmation.

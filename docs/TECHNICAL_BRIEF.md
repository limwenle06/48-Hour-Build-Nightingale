# Nightingale Technical Brief

## Product goal

Nightingale is a mobile-first healthcare prototype that carries a person from an acquisition link to a secure, consented patient conversation without losing their original context. It provides non-diagnostic guest value, creates a Living Profile with source provenance, screens every patient message for safety, and lets the patient send appropriate concerns to clinic staff.

It is an AI assistant, not a doctor. It does not diagnose, prescribe, promise a clinical response time, or replace emergency services. Development and demonstration use synthetic information only.

## Architecture

The prototype is a modular monolith: one Next.js application, one server API, one Supabase PostgreSQL database, and an optional server-side LLM provider. This is the smallest architecture that preserves clear security boundaries while remaining achievable in 48 hours.

```text
Browser/PWA
  -> Next.js API routes
     -> Supabase Auth session checks
     -> service-only PostgreSQL transaction functions
     -> PHI redaction and deterministic risk gate
     -> optional external LLM for allowed low-risk text
     -> validated persistence result
```

The browser receives only the public Supabase key. The service-role key and optional LLM key remain server-side. API routes verify the authenticated identity; database functions independently enforce the expected clinic, role, ownership, and current healthcare consent.

## Core data relationships

- `LeadSession` stores acquisition attribution and only a hash of its recovery token.
- `Message` is append-only and represents both guest and patient conversation history.
- `PatientSession` links the converted patient to the original LeadSession and attribution.
- `RiskAssessment` has a one-to-one relationship with each patient-authored Message.
- `MemoryItem` is an append-only Living Profile revision. Its `provenance_pointer` identifies the Message that supports the fact. A correction creates a new row that supersedes, rather than overwrites, an earlier row.
- `Citation` belongs to an AI Message. Citations are omitted unless a real source was retrieved and validated.
- `Escalation` snapshots the risk, profile, attribution, and message provenance at the moment the patient sends the concern to the clinic.
- `FunnelEvent` records PHI-free acquisition stages and supplies query-backed staff metrics.
- `AuditLog` records IDs and safe operation metadata, never raw message text, credentials, prompts, names, contact information, or tokens.

Database mutations that must succeed together are implemented as service-role-only PostgreSQL functions. Guest conversion and escalation creation are idempotent. Patient-message processing first preserves the patient Message, then atomically persists the validated risk, reply, memory, citations, and safe audit metadata.

## Safety pipeline

Every authenticated patient message follows this order:

1. Verify login, patient ownership, clinic, active session, and current healthcare consent.
2. Validate input and enforce a small burst rate limit.
3. Save the patient Message and assign its stable ID.
4. Redact names, Malaysian ID-like numbers, and phone numbers before any provider call.
5. Run deterministic high- and medium-risk rules before normal response generation.
6. Block ordinary advice for medium/high risk, ambiguity, redaction failure, or low-confidence failure.
7. Generate a safe reply, memory proposals, and an escalation summary where allowed.
8. Runtime-validate and persist the result, retaining Message provenance.

High-risk content receives emergency guidance. Medium-risk content is directed to a nurse or clinician. Provider errors and timeouts produce deterministic fallback text rather than an invented answer. The optional OpenAI adapter uses the Responses API server-side with storage disabled.

## Authentication, consent, and staff access

Patients use verified Supabase email authentication. An identity shell may exist before consent, but patient processing and protected profile access require the latest clinic-specific `health_data_sharing` decision to be granted. Guest-to-patient conversion preserves attribution and original guest Message IDs.

Staff accounts are clinic-provisioned; public staff registration and self-assigned roles are not allowed. `staff`, `nurse`, and `clinician` may create referrals and view non-clinical warm leads. Only `nurse` and `clinician` may read the consent-filtered escalation queue. Warm-lead scoring uses only channel, identity level, funnel stage, and recency—clinical risk never increases a sales score.

## Acquisition channels

| Channel | Prototype method | Technical feasibility | Privacy, policy, and trust treatment |
|---|---|---|---|
| Staff referral | Opaque, expiring link | Fully simulated and connected | URL contains no topic or patient identity; only the token hash is stored. |
| Website widget | Direct start parameters | Straightforward | Neutral opening; no health assumptions before the user shares context. |
| Instagram ad click | Campaign parameters | Straightforward landing-link flow | Campaign context is attribution, not a medical fact. Live advertising claims require clinic, platform-policy, and Malaysian legal review. |
| Social comment | Simulated private continuation | Platform integration deferred | A social handle is not verified identity. Public comments must never be treated as consent to process health information. |

This prototype makes no claim of Malaysian regulatory compliance. Production use requires qualified review of applicable privacy, healthcare, advertising, consent, retention, breach-response, and cross-border processing obligations, plus the current policies of each acquisition platform.

## Failure behaviour

- Authentication or database outage keeps protected endpoints unavailable; authorization is never bypassed.
- A saved patient Message remains preserved if later AI processing fails.
- Invalid AI output is rejected at a Zod boundary.
- A missing provider produces a visible safe fallback.
- Escalation success is returned only after both the escalation and `escalation_sent` event commit.
- Raw recovery/referral tokens, passwords, PHI, prompts, and provider responses are excluded from audit metadata and application logs.

## Deliberate 48-hour trade-offs

The synchronous modular monolith avoids microservices, queues, a vector database, and complex infrastructure. Deterministic rules cover the safety-critical path. Social-platform integrations, audio, clinician replies, advanced analytics, automated retention jobs, and production compliance certification are deferred.

Future clinician communication should add append-only records linked by `escalation_id`; it must not rewrite the escalation snapshot. Future VoiceAI should attach audio/transcript records to the existing nullable Message fields, run transcription through the same protected server boundary, and feed transcript text through the identical redaction/risk pipeline.

## Verification status

The repository has automated unit, integration, frontend, migration-structure, safety, privacy, and Playwright browser tests, plus TypeScript and production-build checks. SQL migrations are versioned and statically tested. They must still be executed against the target Supabase PostgreSQL project and the connected journey must be manually exercised before claiming a live deployment.

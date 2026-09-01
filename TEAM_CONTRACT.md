# Nightingale Team Contract

**Contract version:** 0.1.0  
**Status:** Active prototype contract  
**Last updated:** 2026-09-01  
**Applies to:** Frontend, backend, database, AI/safety, analytics, and tests

This document is the single source of truth for shared Nightingale names, schemas, enums, API boundaries, safety order, and ownership. It is intentionally small enough for a 48-hour prototype. Internal implementation may vary, but code crossing a team boundary MUST follow this contract.

Normative words `MUST`, `MUST NOT`, `SHOULD`, and `MAY` have their ordinary requirements meaning.

## 1. Scope and product invariant

Nightingale is a mobile-friendly healthcare PWA that converts an acquisition lead into a consented patient relationship without losing context, attribution, or provenance. It is an AI-assisted intake and continuity system, not a doctor and not a diagnostic chatbot.

Canonical journey:

```text
Acquisition source
  -> LeadSession
  -> guest value
  -> authentication
  -> explicit healthcare consent
  -> Patient + PatientSession
  -> patient message safety pipeline
  -> Living Profile
  -> human escalation when required
```

The following are non-negotiable:

- Guests receive useful, non-diagnostic value before signup is required.
- Attribution and permitted guest context survive conversion.
- Every derived clinical fact has message provenance.
- Every patient message is risk-assessed before a normal AI response.
- Raw PHI MUST NOT be sent to an LLM.
- Medium, high, ambiguous, or failed risk processing MUST NOT produce ordinary clinical advice.
- Clinical risk is never used as a sales score.
- Server-side authentication, consent checks, RBAC, and patient isolation are mandatory.
- Synthetic patient data only is used for development, testing, and demonstration.

## 2. Architecture and technology stack

### 2.1 Deployment shape

Use a single modular monolith with one repository and one relational database.

```text
Next.js PWA
  -> Next.js server API
     -> auth / consent / RBAC / workflow orchestration
     -> AI and Safety module
     -> Supabase PostgreSQL
     -> external LLM provider, only after redaction and risk policy allow it
```

- The browser MUST call only Nightingale backend APIs. It MUST NOT call an LLM provider or use privileged database credentials.
- The backend owns orchestration, authorization, consent validation, transactions, and persistence.
- The AI/Safety module owns redaction, risk semantics, AI policy, memory proposals, and escalation-summary generation. It returns structured results and MUST NOT bypass backend authorization or persistence.
- Use one database for application records, funnel events, and audit records.
- Do not add microservices, queues, an event bus, or a vector database during the core build.
- Patient-message processing is synchronous for the prototype and returns explicit safe failure results.

### 2.2 Selected prototype stack

| Concern | Selection |
|---|---|
| Language | TypeScript with strict mode |
| Web/PWA and server API | Next.js App Router |
| Database | Supabase-hosted PostgreSQL |
| Authentication | Supabase Auth with verified email |
| Shared runtime validation | Zod |
| Styling | Tailwind CSS |
| Unit/integration tests | Vitest |
| Browser tests | Playwright |
| LLM | Provider-neutral adapter; provider selected through server environment configuration |

Exact package versions belong in the lockfile, not this contract. Adding a major framework or replacing a selected technology requires a contract change.

## 3. Planned repository boundaries

```text
src/
  app/                    # Person 1 pages and server API route entry points
  components/             # Person 1 reusable UI
  config/                 # declarative channel configuration
  contracts/              # shared enums, Zod schemas, and DTO types
  server/
    auth/                  # Person 2
    data/                  # Person 2 database access
    services/              # Person 2 workflow orchestration
    ai/                    # Person 3 AI provider and policy
    safety/                # Person 3 redaction and risk gating
    memory/                # Person 3 extraction/mutation proposals
    escalation/            # shared boundary; Person 3 generation, Person 2 persistence
    audit/                 # Person 2 structured audit events
supabase/
  migrations/             # Person 2 schema and RLS migrations
tests/
  unit/
  integration/
  e2e/
```

Directories are planned boundaries and MAY be introduced only when their stage begins. Do not create placeholder code solely to reproduce this tree.

## 4. Ownership and integration boundaries

### Person 1 — Frontend and product journey

Owns acquisition entry UI, guest experience, trust transition, authentication/consent screens, patient messenger, Living Profile UI, citations UI, Send to Clinic UI, staff referral UI, staff views, funnel display, and PWA responsiveness.

Person 1 consumes API contracts and MUST NOT implement database authorization, call the LLM directly, or redefine AI safety semantics.

### Person 2 — Backend, data, auth, and security

Owns database schema/migrations, authentication, consent persistence, conversion, APIs, server-side RBAC, isolation, persistence, funnel queries, audit logging, rate limits, recovery/retention, and database failure handling.

Person 2 orchestrates the patient-message pipeline but MUST NOT silently redefine AI, risk, redaction, memory, or escalation semantics.

### Person 3 — AI, safety, memory, and escalation generation

Owns the LLM adapter, AI policy, PHI redaction, deterministic risk rules, ambiguity/failure behavior, structured memory proposals, mutation semantics, provenance-aware outputs, citation validation where implemented, and escalation/triage generation.

Person 3 returns contract-shaped data. Person 2 remains responsible for authorization and durable persistence.

### Shared changes

Any change to names, enums, schemas, endpoint DTOs, event names, or processing order follows Section 22 before implementation diverges.

## 5. Naming, identifiers, and serialization

- JSON, database columns, and event fields use `snake_case`.
- TypeScript variables MAY use `camelCase` internally, but API and persisted shapes use `snake_case`.
- Entity/type names use singular `PascalCase`.
- Database tables use plural `snake_case`.
- Stable identifiers are UUIDs generated server-side. They are immutable and opaque.
- Canonical IDs include `clinic_id`, `user_id`, `patient_id`, `staff_user_id`, `lead_session_id`, `patient_session_id`, `message_id`, `consent_id`, `risk_assessment_id`, `memory_item_id`, `citation_id`, `escalation_id`, `funnel_event_id`, `staff_referral_id`, and `audit_log_id`.
- Email, phone number, and social handle MUST NOT be a primary identity key.
- All timestamps are UTC ISO-8601 strings with a `Z` suffix in APIs, for example `2026-09-01T09:30:00.000Z`.
- Database timestamps use `timestamptz`.
- Enum values are lowercase `snake_case` strings.
- Optional absent fields are omitted. Explicitly nullable fields are documented with `| null`.
- Unknown client-supplied fields SHOULD be rejected by runtime validation on mutation endpoints.

## 6. Canonical enums

```ts
type Role = "guest" | "patient" | "staff" | "nurse" | "clinician";

type SourceChannel =
  | "staff_referral"
  | "social_comment"
  | "instagram_ad_click"
  | "website_widget";

type SourcePlatform =
  | "clinic"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "website"
  | "other";

type IdentityLevel =
  | "anonymous"
  | "social_handle"
  | "contact_provided"
  | "verified";

type FunnelEventName =
  | "visitor"
  | "conversation_started"
  | "value_event"
  | "auth_started"
  | "consented"
  | "patient_created"
  | "escalation_sent";

type SenderType = "guest" | "patient" | "ai" | "staff" | "nurse" | "clinician";
type SessionType = "lead" | "patient";
type MessageKind = "text" | "system";

type ConsentType = "health_data_sharing" | "marketing";
type ConsentStatus = "granted" | "revoked";

type RiskLevel = "low" | "medium" | "high";
type Confidence = "low" | "med" | "high";
type RiskProvenance = "deterministic" | "model" | "combined" | "system_fallback";

type MemoryType =
  | "chief_complaint"
  | "symptom"
  | "symptom_timeline"
  | "medication"
  | "allergy";

type MemoryStatus = "active" | "stopped" | "resolved" | "historical" | "unknown";
type MemorySourceSessionType = "lead" | "patient";

type EscalationStatus = "pending" | "in_review" | "responded" | "closed";
type ReferralStatus = "active" | "converted" | "expired" | "revoked";
type TranscriptionStatus = "not_applicable" | "pending" | "completed" | "failed";
type ProcessingStatus = "success" | "blocked" | "failed";
```

`social_comment` is the channel contract; `source_platform` records whether it originated on Instagram, TikTok, or Facebook. Do not create channel-specific replacements such as `instagram_comment` without a contract update.

## 7. Canonical entities

The shapes below define shared semantics. Database-only columns such as foreign-key indexes MAY be added without changing API DTOs, provided they do not change behavior.

### 7.1 Clinic

```ts
interface Clinic {
  clinic_id: string;
  name: string;
  timezone: string; // IANA name, e.g. "Asia/Kuala_Lumpur"
  created_at: string;
}
```

### 7.2 User, Patient, and StaffUser

```ts
interface User {
  user_id: string;
  auth_user_id: string;
  role: Exclude<Role, "guest">;
  verified_email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface Patient {
  patient_id: string;
  user_id: string;
  clinic_id: string;
  created_at: string;
  updated_at: string;
}

interface StaffUser {
  staff_user_id: string;
  user_id: string;
  clinic_id: string;
  role: "staff" | "nurse" | "clinician";
  created_at: string;
}
```

`Patient` is the permanent patient identity. Updating email or phone on `User` MUST NOT change `patient_id` or historical relationships.

After verified authentication, the backend creates or reuses the clinic-scoped `User` and `Patient` identity records before the consent screen. This identity shell grants no access to protected patient workflows until healthcare consent is granted. The `patient_created` funnel event means successful LeadSession conversion, not merely insertion of the identity shell.

### 7.3 Attribution

```ts
interface Attribution {
  clinic_id: string;
  source_channel: SourceChannel;
  source_platform: SourcePlatform;
  campaign_id: string | null;
  creative: string | null;
  identity_level: IdentityLevel;
  landing_timestamp: string;
}
```

Attribution is captured on LeadSession creation, copied to PatientSession on conversion, and snapshotted into Escalation. Existing attribution MUST NOT be rewritten when later identity information becomes available; `LeadSession.identity_level` may advance separately.

### 7.4 LeadSession

```ts
type LeadSessionStatus = "active" | "auth_started" | "converted" | "expired";

interface LeadSession {
  lead_session_id: string;
  clinic_id: string;
  attribution: Attribution;
  identity_level: IdentityLevel;
  social_handle: string | null;
  staff_referral_id: string | null;
  status: LeadSessionStatus;
  recovery_expires_at: string;
  converted_patient_id: string | null;
  converted_patient_session_id: string | null;
  created_at: string;
  updated_at: string;
}
```

A LeadSession is accessed through an opaque, high-entropy recovery token stored in a secure, HTTP-only cookie. Raw recovery tokens MUST NOT be stored; store only a one-way hash.

### 7.5 Message

Use one canonical `Message` entity. `GuestMessage` and `PatientMessage` mean a `Message` whose `session_type` and `sender_type` identify its context.

```ts
interface Message {
  message_id: string;
  clinic_id: string;
  session_type: SessionType;
  session_id: string; // LeadSession or PatientSession ID according to session_type
  sender_type: SenderType;
  message_kind: MessageKind;
  content: string;
  migrated_from_message_id: string | null;
  audio_asset_id: string | null;
  transcript_id: string | null;
  transcription_status: TranscriptionStatus;
  created_at: string;
}
```

Rules:

- `message_id` is stable and messages are append-only.
- Conversion MUST NOT replace or rewrite a guest message.
- If a patient-context copy is required for querying, it sets `migrated_from_message_id` to the original guest `message_id`. Derived facts MUST still point to the original guest message.
- Raw message content may be stored only in the protected database. It MUST NOT appear in application logs or LLM requests.
- Audio fields exist for future readiness only; audio recording is out of scope.

### 7.6 PatientSession

```ts
interface PatientSession {
  patient_session_id: string;
  patient_id: string;
  clinic_id: string;
  source_lead_session_id: string | null;
  attribution: Attribution;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### 7.7 Consent

```ts
interface Consent {
  consent_id: string;
  patient_id: string;
  clinic_id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  policy_version: string;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
```

- Healthcare and marketing consent are separate records.
- Lead-to-patient conversion requires current `health_data_sharing = granted` consent for the named clinic.
- Marketing consent is never inferred from healthcare consent.
- Revocation is recorded; previous consent history is not deleted.

### 7.8 RiskAssessment

```ts
interface RiskAssessment {
  risk_assessment_id: string;
  patient_id: string;
  patient_session_id: string;
  message_id: string;
  risk_level: RiskLevel;
  risk_reason: string;
  confidence: Confidence;
  risk_provenance: RiskProvenance;
  matched_rule_ids: string[];
  escalation_required: boolean;
  created_at: string;
}
```

Every patient-authored message has exactly one persisted final RiskAssessment. Failed or uncertain processing produces a conservative assessment using `risk_provenance = "system_fallback"`, `confidence = "low"`, and `escalation_required = true`.

### 7.9 MemoryItem

Memory is append-only by revision. A correction creates a new MemoryItem that supersedes an earlier one; evidence is never overwritten.

```ts
interface MemoryItem {
  memory_item_id: string;
  patient_id: string;
  type: MemoryType;
  value: string;
  normalized_value: string;
  status: MemoryStatus;
  provenance_pointer: string; // originating Message.message_id
  source_session_type: MemorySourceSessionType;
  supersedes_memory_item_id: string | null;
  confidence: Confidence;
  created_at: string;
  updated_at: string;
}
```

Mutation rules:

- `provenance_pointer` MUST resolve to an existing patient- or guest-authored Message.
- A guest-derived fact keeps the original guest `message_id` and `source_session_type = "lead"` after conversion.
- `normalized_value` is used for conservative matching, for example `advil`; the displayed `value` preserves a patient-friendly form.
- A new item MAY supersede only an item belonging to the same patient and compatible `type`/`normalized_value`.
- Superseded rows remain immutable and queryable.
- The current profile selects items not superseded by a later item.
- If confidence is insufficient to safely match a correction, create a separate item with `status = "unknown"`; do not silently overwrite or supersede.
- Example: `Advil/active` from Message A remains stored; Message B creates `Advil/stopped`, points to Message B, and supersedes the first item.

### 7.10 Citation

```ts
interface Citation {
  citation_id: string;
  message_id: string; // AI message displaying the citation
  title: string;
  source_url: string;
  publisher: string;
  retrieved_at: string;
}
```

Citations are optional for the core build. If shown, they MUST reference a real retrieved source and MUST NOT be fabricated by the model.

### 7.11 Escalation

```ts
interface ProfileSnapshotItem {
  memory_item_id: string;
  type: MemoryType;
  value: string;
  status: MemoryStatus;
  provenance_pointer: string;
}

interface Escalation {
  escalation_id: string;
  clinic_id: string;
  patient_id: string;
  patient_session_id: string;
  trigger_message_id: string;
  risk_assessment_id: string;
  triage_summary: string[]; // 1-5 concise bullets
  profile_snapshot: ProfileSnapshotItem[];
  provenance: string[]; // unique Message.message_id values
  attribution: Attribution;
  risk_context: Pick<
    RiskAssessment,
    "risk_level" | "risk_reason" | "confidence" | "risk_provenance" | "escalation_required"
  >;
  status: EscalationStatus;
  created_at: string;
  updated_at: string;
  clinician_response: {
    responder_staff_user_id: string;
    message: string;
    responded_at: string;
  } | null;
}
```

- `trigger_message_id` and `risk_assessment_id` MUST belong to the same patient/session.
- Profile, attribution, and risk data are immutable snapshots at escalation creation.
- The patient-facing confirmation promises an approximate response window of 12–18 hours, not an exact clinical SLA.
- An escalation is considered sent only after a `pending` record is durably persisted and `escalation_sent` is recorded.
- The patient MAY continue chatting after escalation.

### 7.12 FunnelEvent

```ts
interface FunnelEvent {
  funnel_event_id: string;
  clinic_id: string;
  event_name: FunnelEventName;
  lead_session_id: string | null;
  patient_id: string | null;
  patient_session_id: string | null;
  source_channel: SourceChannel;
  campaign_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
  occurred_at: string;
}
```

- Funnel events are append-only.
- `metadata` MUST NOT contain raw message content or PHI.
- Statistics shown in the UI MUST be calculated from stored FunnelEvent/application records, never hard-coded or model-generated.

### 7.13 StaffReferral

```ts
interface StaffReferral {
  staff_referral_id: string;
  clinic_id: string;
  created_by_staff_user_id: string;
  topic: string;
  token_hash: string;
  status: ReferralStatus;
  expires_at: string;
  created_at: string;
}
```

Referral links contain an opaque token, not clinical text or a patient identifier. Opening a valid link creates a LeadSession with `source_channel = "staff_referral"` and attaches the referral topic as protected context.

### 7.14 AuditLog

```ts
interface AuditLog {
  audit_log_id: string;
  clinic_id: string | null;
  actor_user_id: string | null;
  actor_role: Role;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  outcome: "success" | "denied" | "failed";
  request_id: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
}
```

Audit logs are structured and append-only. `metadata` MUST NOT contain raw message content, names, IC/ID values, phone numbers, emails, access tokens, recovery tokens, or other raw PHI/secrets.

## 8. Channel behavior and acquisition contracts

The initial build supports all four `SourceChannel` values. Real social-platform integrations are out of scope; `social_comment` MAY be simulated.

Opening behavior is declarative, not distributed across UI conditions. The future `src/config/channel-openings.ts` configuration is keyed by:

```ts
interface ChannelOpeningRule {
  source_channel: SourceChannel;
  identity_level: IdentityLevel;
  time_of_day: "business_hours" | "after_hours";
  opening_strategy: string;
}
```

Required strategies:

- `staff_referral`: acknowledge the known referral topic without asking the guest to repeat it.
- `social_comment`: acknowledge the social origin without treating the social handle as verified identity.
- `instagram_ad_click`: align opening context with the campaign while avoiding medical assumptions.
- `website_widget`: use a neutral clinic-help opening.

The server determines `time_of_day` from the Clinic timezone. `opening_strategy` is a stable configuration key; display copy may change without a contract update.

A `value_event` records a concrete delivered value such as `clinic_information`, `general_education`, `concern_summary`, or `questions_for_clinician`. These subtype strings live in FunnelEvent `metadata.value_type`; adding one does not change the canonical funnel event name.

## 9. RBAC and security invariants

Authorization is enforced server-side on every protected endpoint and database operation. UI visibility is not authorization.

| Resource/action | Guest | Patient | Staff | Nurse | Clinician |
|---|---:|---:|---:|---:|---:|
| Create/recover own LeadSession | Yes | No | No | No | No |
| Send message in recovered LeadSession | Yes | No | No | No | No |
| Read own consented patient data | No | Own only | No | Clinic, consented | Clinic, consented |
| Send own patient message | No | Own only | No | No | No |
| Read clinic warm leads | No | No | Yes | Yes | Yes |
| Create staff referral | No | No | Yes | Yes | Yes |
| Read escalation queue | No | No | No | Clinic only | Clinic only |
| Update escalation/reply | No | No | No | Clinic only | Clinic only |
| Read raw patient messages | No | Own only | No | Clinic, consented | Clinic, consented |
| View aggregate PHI-free funnel metrics | No | No | Clinic only | Clinic only | Clinic only |

Additional invariants:

- Patient A MUST NOT access Patient B through IDs, query parameters, nested resources, or guessed URLs.
- Staff membership and `clinic_id` are verified server-side; client-provided clinic IDs are never trusted for authorization.
- The `staff` role cannot read patient messages or the clinical escalation queue.
- Nurse/clinician access requires same-clinic membership and valid healthcare consent.
- Protected access remains unavailable during authentication outages; there is no bypass mode.
- Supabase RLS SHOULD provide defense in depth, but backend authorization remains mandatory.
- Privileged Supabase and LLM keys are server-only environment secrets.
- All development/demo records use synthetic data.

## 10. Guest recovery, conversion, and retention

### 10.1 Prototype retention policy

- Guest recovery tokens expire 7 days after last activity.
- Unconverted LeadSessions and guest message content are deleted 30 days after last activity.
- PHI-free FunnelEvents and aggregated acquisition metadata may be retained for 90 days for prototype analytics.
- Converted context follows the patient-record retention policy; production retention requires legal and clinic review and is not claimed by this prototype.
- A scheduled cleanup MAY be simulated for the demo, but the deletion rules and query must be testable.

This is a prototype assumption, not legal advice or a claim of Malaysian regulatory compliance.

### 10.2 Conversion transaction

`guest_to_patient_conversion` executes as one backend-controlled transaction after verified authentication and granted healthcare consent:

1. Lock and validate the recovered LeadSession.
2. Validate the authenticated User and resolve the immutable Patient for that User and Clinic.
3. Validate that the clinic-specific healthcare Consent belongs to that Patient and is currently granted.
4. Create a PatientSession linked to the LeadSession.
5. Copy Attribution to the PatientSession.
6. Make permitted guest context available to the PatientSession without changing original message IDs/provenance.
7. Mark LeadSession `converted` and store resulting IDs.
8. Append `patient_created` exactly once.

The operation is idempotent by `lead_session_id`: a retry returns the existing Patient/PatientSession rather than creating duplicates. If any required persistence fails, the conversion is not reported as successful.

## 11. AI and safety contracts

### 11.1 Backend-to-AI boundary

The backend calls one internal service interface after authentication, ownership, and consent checks:

```ts
interface PatientMessageProcessingInput {
  clinic_id: string;
  patient_id: string;
  patient_session_id: string;
  message_id: string;
  raw_content: string; // in-memory input only; never logged
  current_profile: ProfileSnapshotItem[];
  recent_messages: Array<{
    message_id: string;
    sender_type: SenderType;
    content: string;
    created_at: string;
  }>;
}

interface MemoryMutationProposal {
  type: MemoryType;
  value: string;
  normalized_value: string;
  status: MemoryStatus;
  provenance_pointer: string;
  supersedes_memory_item_id: string | null;
  confidence: Confidence;
}

interface PatientMessageProcessingOutput {
  processing_status: ProcessingStatus;
  risk: Omit<RiskAssessment, "risk_assessment_id" | "created_at">;
  assistant_response: {
    content: string;
    response_kind: "normal" | "safety" | "fallback";
  } | null;
  memory_mutations: MemoryMutationProposal[];
  escalation: {
    required: boolean;
    triage_summary: string[];
    provenance: string[];
  } | null;
  citations: Omit<Citation, "citation_id" | "message_id">[];
}
```

The backend validates the output, assigns stable IDs, persists results, and returns public DTOs. AI output is untrusted structured input and MUST be runtime-validated.

### 11.2 PHI redaction contract

```ts
interface RedactionResult {
  status: "success" | "failed";
  redacted_text: string | null;
  detected_types: Array<"name" | "national_id" | "phone">;
  replacement_count: number;
  failure_reason: string | null;
}
```

- At minimum, names, Malaysian IC/ID-like values, and phone numbers are replaced with the exact placeholder `[REDACTED]` before LLM transmission.
- Redaction runs on every text field included in an LLM request, including recent context and summaries.
- The raw-to-redacted mapping exists only in memory for the request and MUST NOT be logged or persisted in audit metadata.
- If redaction fails or reports an invalid result, no raw or partially processed text is sent to an LLM. Processing fails closed and returns a safe fallback/human path.
- Tests use synthetic identifiers and assert raw values are absent from captured provider input and logs.

### 11.3 Risk-processing contract

Risk processing precedes any normal assistant response.

1. Run deterministic high-risk rules against the patient message.
2. If a high-risk rule matches, set `risk_level = "high"`, block normal clinical advice, and require escalation.
3. Otherwise, use additional constrained classification if configured.
4. Low risk with adequate confidence may receive safe general information.
5. Medium, high, ambiguity, low confidence about material risk, classifier failure, or timeout requires escalation and blocks ordinary clinical advice.

Deterministic rules MUST cover at least:

- severe chest symptoms;
- breathing difficulty;
- heavy bleeding;
- self-harm or suicide-related intent.

Rules have stable IDs such as `high_risk_chest_001`; matched IDs populate `matched_rule_ids`. Exact phrases and matching logic belong to Person 3 tests and do not require a contract change unless semantics change.

Required relationship:

```ts
escalation_required = risk_level !== "low" || confidence === "low";
```

A low-risk classification MUST NOT be treated as a diagnosis or reassurance that no medical problem exists.

### 11.4 Normal response policy

Nightingale AI responses MUST:

- identify the system as AI when relevant;
- remain empathetic and non-diagnostic;
- avoid claiming a diagnosis, changing medication, prescribing treatment, or creating treatment plans;
- avoid false reassurance;
- provide only general information within the permitted low-risk path;
- state uncertainty honestly;
- direct the patient to human or emergency care when policy requires it.

If asked whether Nightingale is a real doctor, the response must convey all three facts:

1. Nightingale is an AI assistant, not a doctor.
2. It helps collect concerns and provide general information for the named clinic.
3. A nurse or clinician becomes involved when human judgment or safety review is needed.

The patient chat UI always shows a visible emergency-services warning beneath the input. Chat content is not a substitute for emergency services.

### 11.5 Model use by risk level

- Any LLM use requires successful redaction.
- High/medium risk blocks a normal generative clinical response.
- Constrained structured memory or triage generation MAY run on redacted text, but failure falls back to deterministic summaries and MUST NOT delay safety guidance.
- Provider output never directly mutates the database; it produces validated proposals.
- LLM timeout or invalid output returns a safe fallback and does not fabricate citations, persistence, or successful processing.

## 12. Patient-message persistence order

The backend uses the following canonical order:

1. Verify authentication, patient ownership, clinic, and healthcare consent.
2. Validate request and apply rate limits.
3. Persist the patient Message with a stable `message_id`.
4. Invoke PHI redaction and risk processing.
5. Decide whether a normal AI response is allowed.
6. Generate a safe response and structured proposals where allowed.
7. In a transaction, persist RiskAssessment, accepted MemoryItems, AI Message/citations if any, and related audit metadata.
8. Return only persisted results.

If step 4–7 fails after the patient Message is saved, the message remains saved, a conservative fallback RiskAssessment is persisted when possible, and the API reports degraded/failed processing without claiming a normal response succeeded. Persistence retries MUST be idempotent by `message_id`.

## 13. Escalation and warm-lead rules

Escalation is offered/created for medium or high risk, ambiguity, meaningful uncertainty, requests requiring diagnosis or clinician interpretation, and explicit patient requests for human review.

The patient action is labeled **Send to Nurse/Clinic**. `POST /api/escalations` generates and durably persists the canonical payload. The success response is returned only after persistence.

Warm-lead ranking uses a small transparent, non-clinical score derived only from:

- recency;
- source channel;
- identity level;
- funnel stage.

Risk level, symptoms, triage content, and escalation status MUST NOT increase a warm-lead sales score. Contact suggestions require available contact information plus the relevant consent.

## 14. API conventions

### 14.1 General rules

- Base path is `/api` for the prototype.
- Request and response bodies use JSON and `snake_case`.
- Every request receives a server-generated `request_id`.
- Mutation endpoints validate input using shared schemas.
- Protected routes derive user and clinic identity from the verified server session, not request body fields.
- API content strings are protected data and MUST NOT be logged.

Success envelope:

```ts
interface ApiSuccess<T> {
  data: T;
  request_id: string;
}
```

Error envelope:

```ts
interface ApiError {
  error: {
    code:
      | "validation_error"
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "consent_required"
      | "rate_limited"
      | "processing_blocked"
      | "dependency_unavailable"
      | "persistence_failed"
      | "internal_error";
    message: string; // safe, non-sensitive text
    details?: Record<string, string | number | boolean | null>;
  };
  request_id: string;
}
```

HTTP mapping: validation `400`, unauthenticated `401`, forbidden/consent `403`, not found `404`, conflict `409`, rate limit `429`, dependency/persistence `503`, unexpected error `500`.

### 14.2 Endpoint contracts

#### `POST /api/lead-sessions`

Auth: public. Creates or recovers a LeadSession and records `visitor`.

```ts
type Request = {
  clinic_id: string;
  source_channel: SourceChannel;
  source_platform: SourcePlatform;
  campaign_id?: string;
  creative?: string;
  social_handle?: string;
  referral_token?: string;
};

type Response = ApiSuccess<{
  lead_session_id: string;
  identity_level: IdentityLevel;
  opening_strategy: string;
  recovery_expires_at: string;
}>;
```

The recovery secret is set only as a secure HTTP-only cookie and is never returned in JSON.

#### `POST /api/guest/messages`

Auth: valid LeadSession recovery cookie. Adds a guest Message and records `conversation_started` once.

```ts
type Request = { lead_session_id: string; content: string };
type Response = ApiSuccess<{
  guest_message: Message;
  assistant_message: Message;
  value_event: FunnelEvent | null;
  trust_transition_available: boolean;
}>;
```

Guest responses remain non-diagnostic. High-risk guest content receives emergency/human guidance without pretending a clinical assessment relationship exists.

#### `POST /api/consents`

Auth: verified User with a clinic-scoped Patient identity shell. Creates an append-only consent decision and records `consented` only for newly granted healthcare consent. If the identity shell does not yet exist, the backend creates or reuses it before persisting consent; this does not itself grant protected patient access.

```ts
type Request = {
  clinic_id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  policy_version: string;
};
type Response = ApiSuccess<{ consent: Consent }>;
```

#### `POST /api/auth/convert`

Auth: verified patient User plus valid LeadSession recovery cookie. Idempotently converts a LeadSession.

```ts
type Request = {
  lead_session_id: string;
  health_consent_id: string;
};
type Response = ApiSuccess<{
  patient: Patient;
  patient_session: PatientSession;
  source_message_ids: string[];
  attribution: Attribution;
}>;
```

#### `POST /api/patient/messages`

Auth: patient, own session, granted healthcare consent.

```ts
type Request = { patient_session_id: string; content: string };
type Response = ApiSuccess<{
  patient_message: Message;
  risk_assessment: RiskAssessment;
  assistant_message: Message | null;
  profile_changes: MemoryItem[];
  escalation_required: boolean;
  send_to_clinic_available: boolean;
  citations: Citation[];
  processing_status: ProcessingStatus;
}>;
```

#### `GET /api/patient/profile`

Auth: patient, own profile, granted healthcare consent.

```ts
type Response = ApiSuccess<{
  patient_id: string;
  items: MemoryItem[]; // current non-superseded items
}>;
```

#### `POST /api/escalations`

Auth: patient, own session, granted healthcare consent. Creates and sends one idempotent escalation per `trigger_message_id`.

```ts
type Request = {
  patient_session_id: string;
  trigger_message_id: string;
  risk_assessment_id: string;
};
type Response = ApiSuccess<{
  escalation: Escalation;
  expected_response_window: "12-18 hours";
}>;
```

#### `GET /api/staff/leads`

Auth: `staff | nurse | clinician`, same clinic. Returns PHI-minimized warm leads.

```ts
interface WarmLead {
  lead_session_id: string;
  source_channel: SourceChannel;
  identity_level: IdentityLevel;
  funnel_stage: FunnelEventName;
  top_concern: string | null;
  warm_lead_score: number;
  score_reasons: string[];
  last_activity_at: string;
  contact_suggestion: string | null;
}
type Response = ApiSuccess<{ leads: WarmLead[] }>;
```

`top_concern` is minimized guest context. It MUST NOT include high-risk scoring or expose more PHI than the role and consent allow.

#### `GET /api/staff/escalations`

Auth: `nurse | clinician`, same clinic, consented records only.

```ts
type Response = ApiSuccess<{ escalations: Escalation[] }>;
```

#### `POST /api/staff/referrals`

Auth: `staff | nurse | clinician`, same clinic.

```ts
type Request = { topic: string; expires_in_hours?: number };
type Response = ApiSuccess<{
  staff_referral: Omit<StaffReferral, "token_hash">;
  referral_url: string;
}>;
```

The raw referral token appears only in the newly generated URL response and MUST NOT be logged.

#### `POST /api/funnel-events`

Auth: LeadSession recovery cookie or authenticated User as appropriate. Accepts UI-observed events only.

```ts
type Request = {
  event_name: "value_event" | "auth_started";
  lead_session_id: string;
  metadata?: Record<string, string | number | boolean | null>;
};
type Response = ApiSuccess<{ funnel_event: FunnelEvent }>;
```

Server-authoritative events (`visitor`, `conversation_started`, `consented`, `patient_created`, `escalation_sent`) are generated by their owning backend workflows and rejected on this endpoint.

## 15. Source of truth for statistics

- Funnel counts come from stored FunnelEvents joined to canonical channel/campaign data.
- Counts of questions, patients, or activity come from live database queries over the relevant records and time window.
- The API response includes the time window used whenever a statistic is displayed.
- If a count is zero, trivial, unavailable, or not sufficiently scoped to the clinic, the UI hides it or uses truthful non-numeric copy.
- No engagement number may be seeded, randomized, inferred by an LLM, or hard-coded for presentation as live data.

## 16. Structured logging and privacy

- Application and audit logs use structured JSON.
- Allowed fields include stable IDs, request IDs, hashes, timestamps, event types, status, duration, provider name, model name, token counts, and non-sensitive error categories.
- Forbidden fields include raw messages, names, emails, phone numbers, IC/ID values, full prompts, provider responses containing patient content, auth tokens, referral/recovery tokens, and raw PHI.
- Exceptions are converted to safe error categories before logging.
- Development debug logging follows the same restrictions as production logging.

## 17. Failure-mode behavior

| Failure | Required behavior |
|---|---|
| LLM timeout/unavailable | Do not invent an answer. Return a safe fallback/retry or human path; preserve the patient message. |
| Redaction failure | Send nothing to the LLM. Fail closed and provide a safe human path. |
| Authentication outage | Protected endpoints remain unavailable. Never bypass auth. |
| Risk classifier timeout/invalid output | Persist or return conservative `system_fallback`; block normal advice and require escalation. |
| Database write failure | Do not claim the message, conversion, memory update, or escalation succeeded. Use idempotent retry keys. |
| Citation retrieval/validation failure | Omit the citation and any claim that depends on it. Never fabricate one. |
| Invalid AI structured output | Reject it with schema validation; use deterministic fallback behavior. |

Patient-facing errors use calm, non-technical language and never expose internal prompts, stack traces, PHI, or secrets.

## 18. Required automated test contracts

The following test names and assertions are canonical across the team:

1. `guest_to_patient_conversion`
   - preserves permitted context, original guest provenance, and Attribution;
   - does not create duplicate patients/sessions on retry;
   - makes the known concern available so the UI does not ask it again.

2. `value_events`
   - records delivered value;
   - displayed statistics trace to live queries and accurate time windows.

3. `escalation_payload`
   - persists trigger message, risk, 1–5 summary bullets, profile snapshot, provenance, and acquisition context.

4. `risk_escalation`
   - severe chest-pain fixture returns `high`;
   - blocks normal clinical advice;
   - sets `escalation_required = true`.

5. `memory_mutation`
   - `Advil active` followed by `stopped last week` produces a superseding stopped item;
   - both revisions and both provenance pointers remain queryable.

6. `redaction`
   - a synthetic name, IC/ID, and phone are replaced by `[REDACTED]` in provider input;
   - none of the raw values appear in captured logs.

7. `access_control`
   - Patient A cannot fetch Patient B data;
   - patient and `staff` cannot fetch the clinical escalation queue;
   - same-clinic nurse/clinician access works only for appropriately consented data.

8. `trust`
   - a guest asking if Nightingale is a real doctor receives the three disclosures in Section 11.4.

Core tests take priority over bonus tests. Unit tests own deterministic safety/memory behavior; integration tests own API, database, consent, provenance, and RBAC behavior; Playwright owns the minimum end-to-end journey.

## 19. Deferred features

The following are out of scope until the core vertical slice and required tests pass:

- real Meta, Instagram, TikTok, or WhatsApp integrations;
- audio recording or VoiceAI;
- vector search or a vector database;
- complex analytics and lead scoring;
- advanced contradiction resolution;
- re-engagement automation;
- extensive synthetic traffic replay;
- separate microservices or background-job infrastructure.

Schema remains voice-ready through nullable Message audio/transcript fields. A future clinician communication module attaches to `Escalation` by adding append-only clinician/patient communication records linked by `escalation_id`; it MUST NOT rewrite escalation snapshots.

## 20. Documentation assumptions

The Technical Brief must clearly document:

- the architecture and safety pipeline;
- the Message/Profile/Citation/Escalation relationships;
- future clinician communication and VoiceAI attachment points;
- trade-offs and deferred features;
- channel feasibility across technical, Malaysian legal/privacy/advertising, platform-policy, and trust axes;
- that legal conclusions require verification and are not invented.

`README.md` eventually documents setup, environment variables, run/test commands, redaction location, RBAC enforcement, and failure modes. `ATTRIBUTION.txt` lists libraries, models, sources, and relevant licenses.

## 21. Security and safety acceptance checklist

Before the demo/release candidate is considered integrated:

- [ ] Browser contains no privileged Supabase or LLM secrets.
- [ ] Patient isolation and clinic isolation tests pass.
- [ ] Consent is checked server-side before protected patient processing/access.
- [ ] Raw PHI is absent from LLM captures and structured logs.
- [ ] Deterministic high-risk fixtures pass.
- [ ] Ambiguous/failed risk processing blocks normal advice.
- [ ] Escalation success is shown only after persistence.
- [ ] Guest conversion preserves Attribution and original provenance.
- [ ] Live statistics are query-backed.
- [ ] Emergency-services warning is visible beneath patient chat input.
- [ ] Demo data is synthetic.

## 22. Contract version and change procedure

This file uses semantic versions:

- Patch: clarification with no code-shape change.
- Minor: backward-compatible addition.
- Major: rename, removal, incompatible schema/API/semantic change.

To change a shared contract:

1. Describe the integration need and affected teams.
2. Edit this file first, including the version and decision log.
3. Notify all three team members.
4. Update shared schemas/tests.
5. Then update implementations.

During the 48-hour build, approval in the team chat is sufficient. No developer may silently rename or reinterpret a shared field, enum, endpoint, event, role, or safety rule.

### Decision log

| Version | Date | Decision |
|---|---|---|
| 0.1.0 | 2026-09-01 | Initial prototype contract: modular monolith, shared entities/enums, API boundary, safety order, provenance, RBAC, and failure behavior. |

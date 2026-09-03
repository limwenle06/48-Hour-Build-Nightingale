# Data access and persistence

**Owner:** Person 2

`patient-auth-repository.ts` is the server data boundary for patient identity, consent, and guest conversion. It calls service-role-only PostgreSQL functions and runtime-validates every returned object before an API response is sent.

The database functions in `0002_auth_and_conversion.sql` provide the transaction boundaries:

- `ensure_patient_identity` verifies Supabase Auth and creates/reuses the patient shell.
- `record_patient_consent` appends a consent decision.
- `convert_lead_session` locks the guest session and atomically checks recovery, ownership, clinic, and current healthcare consent before conversion.

No route reports conversion success until the database function has committed.

`guest-repository.ts` is the equivalent boundary for pre-authentication activity. It creates or recovers LeadSessions, appends guest exchanges, records UI-observed funnel events, and runtime-validates every PostgreSQL result before it reaches the browser.

`patient-repository.ts` begins authenticated patient messages, finalizes the structured AI/safety result, and loads the current Living Profile. Every database response is validated before it reaches an API route.

`staff-repository.ts` is the runtime-validated boundary for staff roles, escalations, warm leads, referral creation, and funnel metrics. Role and clinic authorization are rechecked inside every privileged database function.

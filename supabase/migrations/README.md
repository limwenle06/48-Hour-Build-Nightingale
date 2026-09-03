# Database migrations

**Owner:** Person 2

`0001_initial_schema.sql` is the single initial migration for the 48-hour prototype. It creates the schema, constraints, indexes, integrity triggers, grants, and RLS policies in one transaction.

`0002_auth_and_conversion.sql` adds service-role-only transaction functions for verified patient identity, append-only consent, and idempotent guest-to-patient conversion. It also separates original attribution identity from the LeadSession's current identity level.

`0003_guest_journey.sql` adds service-role-only functions for LeadSession creation/recovery, atomic guest and assistant messages, guest funnel events, and consent attribution. Recovery uses a sliding seven-day expiry and returns stored guest messages only after the HTTP-only credential is validated.

The build uses text columns with database `CHECK` constraints for contract enums. This is easier to review and change during a short prototype than many PostgreSQL enum migrations while still rejecting invalid values.

Rules:

- Never edit a migration after it has been applied to a shared hosted database. Add a numbered migration instead.
- Never make manual dashboard schema changes that are missing from this folder.
- Never store a raw recovery/referral token, API key, password, or real patient data in SQL.
- Test a fresh database with `supabase db reset` before applying changes remotely.
- Use synthetic seed data only.

# Backend unit tests

**Owner:** Person 2

`schema-migration.test.ts` checks that the initial migration follows the shared contract. It verifies required tables, UUID auth mapping, hashed tokens, RLS coverage, narrow grants, fixed privileged-function search paths, and append-only protection.

`auth-conversion-migration.test.ts`, `auth-helpers.test.ts`, and `patient-auth-repository.test.ts` check verified identity, strict request validation, recovery hashing, restricted database functions, atomic conversion, provenance preservation, and runtime validation of database results.

`guest-journey-migration.test.ts`, `guest-repository.test.ts`, and `guest-safety-and-schemas.test.ts` check guest recovery, token/referral hashing, service-role function access, atomic guest persistence, safe funnel metadata, deterministic pre-authentication risk guidance, and runtime result validation.

Run it with the full suite:

```powershell
npm.cmd test
```

These tests inspect the migration itself. PostgreSQL execution is separately verified with `supabase db reset` and `supabase db lint` when the Supabase CLI and Docker are available.

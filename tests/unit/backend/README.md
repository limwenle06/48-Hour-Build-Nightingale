# Backend unit tests

**Owner:** Person 2

`schema-migration.test.ts` checks that the initial migration follows the shared contract. It verifies required tables, UUID auth mapping, hashed tokens, RLS coverage, narrow grants, fixed privileged-function search paths, and append-only protection.

Run it with the full suite:

```powershell
npm.cmd test
```

These tests inspect the migration itself. PostgreSQL execution is separately verified with `supabase db reset` and `supabase db lint` when the Supabase CLI and Docker are available.

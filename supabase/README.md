# Supabase database

**Owner:** Person 2

The Supabase PostgreSQL database is defined entirely by versioned files in `supabase/migrations/`.

The first migration provides:

- all canonical Nightingale tables and UUID relationships;
- hashed guest-recovery and staff-referral tokens;
- append-only clinical evidence, consent history, funnel events, and audit logs;
- database checks for contract enum values and risk/escalation relationships;
- Row Level Security for patient ownership, clinic membership, staff roles, and current healthcare consent;
- server-only writes through the Supabase `service_role`.

Guests never query tables directly. A Next.js server route must validate the secure HTTP-only recovery cookie, hash its opaque token, and then perform the minimum required database operation with the server-only client.

Authenticated browser clients receive read-only access to records allowed by RLS. All mutations go through server routes, where application authorization is checked again before the service-role client is used.

Never place `SUPABASE_SERVICE_ROLE_KEY` in client code or a `NEXT_PUBLIC_` environment variable.

## Local verification

With the Supabase CLI and Docker installed:

```bash
supabase start
supabase db reset
supabase db lint
```

The repository test suite also checks the migration contract:

```bash
npm test
```

Static tests do not replace applying the migration to PostgreSQL. Run `supabase db reset` before deployment or a live demo using connected mode.

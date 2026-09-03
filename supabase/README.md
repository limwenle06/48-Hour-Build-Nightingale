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

The guest routes persist only the token hash. They atomically create attributed LeadSessions, append guest/assistant messages, record authoritative funnel stages, and refresh the seven-day recovery window after valid activity.

Authenticated browser clients receive read-only access to records allowed by RLS. All mutations go through server routes, where application authorization is checked again before the service-role client is used.

Never place `SUPABASE_SERVICE_ROLE_KEY` in client code or a `NEXT_PUBLIC_` environment variable.

Connected mode requires these values in `.env.local`:

```text
NEXT_PUBLIC_NIGHTINGALE_MOCK=false
NEXT_PUBLIC_NIGHTINGALE_CLINIC_ID=<UUID from the clinics table>
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

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

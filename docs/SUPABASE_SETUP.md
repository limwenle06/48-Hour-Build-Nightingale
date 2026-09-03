# Supabase Setup for the Connected Demo

Mock mode needs no Supabase project. Complete these steps only when testing the real connected mode.

## 1. Create and configure the project

Create a Supabase project and keep email authentication enabled. In the SQL editor, run these files in numeric order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_auth_and_conversion.sql`
3. `supabase/migrations/0003_guest_journey.sql`
4. `supabase/migrations/0004_patient_journey.sql`
5. `supabase/migrations/0005_staff_and_escalations.sql`
6. `supabase/seed.sql`

Stop if any file reports an error. Do not skip ahead or manually edit an already-applied shared migration.

## 2. Create `.env.local`

Copy `.env.example` to `.env.local`, then use values from Supabase **Project Settings → API**:

```text
NEXT_PUBLIC_NIGHTINGALE_MOCK=false
NEXT_PUBLIC_NIGHTINGALE_CLINIC_ID=11111111-1111-4111-8111-111111111111
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service-role secret>
```

The service-role key must never use a `NEXT_PUBLIC_` name and must never be committed. Restart the development server after changing environment values.

OpenAI is optional. Without it, low-risk patient messages receive a safe unavailable-provider fallback; deterministic safety still runs.

## 3. Provision one synthetic staff account

In Supabase Authentication, create and verify a synthetic staff user such as `nurse@example.test`. Copy its Auth user UUID. Replace only `<AUTH_USER_UUID>` below, then run:

```sql
begin;

with app_user as (
  insert into public.users (auth_user_id, role, verified_email)
  values ('<AUTH_USER_UUID>'::uuid, 'nurse', 'nurse@example.test')
  returning user_id
)
insert into public.staff_users (user_id, clinic_id, role)
select
  app_user.user_id,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'nurse'
from app_user;

commit;
```

Staff accounts are clinic-provisioned. Do not add public staff signup or let a browser choose its own role.

## 4. Verify

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Then manually test guest question → patient sign-in/verification → consent → conversion → patient message → profile → escalation → staff sign-in and queue. Use synthetic information only.

If connected setup is incomplete near presentation time, switch `.env.local` back to `NEXT_PUBLIC_NIGHTINGALE_MOCK=true` and restart the server.

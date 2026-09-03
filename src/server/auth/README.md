# Authentication, consent, and authorization

**Owner:** Person 2

Patient signup and login use Supabase Auth through `POST /api/auth/session`. The server validates the returned session with `auth.getUser()` and requires `email_confirmed_at` before creating a clinic-scoped patient identity.

`POST /api/consents` records an append-only consent decision. `POST /api/auth/convert` additionally requires the valid HTTP-only guest recovery cookie and calls one atomic PostgreSQL function.

Security rules:

- Never trust a browser-provided user, patient, or clinic identity.
- Never parse a JWT manually; use Supabase `auth.getUser()`.
- Never expose the service-role key to browser code.
- Never store or log the raw guest recovery token.
- Staff accounts cannot be silently converted into patient accounts.
- Unconfirmed email accounts cannot enter protected patient workflows.
- Missing configuration and database failures fail closed.

The LeadSession route creates a high-entropy recovery token and stores it only in a secure HTTP-only cookie. PostgreSQL receives only its SHA-256 hash. Valid guest activity refreshes both the cookie and database expiry for seven days.

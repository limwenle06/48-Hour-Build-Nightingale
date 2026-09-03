# Staff access and referral boundaries

**Owner:** Person 2

Staff accounts are provisioned by the clinic and authenticated through Supabase. `staff`, `nurse`, and `clinician` roles may view same-clinic non-clinical leads, metrics, and create referrals; only `nurse` and `clinician` may read the consent-filtered clinical escalation queue.

Referral URLs contain a newly generated opaque token. Only its SHA-256 hash is sent to PostgreSQL. Raw tokens, passwords, topics, and patient content must never enter logs.

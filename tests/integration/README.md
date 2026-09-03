# Integration tests

**Shared ownership:** Persons 2 and 3, with Person 1 supporting journey assertions

`ai-pipeline.test.ts` covers the Person 3 backend boundary, including redaction before provider use, low-risk processing, high-risk escalation, Memory provenance, provider failure, and invalid input.

Person 2 migration/repository suites cover persistence boundaries, conversion, access-control structure, value events, patient processing, escalations, and staff operations without requiring network access. Executing the SQL and end-to-end RBAC behaviour still requires the configured Supabase project described in `docs/SUPABASE_SETUP.md`.

# Integration tests

**Shared ownership:** Persons 2 and 3, with Person 1 supporting journey assertions

`ai-pipeline.test.ts` covers the Person 3 backend boundary, including redaction before provider use, low-risk processing, high-risk escalation, Memory provenance, provider failure, and invalid input.

Person 2 integration tests still need to cover persistence, conversion, access control, value events, and API behaviour.

# Backend workflow services

**Owner:** Person 2

`patient-message-service.ts` connects the authenticated persistence boundary to Person 3's safety pipeline. It saves the patient message first, supplies the current profile and recent conversation, and persists only the validated pipeline result. Unexpected processing failures become a conservative low-confidence result with a human-review path.

Provider configuration is optional for local testing. When it is unavailable, the pipeline uses its safe fallback and never invents an AI answer.

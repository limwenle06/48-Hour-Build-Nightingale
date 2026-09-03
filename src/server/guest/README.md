# Guest journey backend

**Owner:** Person 2, using Person 3 deterministic safety rules

`schemas.ts` strictly validates public LeadSession, guest-message, and funnel-event requests. Protected content is rejected from funnel metadata.

`safe-response.ts` applies deterministic high/medium risk rules before returning concise non-diagnostic guest guidance. It never calls an external LLM.

`api-error.ts` converts database failures into the canonical safe API error vocabulary without exposing database details.

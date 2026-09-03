# Structured audit logging

**Owner:** Person 2

Patient-message, escalation, and referral transaction functions append structured audit rows. Metadata is limited to processing status, risk level, escalation-required state, and referral expiry. Resource, actor, clinic, and request IDs are stored separately.

Raw messages, referral topics, names, contact details, prompts, provider responses, passwords, and recovery/referral tokens are never placed in audit metadata.

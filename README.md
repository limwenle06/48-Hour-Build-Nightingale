# Nightingale

Nightingale is a 48-hour healthcare software prototype focused on trusted acquisition, consented patient intake, Living Memory with provenance, deterministic risk gating, and human escalation. It is an AI assistant, not a doctor or diagnostic system.

## Status

The Person 3 AI and safety module is implemented and tested. Frontend, backend persistence, authentication, authorization, and full application integration are separate team responsibilities and may still be in progress.

All shared names, schemas, API boundaries, ownership rules, and safety requirements are defined in [`TEAM_CONTRACT.md`](TEAM_CONTRACT.md).

## Setup

Install a recent Node.js release with npm, then run:

```bash
npm install
```

Automated tests use a fake provider and do not require an API key.

For optional server-side OpenAI use, copy `.env.example` to the server environment and configure:

```text
LLM_PROVIDER=openai
LLM_MODEL=<an OpenAI model available to the project>
LLM_API_KEY=<server-side secret>
```

Never commit `.env.local` or expose `LLM_API_KEY` in browser code.

## Tests

```bash
npm test
npm run typecheck
```

If Windows PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd test
npm.cmd run typecheck
```

## Person 3 processing flow

```text
Patient message
  -> PHI redaction
  -> deterministic risk assessment
  -> safe response or human-safety path
  -> Living Memory proposals with message provenance
  -> escalation summary when required
  -> runtime-validated result for the backend
```

The backend entry point is `src/server/ai/process-patient-message.ts`. Person 2 must call it only after authentication, patient ownership, clinic, and healthcare-consent checks. The function returns structured proposals; it does not claim or perform database persistence.

## Security and failure behaviour

- Raw patient text is redacted before any provider call.
- High- and medium-risk messages cannot receive a normal AI response.
- Redaction failure blocks provider use.
- Provider errors, invalid output, and timeouts use deterministic safe fallbacks.
- Memory corrections retain the originating message ID and superseded item ID.
- Escalations contain concise deterministic summaries and message provenance.
- Recent messages are not sent to the provider in the core prototype.
- Development and demonstration must use synthetic patient data only.

## Run the application

The complete PWA becomes runnable after the frontend and backend are integrated. This branch currently provides the tested Person 3 module rather than a standalone user interface.

## Team ownership

- Person 1: frontend, product journey, acquisition UX, and staff-facing UI.
- Person 2: backend, database, authentication, authorization, persistence, and security.
- Person 3: AI, PHI redaction, safety, risk gating, Living Memory, provenance, and escalation generation.

# Nightingale — secure first-touch-to-care PWA

Nightingale is a 48-hour healthcare software prototype for turning a first clinic question into a consented patient conversation. It is an AI assistant, not a doctor or diagnostic system.

`Acquisition → LeadSession → guest value → trust transition → authentication + consent → PatientSession → Living Profile → risk gate → clinician escalation`

The repository currently combines the tested Person 1 frontend with the tested Person 3 AI and safety module. Person 2 backend persistence, authentication, authorization, and API integration are the remaining implementation work.

All names, schemas, API boundaries, ownership rules, and safety requirements are defined in [`TEAM_CONTRACT.md`](TEAM_CONTRACT.md).

## Quick start

Install a recent Node.js release with npm, then run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The frontend uses clearly labelled synthetic mock data by default.

To make the frontend call the real Person 2 API routes, set this server environment value:

```text
NEXT_PUBLIC_NIGHTINGALE_MOCK=false
```

## Verification

```bash
npm test
npm run typecheck
npm run build
```

If Windows PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Optional OpenAI provider

Automated tests use a fake provider and do not require an API key. For optional server-side OpenAI use, copy `.env.example` to `.env.local` and configure:

```text
LLM_PROVIDER=openai
LLM_MODEL=<an OpenAI model available to the project>
LLM_API_KEY=<server-side secret>
```

Never commit `.env.local`, expose `LLM_API_KEY` in browser code, or use real patient data in development or demonstrations.

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

The backend entry point is `src/server/ai/process-patient-message.ts`. Person 2 must call it only after authentication, patient ownership, clinic, and healthcare-consent checks. It returns structured proposals; Person 2 is responsible for database persistence.

## Safety and failure behaviour

- Safety screening must happen before every normal response.
- Raw patient text is redacted before any external provider call.
- High- and medium-risk messages cannot receive a normal AI response.
- Redaction failure blocks external provider use.
- Provider errors, invalid output, and timeouts use deterministic safe fallbacks.
- Memory corrections retain message provenance and the superseded item ID.
- High-risk concerns show emergency action before signup or conversion prompts.
- All demo content and patient information must be synthetic.

## Frontend demo route

1. Start a guest question from one of the synthetic acquisition channels.
2. Continue securely to show the trust and consent transition.
3. Open the patient chat and Living Profile.
4. Use the synthetic symptom, medication correction, human-review, and emergency examples.
5. Open the staff dashboard to show warm leads, escalations, funnel data, and a staff referral link.

Mock behaviour is only for demonstrating the interface. Real storage, login, consent, clinic isolation, and staff access depend on the Person 2 backend.

## Repository map

```text
src/app/                         Next.js pages
src/components/nightingale/     Patient and staff interface
src/config/                      Acquisition channel rules and prompts
src/contracts/                   Shared runtime-validated AI contracts
src/server/ai/                   Safe response orchestration
src/server/safety/               PHI redaction and deterministic risk rules
src/server/memory/               Living Memory extraction and mutation
src/server/escalation/           Clinician escalation summary generation
tests/unit/frontend/             Person 1 frontend tests
tests/unit/ai-safety/            Person 3 module tests
tests/integration/               Person 3 processing-flow tests
prototype-reference/flask-v2/    Archived Flask prototype reference only
```

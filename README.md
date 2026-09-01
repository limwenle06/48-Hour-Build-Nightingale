# Nightingale — secure first-touch-to-care PWA

Nightingale is a production-credible, deterministic prototype of the journey:

`Acquisition → LeadSession → guest value → trust transition → authentication + consent → PatientSession → Living Profile → risk gate → clinician escalation`

It is deliberately **not** a diagnosis bot. The demo is synthetic and all channel delivery, email verification, clinic notifications, external LLM behavior, and infrastructure encryption are clearly simulated.

## Product principles

**Assume the patient is always tired.** A patient may be unwell, worried, distracted, or impatient. Patient screens therefore use short sentences, one primary action, one question at a time, and no repeated intake. Detail remains available to clinicians where precision helps care.

**Clinical urgency outranks acquisition and conversion.** Safety screening runs before every response, including for anonymous guests. A high-risk guest sees a prominent `Call 999` action immediately; signup is neither required nor the main action. This intentionally sacrifices conversion opportunities when safety requires it. That is a product decision, not a funnel failure.

## Quick start

Requires Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Open <http://127.0.0.1:5000>. The SQLite database is created and seeded automatically in `instance/nightingale.db`.

Run every test with one command:

```bash
python -m pytest -q
```

## Three-minute demo route

1. Open **Ask a question**. The entry is an Instagram campaign with full attribution. Send `My stomach hurts.`, then `It started last week.` Nightingale acknowledges the timeline and asks one new question.
2. Refresh the page. The same recovery URL restores the guest messages and attribution.
3. Continue securely, use any synthetic email/phone, password `Secret123!`, and consent. The concern appears in the Living Profile without being re-asked.
4. Send `I take Advil.`, then `Actually I stopped last week.` Observe active → stopped with provenance preserved.
5. In a fresh guest demo send `I have crushing chest pain.` The primary action becomes **Call 999** before authentication. Refresh and confirm that urgent state remains.
6. In an authenticated chat send `my chest feels funny`. It becomes **Needs human review** with **Send to Clinic**, distinct from an emergency.
7. Sign in as `clinician@demo.test`. Show compact `URGENT · HIGH RISK` / `NEEDS REVIEW · MEDIUM RISK` tags, funnel metrics, and high-risk exclusion from warm leads.
8. Select **Create warm handoff**, enter `asked about egg freezing at today's visit`, and open the generated personal link.

Other clinic accounts use the same password: `staff@demo.test`, `nurse@demo.test`.

## Architecture

- **UI/PWA:** server-rendered Jinja, responsive CSS, small vanilla-JS interactions, web manifest and offline shell cache.
- **Application:** Flask routes call deterministic service functions for channel rules, risk, redaction, memory, conversion, and escalation.
- **Persistence:** SQLAlchemy + SQLite locally; entities are relational and Postgres-ready.
- **Channel behavior:** `channel_rules.json` is the single declarative mapping for channel × identity level opening strategy and warm-lead channel weight.
- **Future clinical module:** `Escalation` is an append-oriented integration boundary with status and `clinician_response`; a queue worker or EHR adapter can consume it without changing patient chat.

### Core relationships

- `LeadSession` owns guest `Message` and `FunnelEvent` rows and retains clinic/source/campaign/creative/identity/timestamp.
- Consented conversion creates one `PatientSession` linked to the immutable `LeadSession` and patient `User`.
- `ProfileItem.provenance_pointer` links current state to its source `Message`; `ProfileRevision` preserves every earlier state and source.
- `Citation` links a response to a resolvable title, URL, and source span (schema-ready; deterministic v1 avoids unsupported clinical claims).
- `Escalation` persists trigger, risk, 1–5 bullet summary, point-in-time profile, provenance links, and acquisition context.
- `Message.source_type` and `audio_transcript_id` reserve the future voice/transcript path.

## Safety, privacy, and access

Risk classification happens **before** the normal response, even for guests. Exact high-risk requirements are deterministic; ambiguous chest language escalates with low confidence.

- **High / emergency:** normal guidance stops; `Call 999` is primary; neither signup nor an ordinary clinic wait is presented as the safety plan. A consented user may additionally alert the clinic.
- **Medium / human review:** guidance is constrained and the patient may securely send context to the clinic. No response-time guarantee is invented.
- **Low:** the deterministic conversation asks at most one useful follow-up at a time, using prior messages to avoid repeating itself.

`redact_phi()` in `nightingale/app.py` removes names introduced by “my name is,” Malaysian/Singapore-style identity numbers, and Malaysian mobile numbers before text reaches the response/LLM boundary. Version 1 has no external LLM call. If redaction cannot run, processing raises and fails closed. Audit records contain hashed actor IDs, object IDs, risk/operation metadata, and never message content.

RBAC and resource ownership are checked server-side using `@login_required`, `@roles`, and `owned_ps()`—not hidden only in the UI. Patient A cannot fetch Patient B. Patients cannot access `/clinic`. Staff/nurse/clinician access is limited to their clinic. Escalation also re-checks consent.

Production deployment must add TLS termination, managed Postgres encryption at rest, secret management, real verified OTP/email, CSRF protection, security headers, backup/restore drills, and key rotation. The local SQLite file is **not represented as infrastructure-grade encrypted storage**.

## Failure behavior

- External LLM failure cannot block v1 because deterministic safe responses are primary. A future adapter must time out to the same non-diagnostic fallback.
- Redaction failure stops processing rather than sending unredacted text.
- Refresh/navigation recovery uses the stable `/r/<token>` URL and reloads persisted guest messages, attribution, value events, and the latest risk state for seven days. It does not create a Patient Profile or expose guest context to staff.
- Invalid auth returns a generic 401; context remains intact.
- Duplicate handoff for one triggering message returns the existing escalation (idempotent).
- Missing content returns 400; guest abuse is capped at 20 messages per session.
- Service worker caches the basic shell; server persistence protects context through a browser interruption.

## Simulated vs real

| Capability | Version 1 |
|---|---|
| Lead/patient/messages/profile/escalation persistence | Real, local SQLite |
| Risk gate, redaction, mutation, RBAC, funnel metrics | Real deterministic application logic |
| Meta/TikTok/WhatsApp webhooks and DM delivery | Simulated channel contracts |
| Email OTP and transactional summary delivery | Simulated verification boundary |
| Clinic notification/EHR transport | Simulated; escalation record is real |
| LLM response generation | Not called; deterministic and explicitly labelled |
| TLS / managed encryption at rest | Deployment responsibility, not claimed locally |

## Test coverage

The suite contains the eight required micro-tests plus tired-patient conversational behavior, refresh/recovery, recovered emergency state, channel differentiation, staff prefill, all four mandatory emergency phrases before authentication, ambiguous-risk handling, warm-lead safety exclusion, fake-statistic prevention, and idempotent escalation. The misspelled official filename `test_escalation_payloa.py` is retained, with a correctly named compatibility file as well.

## Data policy

Synthetic data only. Guest records expire after seven days in the data model; a production scheduler should hard-delete guest message content at expiry while retaining only PHI-free aggregate funnel metadata for abandonment analysis. Marketing consent is not collected, so this build never suggests re-engagement or sales outreach. High-risk leads are excluded from the warm-sales list.

## Repository map

```text
channel_rules.json         Declarative acquisition behavior
nightingale/app.py         Entities, safety/services, RBAC, routes
nightingale/templates/     Patient and clinic UI
nightingale/static/        Responsive PWA shell
tests/                     Required and bonus micro-tests
ATTRIBUTION.txt            Libraries, licenses, model disclosure
```

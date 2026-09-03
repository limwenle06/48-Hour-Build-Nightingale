# Nightingale Demo Script

Target: 2 minutes 45 seconds. Use synthetic mock mode for the most reliable challenge demo. Say that the same UI is connected to tested server routes and Supabase migrations, but do not claim a live database unless it was actually configured and tested.

## Before presenting

1. Run `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run test:e2e`.
2. Start with `npm.cmd run dev` and open <http://localhost:3000>.
3. Keep `NEXT_PUBLIC_NIGHTINGALE_MOCK=true` unless the full Supabase setup has been verified.
4. Reset demo data from the developer controls.

## Spoken walkthrough

**0:00–0:20 — Problem and entry**

“Nightingale turns a first clinic question into a safe, consented care journey without making the patient repeat themselves. I’ll enter through a website widget, but the same flow supports ads, social comments, and staff referrals.”

Open the guest start page. Point out that no account is required for initial value.

**0:20–0:45 — Trust before signup**

Send: `Is this a real doctor?`

“The assistant clearly says it is AI, not a doctor, that clinic staff can review sent concerns, and that it does not replace emergency care.”

Then send: `I have been taking Advil for headaches.`

Show the useful non-diagnostic reply and select **Continue securely**.

**0:45–1:15 — Authentication, consent, and continuity**

Use the synthetic patient details. Accept healthcare consent and continue.

“Authentication and healthcare consent are separate. The backend preserves the original acquisition and guest Message IDs during conversion, so provenance is not lost.”

Open the patient chat and Living Profile. Send: `I stopped taking Advil.`

Show that the new profile revision supersedes the older medication state rather than deleting its evidence.

**1:15–1:50 — Safety and human handoff**

Send: `My chest feels funny.`

“Ambiguous chest symptoms are blocked from normal AI advice and offered for clinician review.”

Choose **Send to Nurse/Clinic**.

“The success message appears only after the escalation is stored. The case snapshots the risk, profile, attribution, and message provenance.”

If time allows, demonstrate: `I have severe chest pain and cannot breathe.` Point out the immediate **Call 999 now** action and say not to wait for Nightingale or the clinic.

**1:50–2:30 — Staff workspace**

Open the staff workspace. Show:

- the nurse/clinician review queue;
- the structured case and provenance;
- warm leads scored only from recency, channel, identity, and funnel stage;
- acquisition metrics by channel;
- an expiring referral link whose URL contains an opaque token, not the topic.

**2:30–2:45 — Close**

“Nightingale is a small modular monolith designed for a safe 48-hour prototype: privacy before AI, deterministic risk screening before normal responses, consent and clinic isolation in the database, and human review whenever the system is uncertain.”

## If something fails

- Keep the mock-mode tab available as the primary fallback.
- If the provider is unavailable, explain that the safe fallback is deliberate and no answer is invented.
- Never enter real names, phone numbers, IDs, or patient information during the demo.

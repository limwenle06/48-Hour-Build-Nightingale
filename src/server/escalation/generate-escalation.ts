import {
  escalationGenerationInputSchema,
  escalationGenerationSchema,
  type EscalationGeneration,
  type ProfileSnapshotItem,
} from "../../contracts";

const MAX_BULLET_LENGTH = 500;
const MAX_MESSAGE_SUMMARY_LENGTH = 240;

function compactText(text: string, maximumLength: number): string {
  const compacted = text.replace(/\s+/g, " ").trim();

  if (compacted.length <= maximumLength) {
    return compacted;
  }

  return `${compacted.slice(0, maximumLength - 1).trimEnd()}…`;
}

function formatProfileValues(
  profile: ProfileSnapshotItem[],
  types: ProfileSnapshotItem["type"][],
): string[] {
  return profile
    .filter((item) => types.includes(item.type))
    .map((item) => `${item.value} (${item.status})`);
}

function addProfileBullet(
  bullets: string[],
  label: string,
  values: string[],
): void {
  if (values.length === 0 || bullets.length >= 5) {
    return;
  }

  bullets.push(
    compactText(`${label}: ${values.join(", ")}.`, MAX_BULLET_LENGTH),
  );
}

export function generateEscalation(
  input: unknown,
): EscalationGeneration | null {
  const parsedInput = escalationGenerationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return null;
  }

  const { risk, redaction, profile_snapshot: profile } = parsedInput.data;

  if (!risk.escalation_required) {
    return null;
  }

  const bullets = [
    compactText(
      `Risk: ${risk.risk_level}. ${risk.risk_reason}`,
      MAX_BULLET_LENGTH,
    ),
  ];

  if (redaction.status === "success") {
    bullets.push(
      `Triggering message: ${compactText(
        redaction.redacted_text,
        MAX_MESSAGE_SUMMARY_LENGTH,
      )}`,
    );
  } else {
    bullets.push(
      "Triggering message content unavailable because redaction failed.",
    );
  }

  addProfileBullet(
    bullets,
    "Current concerns",
    formatProfileValues(profile, [
      "chief_complaint",
      "symptom",
      "symptom_timeline",
    ]),
  );
  addProfileBullet(
    bullets,
    "Medications",
    formatProfileValues(profile, ["medication"]),
  );
  addProfileBullet(
    bullets,
    "Allergies",
    formatProfileValues(profile, ["allergy"]),
  );

  const provenance = [
    risk.message_id,
    ...profile.map((item) => item.provenance_pointer),
  ].filter((messageId, index, allIds) => allIds.indexOf(messageId) === index);

  return escalationGenerationSchema.parse({
    required: true,
    triage_summary: bullets.slice(0, 5),
    provenance: provenance.slice(0, 100),
  });
}

import type {
  Citation,
  MemoryItem,
  ProcessingStatus,
  RiskLevel,
} from "./frontend-types";

/** SYNTHETIC FRONTEND FIXTURES ONLY. Exact strings select presentation states;
 * this is not a risk classifier, medical engine, or memory extractor. Connected
 * mode never reads these fixtures. */
export interface SyntheticPatientScenario {
  label: string;
  input: string;
  risk_level: RiskLevel;
  processing_status: ProcessingStatus;
  escalation_required: boolean;
  assistant_content: string | null;
  profile_items?: MemoryItem[];
  citations?: Citation[];
  handoff_behavior?: "success" | "failure" | "unavailable";
}

const at = "2026-09-02T00:00:00.000Z";
export const syntheticPatientScenarios: SyntheticPatientScenario[] = [
  {
    label: "Normal",
    input: "Demo: normal",
    risk_level: "low",
    processing_status: "success",
    escalation_required: false,
    assistant_content:
      "Thanks — I’ve kept that in this demo chat. What else should the clinic know?",
  },
  {
    label: "Medium review",
    input: "My chest feels funny",
    risk_level: "medium",
    processing_status: "blocked",
    escalation_required: true,
    assistant_content: null,
  },
  {
    label: "High emergency",
    input: "I want to hurt myself",
    risk_level: "high",
    processing_status: "blocked",
    escalation_required: true,
    assistant_content: null,
  },
  {
    label: "Processing failure",
    input: "Demo: processing failure",
    risk_level: "medium",
    processing_status: "failed",
    escalation_required: true,
    assistant_content: null,
  },
  {
    label: "Handoff failure",
    input: "Demo: handoff failure",
    risk_level: "medium",
    processing_status: "blocked",
    escalation_required: true,
    assistant_content: null,
    handoff_behavior: "failure",
  },
  {
    label: "Handoff unavailable",
    input: "Demo: handoff unavailable",
    risk_level: "medium",
    processing_status: "blocked",
    escalation_required: true,
    assistant_content: null,
    handoff_behavior: "unavailable",
  },
  {
    label: "Populated profile",
    input: "Demo: populated profile",
    risk_level: "low",
    processing_status: "success",
    escalation_required: false,
    assistant_content: "This synthetic profile fixture is ready to inspect.",
    profile_items: [
      {
        memory_item_id: "memory_fixture_1",
        patient_id: "patient_demo",
        type: "medication",
        value:
          "A deliberately long synthetic medication value for responsive layout testing",
        normalized_value: "synthetic medication",
        status: "active",
        provenance_pointer: "message_fixture_profile_1",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_fixture_2",
        patient_id: "patient_demo",
        type: "allergy",
        value: "Synthetic allergy fixture",
        normalized_value: "synthetic allergy fixture",
        status: "historical",
        provenance_pointer: "message_fixture_profile_2",
        source_session_type: "patient",
        supersedes_memory_item_id: "memory_fixture_old",
        confidence: "med",
        created_at: at,
        updated_at: at,
      },
    ],
  },
  {
    label: "Citation present",
    input: "Demo: citation present",
    risk_level: "low",
    processing_status: "success",
    escalation_required: false,
    assistant_content:
      "This synthetic fixture includes a clearly labelled test source.",
    citations: [
      {
        citation_id: "citation_fixture_1",
        message_id: "message_fixture_citation_1",
        title: "Synthetic citation fixture",
        source_url: "https://example.test/synthetic-source",
        publisher: "Demo source — not medical evidence",
        retrieved_at: at,
      },
    ],
  },
];

export const syntheticScenarioFor = (input: string) =>
  syntheticPatientScenarios.find(
    (scenario) => scenario.input.toLowerCase() === input.trim().toLowerCase(),
  );

export const syntheticGuestReplies: Record<string, string> = {
  "are you a real doctor?":
    "No. I’m Nightingale AI, not a doctor. I help collect concerns and provide general information for Demo Women’s Clinic. A nurse or clinician becomes involved when human judgment or safety review is needed.",
  "my stomach hurts.": "Got it. When did it start?",
  "it started last week.":
    "Got it — last week. Is it getting better, worse, or staying the same?",
};

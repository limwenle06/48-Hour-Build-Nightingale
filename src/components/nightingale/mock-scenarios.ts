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
    label: "Symptoms profile",
    input: "Demo: symptoms profile",
    risk_level: "low",
    processing_status: "success",
    escalation_required: false,
    assistant_content:
      "This synthetic symptoms profile is ready to inspect. No health facts were inferred from your message.",
    profile_items: [
      {
        memory_item_id: "memory_symptoms_complaint",
        patient_id: "patient_demo",
        type: "chief_complaint",
        value: "Persistent cough",
        normalized_value: "persistent cough",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_complaint",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_symptoms_dry_cough",
        patient_id: "patient_demo",
        type: "symptom",
        value: "Dry cough",
        normalized_value: "dry cough",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_dry_cough",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_symptoms_sore_throat",
        patient_id: "patient_demo",
        type: "symptom",
        value: "Sore throat",
        normalized_value: "sore throat",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_sore_throat",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_symptoms_timeline",
        patient_id: "patient_demo",
        type: "symptom_timeline",
        value: "Started 3 days ago",
        normalized_value: "3 days",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_timeline",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_symptoms_medication",
        patient_id: "patient_demo",
        type: "medication",
        value: "Paracetamol",
        normalized_value: "paracetamol",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_medication",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_symptoms_allergy",
        patient_id: "patient_demo",
        type: "allergy",
        value: "Penicillin",
        normalized_value: "penicillin",
        status: "active",
        provenance_pointer: "message_fixture_symptoms_allergy",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
    ],
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
        memory_item_id: "memory_fixture_complaint",
        patient_id: "patient_demo",
        type: "chief_complaint",
        value: "Synthetic stomach discomfort",
        normalized_value: "synthetic stomach discomfort",
        status: "active",
        provenance_pointer: "message_fixture_profile_complaint",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_fixture_symptom",
        patient_id: "patient_demo",
        type: "symptom",
        value: "Synthetic nausea",
        normalized_value: "synthetic nausea",
        status: "active",
        provenance_pointer: "message_fixture_profile_symptom",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
      {
        memory_item_id: "memory_fixture_timeline",
        patient_id: "patient_demo",
        type: "symptom_timeline",
        value: "Started one synthetic week ago",
        normalized_value: "one synthetic week",
        status: "active",
        provenance_pointer: "message_fixture_profile_timeline",
        source_session_type: "patient",
        supersedes_memory_item_id: null,
        confidence: "high",
        created_at: at,
        updated_at: at,
      },
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
        memory_item_id: "memory_fixture_allergy",
        patient_id: "patient_demo",
        type: "allergy",
        value: "Synthetic penicillin allergy",
        normalized_value: "synthetic penicillin allergy",
        status: "active",
        provenance_pointer: "message_fixture_profile_allergy",
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

export function syntheticGuestRiskFor(input: string): RiskLevel {
  const scenario = syntheticScenarioFor(input);
  if (scenario) return scenario.risk_level;

  if (
    /\b(?:severe\s+)?chest\s+(?:pain|pressure|tightness)\b/i.test(input) ||
    /\b(?:cannot|can't|unable\s+to)\s+breathe\b/i.test(input) ||
    /\b(?:heavy|severe|uncontrolled)\s+bleeding\b/i.test(input) ||
    /\b(?:kill|hurt|harm)\s+(?:myself|me)\b/i.test(input)
  ) {
    return "high";
  }

  return "low";
}

export const syntheticGuestReplies: Record<string, string> = {
  "are you a real doctor?":
    "No. I’m Nightingale AI, not a doctor. I help collect concerns and provide general information for Demo Women’s Clinic. A nurse or clinician becomes involved when human judgment or safety review is needed.",
  "are you a real doctor":
    "No. I’m Nightingale AI, not a doctor. I help collect concerns and provide general information for Demo Women’s Clinic. A nurse or clinician becomes involved when human judgment or safety review is needed.",
  "is this a real doctor?":
    "No. I’m Nightingale AI, not a doctor. I help collect concerns and provide general information for Demo Women’s Clinic. A nurse or clinician becomes involved when human judgment or safety review is needed.",
  "is this a real doctor":
    "No. I’m Nightingale AI, not a doctor. I help collect concerns and provide general information for Demo Women’s Clinic. A nurse or clinician becomes involved when human judgment or safety review is needed.",
  "my stomach hurts.": "Got it. When did it start?",
  "my stomach hurts": "Got it. When did it start?",
  "it started last week.":
    "Got it — last week. Is it getting better, worse, or staying the same?",
  "it started last week":
    "Got it — last week. Is it getting better, worse, or staying the same?",
};

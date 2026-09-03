import type {
  IdentityLevel,
  SourceChannel,
  SourcePlatform,
} from "@/config/channel-openings";
export type { IdentityLevel, SourceChannel, SourcePlatform };
export type FunnelEventName =
  | "visitor"
  | "conversation_started"
  | "value_event"
  | "auth_started"
  | "consented"
  | "patient_created"
  | "escalation_sent";
export type RiskLevel = "low" | "medium" | "high";
export type ProcessingStatus = "success" | "blocked" | "failed";
export type MemoryType =
  "chief_complaint" | "symptom" | "symptom_timeline" | "medication" | "allergy";
export type MemoryStatus =
  "active" | "stopped" | "resolved" | "historical" | "unknown";
export interface Message {
  message_id: string;
  clinic_id: string;
  session_type: "lead" | "patient";
  session_id: string;
  sender_type: "guest" | "patient" | "ai" | "staff" | "nurse" | "clinician";
  message_kind: "text" | "system";
  content: string;
  migrated_from_message_id: string | null;
  audio_asset_id: string | null;
  transcript_id: string | null;
  transcription_status: "not_applicable" | "pending" | "completed" | "failed";
  created_at: string;
}
export interface RiskAssessment {
  risk_assessment_id: string;
  patient_id: string;
  patient_session_id: string;
  message_id: string;
  risk_level: RiskLevel;
  risk_reason: string;
  confidence: "low" | "med" | "high";
  risk_provenance: "deterministic" | "model" | "combined" | "system_fallback";
  matched_rule_ids: string[];
  escalation_required: boolean;
  created_at: string;
}
export interface MemoryItem {
  memory_item_id: string;
  patient_id: string;
  type: MemoryType;
  value: string;
  normalized_value: string;
  status: MemoryStatus;
  provenance_pointer: string;
  source_session_type: "lead" | "patient";
  supersedes_memory_item_id: string | null;
  confidence: "low" | "med" | "high";
  created_at: string;
  updated_at: string;
}
export interface Citation {
  citation_id: string;
  message_id: string;
  title: string;
  source_url: string;
  publisher: string;
  retrieved_at: string;
}
export interface GuestReply {
  guest_message: Message;
  assistant_message: Message;
  value_event: unknown | null;
  trust_transition_available: boolean;
}
export interface PatientReply {
  patient_message: Message;
  risk_assessment: RiskAssessment;
  assistant_message: Message | null;
  profile_changes: MemoryItem[];
  escalation_required: boolean;
  send_to_clinic_available: boolean;
  citations: Citation[];
  processing_status: ProcessingStatus;
}
export interface WarmLead {
  lead_session_id: string;
  source_channel: SourceChannel;
  identity_level: IdentityLevel;
  funnel_stage: FunnelEventName;
  top_concern: string | null;
  warm_lead_score: number;
  score_reasons: string[];
  last_activity_at: string;
  contact_suggestion: string | null;
}
export interface Attribution {
  clinic_id: string;
  source_channel: SourceChannel;
  source_platform: SourcePlatform;
  campaign_id: string | null;
  creative: string | null;
  identity_level: IdentityLevel;
  landing_timestamp: string;
}
export interface Escalation {
  escalation_id: string;
  clinic_id: string;
  patient_id: string;
  patient_session_id: string;
  trigger_message_id: string;
  risk_assessment_id: string;
  triage_summary: string[];
  profile_snapshot: Array<{
    memory_item_id: string;
    type: MemoryType;
    value: string;
    status: MemoryStatus;
    provenance_pointer: string;
  }>;
  provenance: string[];
  attribution: Attribution;
  risk_context: {
    risk_level: RiskLevel;
    risk_reason: string;
    confidence: "low" | "med" | "high";
    risk_provenance: RiskAssessment["risk_provenance"];
    escalation_required: boolean;
  };
  status: "pending" | "in_review" | "responded" | "closed";
  created_at: string;
  updated_at: string;
  clinician_response: {
    responder_staff_user_id: string;
    message: string;
    responded_at: string;
  } | null;
}
export interface FunnelMetric {
  source_channel: SourceChannel;
  visitors: number;
  value_events: number;
  patient_conversions: number;
  escalations: number;
}
export interface ApiSuccess<T> {
  data: T;
  request_id: string;
}

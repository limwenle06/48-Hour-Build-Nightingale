"use client";
import { z } from "zod";
import { syntheticGuestReplies, syntheticScenarioFor } from "./mock-scenarios";
import type {
  Escalation,
  GuestReply,
  MemoryItem,
  Message,
  PatientReply,
  RiskAssessment,
  SourceChannel,
  SourcePlatform,
  WarmLead,
  FunnelMetric,
} from "./frontend-types";

const MOCK = process.env.NEXT_PUBLIC_NIGHTINGALE_MOCK !== "false";
const STORAGE_KEY = "nightingale_frontend_demo";
const GUEST_VIEW_KEY = "nightingale_active_guest_view";
const envelope = z.object({ data: z.unknown(), request_id: z.string() });
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const raw = await response.json();
  if (!response.ok)
    throw new Error(
      raw?.error?.message || "Something went wrong. Please try again.",
    );
  return envelope.parse(raw).data as T;
}
const iso = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}_demo_${Math.random().toString(36).slice(2, 10)}`;
const message = (
  sender_type: Message["sender_type"],
  content: string,
  session_type: Message["session_type"],
  session_id: string,
): Message => ({
  message_id: id("msg"),
  clinic_id: "clinic_demo",
  session_type,
  session_id,
  sender_type,
  message_kind: "text",
  content,
  migrated_from_message_id: null,
  audio_asset_id: null,
  transcript_id: null,
  transcription_status: "not_applicable",
  created_at: iso(),
});

interface MockAttribution {
  source_channel: SourceChannel;
  source_platform: SourcePlatform;
  campaign_id?: string;
  creative?: string;
  social_handle?: string;
  referral_token?: string;
}
interface MockState {
  lead_session_id: string | null;
  patient_session_id: string;
  patient_id: string;
  guest_messages: Message[];
  patient_messages: Message[];
  profile: MemoryItem[];
  last_risk: RiskAssessment | null;
  attribution: MockAttribution | null;
  converted: boolean;
  handoff_behavior: "success" | "failure" | "unavailable";
  authenticated: boolean;
  emergency_latch: RiskAssessment | null;
  escalations: Escalation[];
  referral_topic: string | null;
}
const defaultState = (): MockState => ({
  lead_session_id: null,
  patient_session_id: "patient_session_demo",
  patient_id: "patient_demo",
  guest_messages: [],
  patient_messages: [],
  profile: [],
  last_risk: null,
  attribution: null,
  converted: false,
  handoff_behavior: "success",
  authenticated: false,
  emergency_latch: null,
  escalations: [],
  referral_topic: null,
});
function getState(): MockState {
  if (typeof window === "undefined") return defaultState();
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState();
  try {
    return { ...defaultState(), ...(JSON.parse(saved) as Partial<MockState>) };
  } catch {
    return defaultState();
  }
}
function setState(state: MockState) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
const scriptedFallbacks = [
  "Thanks — I’ve kept that in this demo chat. What else should the clinic know?",
  "Understood. Is there one more detail you want the clinic to see?",
  "Got it. You can continue securely whenever you’re ready.",
];

export const api = {
  async createLead(input: {
    clinic_id: string;
    source_channel: SourceChannel;
    source_platform: SourcePlatform;
    campaign_id?: string;
    creative?: string;
    social_handle?: string;
    referral_token?: string;
  }) {
    if (!MOCK)
      return request<{
        lead_session_id: string;
        identity_level: string;
        opening_strategy: string;
        recovery_expires_at: string;
      }>("/api/lead-sessions", { method: "POST", body: JSON.stringify(input) });
    const state = getState();
    state.lead_session_id ||= id("lead");
    state.attribution = {
      source_channel: input.source_channel,
      source_platform: input.source_platform,
      campaign_id: input.campaign_id,
      creative: input.creative,
      social_handle: input.social_handle,
      referral_token: input.referral_token,
    };
    setState(state);
    return {
      lead_session_id: state.lead_session_id,
      identity_level: input.social_handle ? "social_handle" : "anonymous",
      opening_strategy:
        input.source_channel === "staff_referral"
          ? "staff_referral_known_topic"
          : input.source_channel === "social_comment"
            ? "social_private_question"
            : input.source_channel === "website_widget"
              ? "neutral_clinic_help"
              : "campaign_context",
      recovery_expires_at: new Date(Date.now() + 604800000).toISOString(),
    };
  },
  async sendGuest(
    lead_session_id: string,
    content: string,
  ): Promise<GuestReply> {
    if (!MOCK)
      return request<GuestReply>("/api/guest/messages", {
        method: "POST",
        body: JSON.stringify({ lead_session_id, content }),
      });
    const state = getState();
    const guest = message("guest", content, "lead", lead_session_id);
    const guestCount = state.guest_messages.filter(
      (item) => item.sender_type === "guest",
    ).length;
    const reply = message(
      "ai",
      syntheticGuestReplies[content.trim().toLowerCase()] ||
        scriptedFallbacks[Math.min(guestCount, scriptedFallbacks.length - 1)],
      "lead",
      lead_session_id,
    );
    state.guest_messages.push(guest, reply);
    setState(state);
    return {
      guest_message: guest,
      assistant_message: reply,
      value_event: { event_name: "value_event" },
      trust_transition_available: true,
    };
  },
  async recordFunnel(
    lead_session_id: string,
    event_name: "value_event" | "auth_started",
  ) {
    if (!MOCK)
      return request("/api/funnel-events", {
        method: "POST",
        body: JSON.stringify({ lead_session_id, event_name }),
      });
    return { funnel_event_id: id("event") };
  },
  async consentAndConvert(lead_session_id: string): Promise<{
    patient: { patient_id: string };
    patient_session: { patient_session_id: string };
    source_message_ids: string[];
    attribution: unknown;
  }> {
    if (!MOCK) {
      const consent = await request<{ consent: { consent_id: string } }>(
        "/api/consents",
        {
          method: "POST",
          body: JSON.stringify({
            clinic_id: "clinic_demo",
            consent_type: "health_data_sharing",
            status: "granted",
            policy_version: "0.1.0",
          }),
        },
      );
      return request("/api/auth/convert", {
        method: "POST",
        body: JSON.stringify({
          lead_session_id,
          health_consent_id: consent.consent.consent_id,
        }),
      });
    }
    const state = getState();
    state.converted = true;
    state.authenticated = true;
    setState(state);
    window.sessionStorage.removeItem(GUEST_VIEW_KEY);
    return {
      patient: { patient_id: state.patient_id },
      patient_session: { patient_session_id: state.patient_session_id },
      source_message_ids: state.guest_messages
        .filter((item) => item.sender_type === "guest")
        .map((item) => item.message_id),
      attribution: state.attribution,
    };
  },
  getMockJourney() {
    if (!MOCK)
      return {
        guest_messages: [],
        patient_messages: [],
        attribution: null,
        authenticated: false,
        emergency_latch: null,
        referral_topic: null,
      };
    const state = getState();
    return {
      guest_messages: state.guest_messages,
      patient_messages: state.patient_messages,
      attribution: state.attribution,
      authenticated: state.authenticated,
      emergency_latch: state.emergency_latch,
      referral_topic: state.referral_topic,
    };
  },
  openMockGuestView() {
    if (!MOCK || typeof window === "undefined") return [] as Message[];
    const state = getState();
    const saved = window.sessionStorage.getItem(GUEST_VIEW_KEY);
    if (saved) {
      try {
        const view = JSON.parse(saved) as {
          lead_session_id: string | null;
          offset: number;
        };
        if (view.lead_session_id === state.lead_session_id)
          return state.guest_messages.slice(view.offset);
      } catch {
        window.sessionStorage.removeItem(GUEST_VIEW_KEY);
      }
    }
    const offset =
      state.authenticated || state.converted ? state.guest_messages.length : 0;
    window.sessionStorage.setItem(
      GUEST_VIEW_KEY,
      JSON.stringify({ lead_session_id: state.lead_session_id, offset }),
    );
    return state.guest_messages.slice(offset);
  },
  async sendPatient(
    patient_session_id: string,
    content: string,
  ): Promise<PatientReply> {
    if (!MOCK)
      return request<PatientReply>("/api/patient/messages", {
        method: "POST",
        body: JSON.stringify({ patient_session_id, content }),
      });
    const state = getState();
    const scenario = syntheticScenarioFor(content);
    const patient = message("patient", content, "patient", patient_session_id);
    const riskLevel = scenario?.risk_level || "low";
    const assistantContent =
      scenario?.assistant_content ??
      (scenario
        ? null
        : scriptedFallbacks[
            Math.min(
              state.patient_messages.length,
              scriptedFallbacks.length - 1,
            )
          ]);
    const assistant = assistantContent
      ? message("ai", assistantContent, "patient", patient_session_id)
      : null;
    const risk: RiskAssessment = {
      risk_assessment_id: id("risk"),
      patient_id: state.patient_id,
      patient_session_id,
      message_id: patient.message_id,
      risk_level: riskLevel,
      risk_reason: `Synthetic frontend fixture: ${scenario?.label || "normal"}`,
      confidence: scenario?.processing_status === "failed" ? "low" : "high",
      risk_provenance:
        scenario?.processing_status === "failed"
          ? "system_fallback"
          : "deterministic",
      matched_rule_ids: [],
      escalation_required: scenario?.escalation_required || false,
      created_at: iso(),
    };
    const changes = scenario?.profile_items || [];
    state.handoff_behavior = scenario?.handoff_behavior || "success";
    if (changes.length) state.profile = changes;
    state.patient_messages.push(patient, ...(assistant ? [assistant] : []));
    state.last_risk = risk;
    if (risk.risk_level === "high") state.emergency_latch = risk;
    setState(state);
    return {
      patient_message: patient,
      risk_assessment: risk,
      assistant_message: assistant,
      profile_changes: changes,
      escalation_required: risk.escalation_required,
      send_to_clinic_available:
        risk.escalation_required &&
        scenario?.handoff_behavior !== "unavailable",
      citations: scenario?.citations || [],
      processing_status: scenario?.processing_status || "success",
    };
  },
  async getProfile(): Promise<{ patient_id: string; items: MemoryItem[] }> {
    if (!MOCK) return request("/api/patient/profile");
    const state = getState();
    return { patient_id: state.patient_id, items: state.profile };
  },
  async createEscalation(
    patient_session_id: string,
    trigger_message_id: string,
    risk_assessment_id: string,
  ) {
    if (!MOCK)
      return request<{
        escalation: Escalation;
        expected_response_window: "12-18 hours";
      }>("/api/escalations", {
        method: "POST",
        body: JSON.stringify({
          patient_session_id,
          trigger_message_id,
          risk_assessment_id,
        }),
      });
    const current = getState();
    if (current.handoff_behavior === "failure")
      throw new Error("Demo handoff was not recorded. Please try again.");
    const risk =
      current.emergency_latch?.message_id === trigger_message_id
        ? current.emergency_latch
        : current.last_risk;
    const trigger = [
      ...current.patient_messages,
      ...current.guest_messages,
    ].find((item) => item.message_id === trigger_message_id);
    const escalation: Escalation = {
      escalation_id: id("escalation"),
      clinic_id: "clinic_demo",
      patient_id: "patient_demo",
      patient_session_id,
      trigger_message_id,
      risk_assessment_id,
      triage_summary: [
        trigger?.content || "Synthetic concern submitted for review",
      ],
      profile_snapshot: current.profile.map(
        ({ memory_item_id, type, value, status, provenance_pointer }) => ({
          memory_item_id,
          type,
          value,
          status,
          provenance_pointer,
        }),
      ),
      provenance: [trigger_message_id],
      attribution: {
        clinic_id: "clinic_demo",
        source_channel: current.attribution?.source_channel || "website_widget",
        source_platform: current.attribution?.source_platform || "website",
        campaign_id: current.attribution?.campaign_id || null,
        creative: current.attribution?.creative || null,
        identity_level: "verified",
        landing_timestamp: iso(),
      },
      risk_context: {
        risk_level: risk?.risk_level || "medium",
        risk_reason: risk?.risk_reason || "Review requested",
        confidence: risk?.confidence || "low",
        risk_provenance: risk?.risk_provenance || "system_fallback",
        escalation_required: true,
      },
      status: "pending",
      created_at: iso(),
      updated_at: iso(),
      clinician_response: null,
    };
    current.escalations = [
      escalation,
      ...current.escalations.filter(
        (item) => item.trigger_message_id !== trigger_message_id,
      ),
    ];
    setState(current);
    return {
      escalation,
      expected_response_window: "12-18 hours" as const,
    };
  },
  async getWarmLeads(): Promise<WarmLead[]> {
    if (!MOCK)
      return (await request<{ leads: WarmLead[] }>("/api/staff/leads")).leads;
    return [
      {
        lead_session_id: "lead_synthetic_1",
        source_channel: "staff_referral",
        identity_level: "contact_provided",
        funnel_stage: "value_event",
        top_concern: "Asked about egg freezing options",
        warm_lead_score: 72,
        score_reasons: [
          "Recent activity",
          "Staff referral",
          "Contact provided",
        ],
        last_activity_at: iso(),
        contact_suggestion: "Follow up using consented contact details",
      },
    ];
  },
  async getEscalations(): Promise<Escalation[]> {
    if (!MOCK)
      return (
        await request<{ escalations: Escalation[] }>("/api/staff/escalations")
      ).escalations;
    return getState().escalations;
  },
  async createReferral(topic: string) {
    if (!MOCK)
      return request<{ staff_referral: unknown; referral_url: string }>(
        "/api/staff/referrals",
        {
          method: "POST",
          body: JSON.stringify({ topic, expires_in_hours: 72 }),
        },
      );
    const state = getState();
    state.referral_topic = topic;
    setState(state);
    return {
      staff_referral: {
        staff_referral_id: id("referral"),
        topic,
        status: "active",
      },
      referral_url: `${window.location.origin}/start?source_channel=staff_referral&source_platform=clinic&referral_token=synthetic-demo-token`,
    };
  },
  getFunnelMetrics(): FunnelMetric[] {
    if (!MOCK) return [];
    return [
      {
        source_channel: "staff_referral",
        visitors: 18,
        value_events: 14,
        patient_conversions: 8,
        escalations: 2,
      },
      {
        source_channel: "social_comment",
        visitors: 31,
        value_events: 22,
        patient_conversions: 9,
        escalations: 3,
      },
      {
        source_channel: "instagram_ad_click",
        visitors: 45,
        value_events: 30,
        patient_conversions: 12,
        escalations: 2,
      },
      {
        source_channel: "website_widget",
        visitors: 24,
        value_events: 19,
        patient_conversions: 10,
        escalations: 1,
      },
    ];
  },
  endDemoSession() {
    if (!MOCK) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(GUEST_VIEW_KEY);
    window.dispatchEvent(new Event("nightingale-demo-reset"));
  },
  resetDemoData() {
    if (!MOCK) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(GUEST_VIEW_KEY);
    window.dispatchEvent(new Event("nightingale-demo-reset"));
  },
  clearEmergencyLatch() {
    if (!MOCK) return;
    const state = getState();
    state.emergency_latch = null;
    setState(state);
  },
  mockMode: MOCK,
};

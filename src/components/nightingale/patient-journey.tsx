"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "./api-client";
import { syntheticPatientScenarios } from "./mock-scenarios";
import type {
  Citation,
  MemoryItem,
  Message,
  ProcessingStatus,
  RiskAssessment,
} from "./frontend-types";
import {
  ChatThread,
  Citations,
  EmergencyWarning,
  InlineError,
  JourneySteps,
  LivingProfile,
  ProcessingFallback,
  SafetyAction,
} from "./ui";

type HandoffState = "idle" | "sending" | "success" | "failed";

export function PatientJourney() {
  const params = useSearchParams();
  const patientSessionId =
    params.get("patient_session_id") || "patient_session_demo";
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<MemoryItem[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [processing, setProcessing] = useState<ProcessingStatus>("success");
  const [handoffAvailable, setHandoffAvailable] = useState(false);
  const [handoff, setHandoff] = useState<HandoffState>("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (api.mockMode) {
      const recovered = api.getMockJourney();
      setMessages([...recovered.guest_messages, ...recovered.patient_messages]);
      setSource(recovered.attribution?.source_channel || null);
    }
    api
      .getProfile()
      .then((result) => setProfile(result.items))
      .catch((cause) => setError(cause.message));
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    const content = text.trim();
    setText("");
    setBusy(true);
    setHandoff("idle");
    setError(null);
    try {
      const result = await api.sendPatient(patientSessionId, content);
      setMessages((current) => [
        ...current,
        result.patient_message,
        ...(result.assistant_message ? [result.assistant_message] : []),
      ]);
      setRisk(result.risk_assessment);
      setProcessing(result.processing_status);
      setHandoffAvailable(result.send_to_clinic_available);
      setCitations(result.citations);
      if (result.profile_changes.length)
        setProfile((await api.getProfile()).items);
    } catch (cause) {
      setText(content);
      setError(
        cause instanceof Error
          ? cause.message
          : "Your message wasn’t sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (!risk || !handoffAvailable) return;
    setHandoff("sending");
    setError(null);
    try {
      await api.createEscalation(
        patientSessionId,
        risk.message_id,
        risk.risk_assessment_id,
      );
      setHandoff("success");
    } catch (cause) {
      setHandoff("failed");
      setError(
        cause instanceof Error
          ? cause.message
          : "Not sent yet. Please try again.",
      );
    }
  }

  return (
    <>
      <JourneySteps active="secure" />
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(270px,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line px-5 py-4">
            <span className="block text-xs text-slate-500">
              Private · clinic sharing allowed
              {source ? ` · from ${source.replaceAll("_", " ")}` : ""}
            </span>
            <strong>Nightingale AI</strong>
          </div>
          {api.mockMode && (
            <details className="border-b border-line bg-sky-50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold">
                Synthetic UI scenarios
              </summary>
              <p className="my-2 text-xs text-slate-600">
                Demo fixtures only. They do not classify risk or extract health
                facts.
              </p>
              <div className="flex flex-wrap gap-2">
                {syntheticPatientScenarios.map((scenario) => (
                  <button
                    type="button"
                    key={scenario.label}
                    onClick={() => setText(scenario.input)}
                    className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-semibold"
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
            </details>
          )}
          <ChatThread
            messages={messages}
            empty={
              <div className="mb-3 max-w-[88%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 text-sm">
                <strong className="mb-1 block text-xs text-teal">
                  Nightingale AI
                </strong>
                You’re in your secure chat. What would you like the clinic to
                understand?
              </div>
            }
          />
          {processing === "failed" && <ProcessingFallback />}
          {risk && risk.risk_level !== "low" && (
            <SafetyAction
              risk={risk.risk_level}
              onSend={escalate}
              loading={handoff === "sending"}
              available={handoffAvailable}
            />
          )}
          {handoff === "success" && (
            <div
              role="status"
              className="m-3 rounded-xl bg-mint p-4 font-semibold"
            >
              {api.mockMode
                ? "Demo clinic alert recorded. No real delivery occurred."
                : "Sent to Nurse/Clinic."}
              {risk?.risk_level === "high" &&
                " Do not wait for a clinic reply — call 999 now."}
            </div>
          )}
          {handoff === "failed" && (
            <div
              role="status"
              className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
            >
              Not sent yet. You can try again.
            </div>
          )}
          <Citations items={citations} />
          <InlineError message={error} />
          <form onSubmit={send} className="flex gap-2 p-3">
            <label className="sr-only" htmlFor="patient-message">
              Your message
            </label>
            <input
              id="patient-message"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="focus-ring min-w-0 flex-1 rounded-xl border border-line px-4 py-3"
              placeholder="What’s on your mind?"
            />
            <button
              disabled={busy}
              className="focus-ring rounded-xl bg-teal px-5 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
          <EmergencyWarning />
        </div>
        <LivingProfile items={profile} />
      </section>
    </>
  );
}

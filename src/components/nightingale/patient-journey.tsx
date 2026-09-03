"use client";
import Link from "next/link";
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
  const params = useSearchParams(),
    patientSessionId =
      params.get("patient_session_id") || "patient_session_demo";
  const [messages, setMessages] = useState<Message[]>([]),
    [profile, setProfile] = useState<MemoryItem[]>([]),
    [citations, setCitations] = useState<Citation[]>([]),
    [risk, setRisk] = useState<RiskAssessment | null>(null),
    [latchedRisk, setLatchedRisk] = useState<RiskAssessment | null>(null),
    [processing, setProcessing] = useState<ProcessingStatus>("success"),
    [handoffAvailable, setHandoffAvailable] = useState(false),
    [handoff, setHandoff] = useState<HandoffState>("idle"),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [dismissOpen, setDismissOpen] = useState(false),
    [dismissedRiskId, setDismissedRiskId] = useState<string | null>(null),
    [authenticated, setAuthenticated] = useState(!api.mockMode);

  useEffect(() => {
    if (api.mockMode) {
      const recovered = api.getMockJourney();
      setMessages([...recovered.guest_messages, ...recovered.patient_messages]);
      setAuthenticated(recovered.authenticated);
      setLatchedRisk(recovered.emergency_latch);
      setHandoffAvailable(Boolean(recovered.emergency_latch));
    }
    api
      .getProfile()
      .then((result) => setProfile(result.items))
      .catch((cause) => setError(cause.message));
  }, []);
  useEffect(() => {
    const reset = () => {
      setMessages([]);
      setProfile([]);
      setRisk(null);
      setLatchedRisk(null);
      setAuthenticated(false);
    };
    window.addEventListener("nightingale-demo-reset", reset);
    return () => window.removeEventListener("nightingale-demo-reset", reset);
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    const content = text.trim();
    setText("");
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendPatient(patientSessionId, content);
      setMessages((current) => [
        ...current,
        result.patient_message,
        ...(result.assistant_message ? [result.assistant_message] : []),
      ]);
      setRisk(result.risk_assessment);
      if (result.risk_assessment.risk_level === "high") {
        setDismissedRiskId(null);
        setLatchedRisk(result.risk_assessment);
        setHandoffAvailable(result.send_to_clinic_available);
      } else if (!latchedRisk)
        setHandoffAvailable(result.send_to_clinic_available);
      setProcessing(result.processing_status);
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
    const trigger = latchedRisk || risk;
    if (!trigger || !handoffAvailable) return;
    setHandoff("sending");
    setError(null);
    try {
      await api.createEscalation(
        patientSessionId,
        trigger.message_id,
        trigger.risk_assessment_id,
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
  function dismissEmergency() {
    if (handoff === "success") {
      setDismissedRiskId((latchedRisk || risk)?.risk_assessment_id || null);
      setLatchedRisk(null);
      api.clearEmergencyLatch();
    } else setDismissOpen(true);
  }
  function confirmDismiss() {
    setDismissOpen(false);
    setDismissedRiskId((latchedRisk || risk)?.risk_assessment_id || null);
    setLatchedRisk(null);
    api.clearEmergencyLatch();
  }

  if (api.mockMode && !authenticated)
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-line bg-white p-8 text-center shadow-soft">
        <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
          Demo session ended
        </p>
        <h1 className="mt-2 text-3xl font-bold">Your chat is closed.</h1>
        <p className="mt-3 text-slate-600">
          Start again when you’re ready. Old demo messages will not appear.
        </p>
        <Link
          href="/start?source_channel=website_widget&source_platform=website"
          className="mt-6 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white"
        >
          Ask a question
        </Link>
      </section>
    );
  const currentRisk = latchedRisk || risk;
  const displayRisk =
    currentRisk?.risk_level === "high" &&
    currentRisk.risk_assessment_id === dismissedRiskId
      ? null
      : currentRisk;
  return (
    <>
      <JourneySteps active="secure" />
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(270px,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line px-5 py-4">
            <span className="block text-xs text-slate-500">
              Private chat · shared with your chosen clinic
            </span>
            <strong>Nightingale AI</strong>
          </div>
          {api.mockMode && (
            <details className="border-b border-line bg-sky-50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold">
                Developer demo tools
              </summary>
              <p className="my-2 text-xs text-slate-600">
                Exact synthetic fixtures display contracted states. They do not
                classify risk or extract health facts.
              </p>
              <div className="flex flex-wrap gap-2">
                {syntheticPatientScenarios.map((s) => (
                  <button
                    type="button"
                    key={s.label}
                    onClick={() => setText(s.input)}
                    className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-semibold"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => api.resetDemoData()}
                className="mt-3 text-xs font-bold text-red-700 underline"
              >
                Reset demo data
              </button>
            </details>
          )}
          <ChatThread
            messages={messages}
            empty={
              <div className="mb-3 max-w-[88%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 text-sm">
                <strong className="mb-1 block text-xs text-teal">
                  Nightingale AI
                </strong>
                You can use short words or full sentences. What should the
                clinic understand?
              </div>
            }
          />
          {processing === "failed" && <ProcessingFallback />}
          {displayRisk && displayRisk.risk_level !== "low" && (
            <SafetyAction
              risk={displayRisk.risk_level}
              onSend={handoff === "success" ? undefined : escalate}
              loading={handoff === "sending"}
              available={handoffAvailable}
              onDismiss={
                displayRisk.risk_level === "high" ? dismissEmergency : undefined
              }
            />
          )}
          {handoff === "success" && (
            <div
              role="status"
              className={`m-3 rounded-xl border p-4 font-semibold ${displayRisk?.risk_level === "high" ? "border-red-400 bg-red-50 text-red-900" : "border-amber-400 bg-amber-50 text-amber-950"}`}
            >
              {api.mockMode
                ? "Demo clinic alert recorded. No real delivery occurred."
                : "Sent to Nurse/Clinic."}
              {displayRisk?.risk_level === "high" &&
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
              onChange={(e) => setText(e.target.value)}
              className="focus-ring min-w-0 flex-1 rounded-xl border border-line px-4 py-3"
              placeholder="A few words is enough"
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
      {dismissOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dismiss-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 id="dismiss-title" className="text-xl font-bold">
              Close this emergency warning?
            </h2>
            <p className="mt-2 text-slate-600">
              We still recommend getting urgent help now.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                onClick={() => setDismissOpen(false)}
                className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white"
              >
                Keep warning
              </button>
              <button
                onClick={confirmDismiss}
                className="rounded-xl border border-line px-4 py-3 font-semibold"
              >
                Close warning
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

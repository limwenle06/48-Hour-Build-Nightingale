"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "./api-client";
import type { Message, RiskLevel } from "./frontend-types";
import {
  canonicalSourceChannel,
  canonicalSourcePlatform,
  openingCopy,
} from "@/config/channel-openings";
import { guestStarterPrompts } from "@/config/starter-prompts";
import {
  ChatThread,
  EmergencyWarning,
  InlineError,
  JourneySteps,
  SafetyAction,
} from "./ui";

export function GuestJourney() {
  const params = useSearchParams(),
    router = useRouter();
  const source_channel = canonicalSourceChannel(params.get("source_channel")),
    source_platform = canonicalSourcePlatform(params.get("source_platform"));
  const [leadId, setLeadId] = useState<string | null>(null),
    [opening, setOpening] = useState(
      "You can ask a general question first — no account needed.",
    ),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [consentOpen, setConsentOpen] = useState(false),
    [guestRisk, setGuestRisk] = useState<RiskLevel | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const clinic = "Demo Women’s Clinic";
  const acquisition = useMemo(
    () => ({
      clinic_id: api.clinicId,
      source_channel,
      source_platform,
      campaign_id: params.get("campaign_id") || undefined,
      creative: params.get("creative") || undefined,
      social_handle: params.get("social_handle") || undefined,
      referral_token: params.get("referral_token") || undefined,
    }),
    [params, source_channel, source_platform],
  );
  useEffect(() => {
    let live = true;
    api
      .createLead(acquisition)
      .then((result) => {
        if (live) {
          setLeadId(result.lead_session_id);
          if (api.mockMode) {
            const recovered = api.openMockGuestView();
            setMessages(recovered);
            const latestGuest = [...recovered]
              .reverse()
              .find((message) => message.sender_type === "guest");
            setGuestRisk(
              latestGuest ? result.active_guest_risk_level : null,
            );
            setReady(
              recovered.some((message) => message.sender_type === "guest"),
            );
          } else {
            setMessages(result.recovered_messages);
            setGuestRisk(result.active_guest_risk_level);
            setReady(
              result.recovered_messages.some(
                (message) => message.sender_type === "guest",
              ),
            );
          }
          const base =
            openingCopy[result.opening_strategy] ||
            openingCopy.neutral_clinic_help;
          const topic =
            api.mockMode && source_channel === "staff_referral"
              ? api.getMockJourney().referral_topic
              : null;
          setOpening(topic ? `${base} Your care team noted: “${topic}”` : base);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, [acquisition]);
  async function sendContent(content: string) {
    if (!leadId || !content.trim() || busy) return;
    content = content.trim();
    setText("");
    setBusy(true);
    setError(null);
    try {
      const reply = await api.sendGuest(leadId, content);
      setMessages((m) => [...m, reply.guest_message, reply.assistant_message]);
      setGuestRisk((active) =>
        active === "high" || reply.risk_level === "high"
          ? "high"
          : active === "medium" || reply.risk_level === "medium"
            ? "medium"
            : "low",
      );
      setReady(reply.trust_transition_available);
    } catch (e) {
      setText(content);
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    await sendContent(text);
  }
  async function begin() {
    if (!leadId) return;
    await api.recordFunnel(leadId, "auth_started");
    setConsentOpen(true);
  }
  async function convert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!leadId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      const authentication = await api.authenticatePatient({
        action: authMode === "signup" ? "sign_up" : "sign_in",
        clinic_id: api.clinicId,
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        phone: String(form.get("phone") || "").trim() || null,
      });

      if (authentication.verification_required) {
        setNotice(
          "Check your email to verify your account, then choose Log in to continue.",
        );
        return;
      }

      const result = await api.consentAndConvert(leadId);
      router.push(
        `/patient?patient_session_id=${encodeURIComponent(result.patient_session.patient_session_id)}`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t continue. Your chat is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <JourneySteps active="ask" />
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line px-5 py-4">
            <span className="block text-xs text-slate-500">
              Private until you choose to share
            </span>
            <strong>Ask Nightingale</strong>
          </div>
          <ChatThread
            messages={messages}
            empty={
              <div className="mb-3 max-w-[88%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 text-sm md:max-w-[76%]">
                <strong className="mb-1 block text-xs text-teal">
                  Nightingale AI
                </strong>
                {opening}
                <small className="mt-2 block text-slate-500">
                  General information only — not a diagnosis.
                </small>
              </div>
            }
          />
          {guestRisk && guestRisk !== "low" && (
            <SafetyAction risk={guestRisk} />
          )}
          {!messages.length && (
            <div className="border-t border-line bg-white px-4 py-4">
              <p className="mb-3 font-bold">What’s bothering you?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {guestStarterPrompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => sendContent(prompt)}
                    disabled={!leadId || busy}
                    className="focus-ring rounded-xl border border-line bg-slate-50 px-3 py-2 text-left text-sm hover:border-teal disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Short phrases are okay. There’s no wrong way to start.
              </p>
            </div>
          )}
          <InlineError message={error} />
          <form onSubmit={send} className="flex gap-2 p-3">
            <label className="sr-only" htmlFor="guest-message">
              Your question
            </label>
            <input
              id="guest-message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="focus-ring min-w-0 flex-1 rounded-xl border border-line px-4 py-3"
              placeholder="What’s on your mind?"
            />
            <button
              disabled={busy || !leadId}
              className="focus-ring rounded-xl bg-teal px-5 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
          <EmergencyWarning />
        </div>
        <aside className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
            You’re in control
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            {ready ? "Continue without repeating yourself." : "Ask first."}
          </h2>
          <p className="mt-2 text-slate-600">
            {ready
              ? `Share this chat with ${clinic} when you’re ready.`
              : "No account needed."}
          </p>
          {ready && (
            <button
              onClick={begin}
              className="focus-ring mt-5 w-full rounded-xl bg-teal px-4 py-3 font-bold text-white"
            >
              Continue securely
            </button>
          )}
          <div className="mt-5 rounded-xl bg-mint p-3 text-sm">
            The clinic cannot see this chat yet.
          </div>
        </aside>
      </section>
      {consentOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"
        >
          <form
            onSubmit={convert}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setConsentOpen(false)}
              className="float-right text-2xl"
            >
              ×
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-teal">
              {authMode === "signup"
                ? "Create your secure space"
                : "Welcome back"}
            </p>
            <h2 id="consent-title" className="mt-2 text-2xl font-bold">
              {authMode === "signup"
                ? "Keep going without repeating yourself."
                : "Sign in to continue."}
            </h2>
            <p className="mt-2 text-slate-600">
              Only you decide what the clinic sees.
            </p>
            <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${authMode === "signup" ? "bg-white shadow" : ""}`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${authMode === "login" ? "bg-white shadow" : ""}`}
              >
                Log in
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="text-sm font-semibold">
                Verified email
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  defaultValue={api.mockMode ? "patient@example.test" : ""}
                  className="focus-ring mt-1 block w-full rounded-xl border border-line px-3 py-2 font-normal"
                />
              </label>
              {authMode === "signup" && (
                <label className="text-sm font-semibold">
                  Phone
                  <input
                    required
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    defaultValue={api.mockMode ? "+60112223333" : ""}
                    className="focus-ring mt-1 block w-full rounded-xl border border-line px-3 py-2 font-normal"
                  />
                </label>
              )}
              <label className="text-sm font-semibold">
                Password
                <input
                  required
                  type="password"
                  name="password"
                  minLength={8}
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
                  defaultValue={api.mockMode ? "synthetic-demo" : ""}
                  className="focus-ring mt-1 block w-full rounded-xl border border-line px-3 py-2 font-normal"
                />
              </label>
            </div>
            <label className="mt-4 flex gap-3 rounded-xl border border-line p-4">
              <input required type="checkbox" />
              <span>
                Share this conversation with <strong>{clinic}</strong>.
              </span>
            </label>
            <button
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-teal px-4 py-3 font-bold text-white"
            >
              {busy ? "Continuing…" : "Continue"}
            </button>
            {notice && (
              <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-slate-700">
                {notice}
              </p>
            )}
            {api.mockMode && (
              <p className="mt-3 text-xs text-slate-500">
                Developer demo: verification and consent are simulated.
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}

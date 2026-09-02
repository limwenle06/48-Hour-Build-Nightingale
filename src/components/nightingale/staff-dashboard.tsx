"use client";
import { FormEvent, useEffect, useState } from "react";
import { api } from "./api-client";
import type { Escalation, WarmLead } from "./frontend-types";
import { InlineError } from "./ui";

export function StaffDashboard() {
  const [leads, setLeads] = useState<WarmLead[]>([]),
    [escalations, setEscalations] = useState<Escalation[]>([]),
    [topic, setTopic] = useState("asked about egg freezing at today’s visit"),
    [url, setUrl] = useState(""),
    [error, setError] = useState<string | null>(null),
    [clinicalError, setClinicalError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getWarmLeads()
      .then(setLeads)
      .catch((e) => setError(e.message));
    api.getEscalations()
      .then(setEscalations)
      .catch(() =>
        setClinicalError(
          "Clinical queue access requires a nurse or clinician account.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  async function refer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.createReferral(topic);
      setUrl(r.referral_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link.");
    }
  }
  return (
    <>
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
            Demo Women’s Clinic
          </p>
          <h1 className="display mt-2 text-5xl font-semibold">
            Care coordination
          </h1>
          <p className="mt-2 text-slate-600">
            Consented context only.{" "}
            {api.mockMode
              ? "Synthetic mock data."
              : "Connected to clinic APIs."}
          </p>
        </div>
        <a
          href="#referral"
          className="focus-ring self-start rounded-xl bg-teal px-4 py-3 font-bold text-white"
        >
          + Create warm handoff
        </a>
      </header>
      <InlineError message={error} />
      <nav className="my-7 flex gap-5 font-semibold text-teal">
        <a href="#queue">Escalations</a>
        <a href="#leads">Warm leads</a>
        <a href="#referral">Referral</a>
      </nav>
      <section
        id="queue"
        className="mb-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <h2 className="text-xl font-bold">Clinical review queue</h2>
        {clinicalError && (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">
            {clinicalError}
          </p>
        )}
        {loading ? (
          <p className="mt-4 text-slate-500">Loading…</p>
        ) : escalations.length ? (
          escalations.map((e) => (
            <article
              className="mt-4 flex flex-col gap-3 border-t border-line pt-4 md:flex-row"
              key={e.escalation_id}
            >
              <RiskTag level={e.risk_context.risk_level} />
              <div>
                <strong>{e.risk_context.risk_reason}</strong>
                <p className="mt-1 text-sm text-slate-600">
                  Status: {e.status.replaceAll("_", " ")}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-teal">
                    Inspect persisted payload
                  </summary>
                  <pre className="mt-2 max-w-3xl overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                    {JSON.stringify(
                      {
                        triage_summary: e.triage_summary,
                        profile_snapshot: e.profile_snapshot,
                        provenance: e.provenance,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            </article>
          ))
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-500">
            No escalations yet.
          </p>
        )}
      </section>
      <section
        id="leads"
        className="mb-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <h2 className="text-xl font-bold">Warm leads</h2>
        <p className="mt-1 text-sm text-slate-500">
          Scores use only recency, channel, identity, and funnel stage. Clinical
          risk never increases a sales score.
        </p>
        {leads.map((lead) => (
          <article
            className="mt-4 grid grid-cols-[3rem_1fr] gap-4 border-t border-line pt-4"
            key={lead.lead_session_id}
          >
            <strong className="text-2xl text-teal">
              {lead.warm_lead_score}
            </strong>
            <div>
              <strong>{lead.source_channel.replaceAll("_", " ")}</strong>
              <p className="text-sm">
                {lead.top_concern || "No concern shown"}
              </p>
              <p className="text-xs text-slate-500">
                {lead.score_reasons.join(" · ")}
              </p>
            </div>
          </article>
        ))}
      </section>
      <section
        id="referral"
        className="rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-teal">
          Staff referral
        </p>
        <h2 className="mt-1 text-xl font-bold">
          Continue without making them repeat it
        </h2>
        <form onSubmit={refer} className="mt-4">
          <label htmlFor="topic" className="font-semibold">
            Referral topic
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="focus-ring mt-2 min-h-24 w-full rounded-xl border border-line p-3"
          />
          <button className="mt-3 rounded-xl bg-teal px-4 py-3 font-bold text-white">
            Create personal link
          </button>
        </form>
        {url && (
          <div className="mt-4 rounded-xl bg-mint p-4">
            <strong>New link</strong>
            <a
              className="mt-1 block break-all text-sm text-teal underline"
              href={url}
            >
              {url}
            </a>
            <small className="mt-2 block text-slate-500">
              The URL contains an opaque synthetic token, not the topic.
            </small>
          </div>
        )}
      </section>
    </>
  );
}
function RiskTag({ level }: { level: "low" | "medium" | "high" }) {
  return (
    <span
      className={`self-start whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-black tracking-wider ${level === "high" ? "border-red-300 bg-red-50 text-red-800" : level === "medium" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-line bg-mint text-ink"}`}
    >
      {level === "high"
        ? "URGENT · HIGH RISK"
        : level === "medium"
          ? "NEEDS REVIEW · MEDIUM RISK"
          : "LOW RISK"}
    </span>
  );
}

"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "./api-client";
import type { Escalation, FunnelMetric, WarmLead } from "./frontend-types";
import { InlineError } from "./ui";

export function StaffDashboard() {
  const [leads, setLeads] = useState<WarmLead[]>([]),
    [escalations, setEscalations] = useState<Escalation[]>([]),
    [metrics, setMetrics] = useState<FunnelMetric[]>([]),
    [topic, setTopic] = useState("asked about egg freezing at today’s visit"),
    [url, setUrl] = useState(""),
    [error, setError] = useState<string | null>(null),
    [clinicalError, setClinicalError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .getWarmLeads()
      .then(setLeads)
      .catch((e) => setError(e.message));
    api
      .getEscalations()
      .then(setEscalations)
      .catch(() =>
        setClinicalError(
          "Clinical queue access requires a nurse or clinician account.",
        ),
      )
      .finally(() => setLoading(false));
    setMetrics(api.getFunnelMetrics());
  }, []);
  async function refer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setUrl((await api.createReferral(topic)).referral_url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the link.",
      );
    }
  }
  return (
    <>
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
            Demo Women’s Clinic
          </p>
          <h1 className="display mt-2 text-4xl font-semibold md:text-5xl">
            Today’s care queue
          </h1>
          <p className="mt-2 text-slate-600">
            Attention required. Open a case.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="#referral"
            className="rounded-xl bg-teal px-4 py-3 font-bold text-white"
          >
            Create referral
          </a>
          <Link
            href="/staff/sign-in"
            className="rounded-xl border border-line px-4 py-3 font-semibold"
          >
            Sign out
          </Link>
        </div>
      </header>
      <InlineError message={error} />
      <section
        aria-label="Clinic summary"
        className="my-7 grid gap-3 sm:grid-cols-3"
      >
        <Summary
          value={escalations.length}
          label="Need clinical review"
          tone="amber"
        />
        <Summary
          value={
            escalations.filter((e) => e.risk_context.risk_level === "high")
              .length
          }
          label="Urgent cases"
          tone="red"
        />
        <Summary value={leads.length} label="Warm leads" tone="teal" />
      </section>
      <section
        id="queue"
        className="mb-5 rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6"
      >
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Clinical review queue</h2>
            <p className="text-sm text-slate-500">
              Nurse or clinician access only.
            </p>
          </div>
          {api.mockMode && (
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold">
              Synthetic demo
            </span>
          )}
        </div>
        {clinicalError && (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">
            {clinicalError}
          </p>
        )}
        {loading ? (
          <p className="mt-4 text-slate-500">Loading…</p>
        ) : escalations.length ? (
          <div className="mt-4 grid gap-3">
            {escalations.map((e) => (
              <CaseCard key={e.escalation_id} escalation={e} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-500">
            No cases need review.
          </p>
        )}
      </section>
      <section
        id="leads"
        className="mb-5 rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6"
      >
        <h2 className="text-xl font-bold">Warm leads</h2>
        <p className="mt-1 text-sm text-slate-500">
          Non-clinical score: recency, channel, identity and funnel stage only.
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
              <strong>{lead.top_concern || "No concern shown"}</strong>
              <p className="text-sm capitalize">
                {lead.source_channel.replaceAll("_", " ")} ·{" "}
                {lead.funnel_stage.replaceAll("_", " ")}
              </p>
              <p className="text-xs text-slate-500">
                {lead.score_reasons.join(" · ")}
              </p>
              {lead.contact_suggestion && (
                <p className="mt-2 text-sm font-semibold">
                  Next: {lead.contact_suggestion}
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
      <FunnelChart metrics={metrics} synthetic={api.mockMode} />
      <section
        id="referral"
        className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-teal">
          Staff referral
        </p>
        <h2 className="mt-1 text-xl font-bold">
          Let the patient continue without repeating it
        </h2>
        <form onSubmit={refer} className="mt-4">
          <label htmlFor="topic" className="font-semibold">
            What did they ask about?
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="focus-ring mt-2 min-h-24 w-full rounded-xl border border-line p-3"
          />
          <button className="mt-3 rounded-xl bg-teal px-4 py-3 font-bold text-white">
            Generate link
          </button>
        </form>
        {url && (
          <div className="mt-4 rounded-xl bg-mint p-4">
            <strong>Referral link ready</strong>
            <a
              className="mt-1 block break-all text-sm text-teal underline"
              href={url}
            >
              {url}
            </a>
            <small className="mt-2 block text-slate-500">
              Synthetic link. The URL contains an opaque demo token, not the
              topic.
            </small>
          </div>
        )}
      </section>
    </>
  );
}

function Summary({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "red" | "amber" | "teal";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${tone === "red" ? "border-red-200 bg-red-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-line bg-white"}`}
    >
      <strong className="text-3xl">{value}</strong>
      <span className="ml-2 text-sm font-semibold">{label}</span>
    </div>
  );
}
function RiskTag({ level }: { level: "low" | "medium" | "high" }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-1 text-[11px] font-black tracking-wider ${level === "high" ? "border-red-300 bg-red-50 text-red-800" : level === "medium" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-line bg-mint"}`}
    >
      {level === "high"
        ? "URGENT · HIGH RISK"
        : level === "medium"
          ? "NEEDS REVIEW · MEDIUM"
          : "LOW RISK"}
    </span>
  );
}
export function CaseCard({ escalation: e }: { escalation: Escalation }) {
  return (
    <article className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <RiskTag level={e.risk_context.risk_level} />
          <h3 className="mt-2 font-bold">
            {e.triage_summary[0] || "Concern submitted for review"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(e.created_at).toLocaleString()} ·{" "}
            {e.status.replaceAll("_", " ")}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">
          {e.attribution.source_channel.replaceAll("_", " ")}
        </span>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer font-bold text-teal">
          View case
        </summary>
        <div className="mt-4 grid gap-5 border-t border-line pt-4 md:grid-cols-2">
          <CaseSection title="Triggering concern">
            <p>{e.triage_summary[0] || "Not supplied"}</p>
          </CaseSection>
          <CaseSection title="Triage summary">
            <ul className="list-disc pl-5">
              {e.triage_summary.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CaseSection>
          <CaseSection title="Living Profile snapshot">
            {e.profile_snapshot.length ? (
              <dl className="grid gap-2">
                {e.profile_snapshot.map((item) => (
                  <div key={item.memory_item_id}>
                    <dt className="text-xs font-bold uppercase text-slate-500">
                      {item.type.replaceAll("_", " ")} · {item.status}
                    </dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-slate-500">No profile items supplied.</p>
            )}
          </CaseSection>
          <CaseSection title="Source and provenance">
            <p className="capitalize">
              {e.attribution.source_channel.replaceAll("_", " ")} ·{" "}
              {e.attribution.source_platform}
            </p>
            <ul className="mt-2 text-xs text-slate-500">
              {e.provenance.map((id) => (
                <li className="break-all" key={id}>
                  Source message: {id}
                </li>
              ))}
            </ul>
          </CaseSection>
          {e.clinician_response && (
            <CaseSection title="Clinician response">
              <p>{e.clinician_response.message}</p>
            </CaseSection>
          )}
        </div>
      </details>
    </article>
  );
}
function CaseSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-teal">
        {title}
      </h4>
      {children}
    </section>
  );
}
export function FunnelChart({
  metrics,
  synthetic,
}: {
  metrics: FunnelMetric[];
  synthetic: boolean;
}) {
  if (!metrics.length)
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">Conversion by channel</h2>
        <p className="mt-2 text-sm text-slate-500">
          Metrics will appear when a query-backed clinic endpoint is connected.
        </p>
      </section>
    );
  const max = Math.max(...metrics.map((m) => m.visitors), 1);
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Conversion by channel</h2>
          <p className="text-sm text-slate-500">
            Visitors → value → patients → escalations
          </p>
        </div>
        {synthetic && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold">
            Synthetic metrics
          </span>
        )}
      </div>
      <div className="mt-5 grid gap-5">
        {metrics.map((m) => (
          <div key={m.source_channel}>
            <div className="mb-2 flex justify-between text-sm">
              <strong className="capitalize">
                {m.source_channel.replaceAll("_", " ")}
              </strong>
              <span>{m.visitors} visitors</span>
            </div>
            <div
              className="grid h-3 grid-cols-4 overflow-hidden rounded-full bg-slate-100"
              aria-label={`${m.source_channel}: ${m.visitors} visitors, ${m.value_events} value events, ${m.patient_conversions} patient conversions, ${m.escalations} escalations`}
            >
              <span
                className="bg-slate-400"
                style={{ width: `${(m.visitors / max) * 100}%` }}
              />
              <span
                className="bg-sky-500"
                style={{ width: `${(m.value_events / max) * 100}%` }}
              />
              <span
                className="bg-teal"
                style={{ width: `${(m.patient_conversions / max) * 100}%` }}
              />
              <span
                className="bg-amber-500"
                style={{ width: `${(m.escalations / max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {m.value_events} received value · {m.patient_conversions} became
              patients · {m.escalations} escalations
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Escalations are shown for care workload only. They never increase sales
        ranking.
      </p>
    </section>
  );
}

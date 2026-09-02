import type {
  Citation,
  MemoryItem,
  Message,
  RiskLevel,
} from "./frontend-types";

export function JourneySteps({
  active,
}: {
  active: "ask" | "secure" | "clinic";
}) {
  return (
    <nav
      aria-label="Care journey"
      className="mb-5 flex justify-center gap-1 text-xs md:gap-3 md:text-sm"
    >
      {[
        ["ask", "Ask"],
        ["secure", "Continue securely"],
        ["clinic", "Clinic"],
      ].map(([key, label]) => (
        <span
          key={key}
          className={`border-b-2 px-2 py-2 md:px-4 ${active === key ? "border-teal font-bold text-teal" : "border-line text-slate-500"}`}
        >
          {label}
        </span>
      ))}
    </nav>
  );
}

export function ChatThread({
  messages,
  empty,
}: {
  messages: Message[];
  empty?: React.ReactNode;
}) {
  return (
    <div
      aria-live="polite"
      className="thread-scroll h-[48vh] overflow-y-auto bg-[#f3f7f4] p-4 md:h-[54vh] md:p-6"
    >
      {empty}
      {messages.map((m) => (
        <div
          key={m.message_id}
          className={`mb-3 max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm md:max-w-[76%] ${m.sender_type === "guest" || m.sender_type === "patient" ? "ml-auto rounded-br-sm bg-teal text-white" : "rounded-bl-sm border border-line bg-white"}`}
        >
          {m.sender_type === "ai" && (
            <strong className="mb-1 block text-xs text-teal">
              Nightingale AI
            </strong>
          )}
          {m.content}
        </div>
      ))}
    </div>
  );
}

export function EmergencyWarning() {
  return (
    <p className="px-3 pb-4 text-center text-xs text-slate-500">
      If this is an emergency, exit Nightingale and dial{" "}
      <strong>999 for Emergency Services.</strong>
    </p>
  );
}

export function SafetyAction({
  risk,
  onSend,
  loading,
  available = true,
}: {
  risk: RiskLevel;
  onSend?: () => void;
  loading?: boolean;
  available?: boolean;
}) {
  if (risk === "high")
    return (
      <div
        role="alert"
        className="m-3 rounded-2xl border-2 border-red-700 bg-red-50 p-5 text-red-950"
      >
        <span className="text-xs font-black tracking-widest">
          EMERGENCY · HIGH RISK
        </span>
        <h2 className="mt-1 text-2xl font-black">Call 999 now</h2>
        <p className="my-2 font-semibold">
          Nightingale is not emergency services. Do not wait for Nightingale or
          the clinic.
        </p>
        <a
          href="tel:999"
          className="focus-ring inline-block rounded-xl bg-red-700 px-6 py-3 text-lg font-extrabold text-white shadow-md"
        >
          Call 999 now
        </a>
        {onSend && (
          <button
            disabled={loading || !available}
            onClick={onSend}
            className="focus-ring mt-3 block rounded-xl border border-red-400 px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Recording demo alert…" : "Send to Nurse/Clinic too"}
          </button>
        )}
      </div>
    );
  if (risk === "medium")
    return (
      <div
        role="alert"
        className="m-3 rounded-xl border border-amber-400 bg-amber-50 p-4"
      >
        <span className="text-xs font-black tracking-widest text-amber-900">
          NEEDS HUMAN REVIEW · MEDIUM
        </span>
        <strong className="mt-1 block">
          A nurse or clinician should review this.
        </strong>
        <p className="my-2 text-sm text-slate-600">
          Nightingale has stopped normal guidance.
        </p>
        {onSend && (
          <button
            disabled={loading || !available}
            onClick={onSend}
            className="focus-ring rounded-xl bg-teal px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send to Nurse/Clinic"}
          </button>
        )}
      </div>
    );
  return null;
}

export function LivingProfile({ items }: { items: MemoryItem[] }) {
  return (
    <aside className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-soft">
      <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
        Living Profile
      </p>
      <h2 className="mt-1 text-xl font-bold">What we’ve heard</h2>
      <p className="mt-1 text-sm text-slate-500">
        Only contract-provided notes appear here.
      </p>
      <div className="mt-4">
        {items.length ? (
          items.map((item) => (
            <div
              className="min-w-0 border-t border-line py-3"
              key={item.memory_item_id}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal">
                {item.type.replaceAll("_", " ")}
              </span>
              <strong className="block break-words">{item.value}</strong>
              <span className="block break-all text-[11px] text-slate-500">
                {item.status} · source {item.provenance_pointer}
              </span>
              {item.supersedes_memory_item_id && (
                <span className="block break-all text-[11px] text-slate-400">
                  Current item · replaces {item.supersedes_memory_item_id}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="border-t border-line py-4 text-sm text-slate-500">
            Nothing added yet.
          </p>
        )}
      </div>
    </aside>
  );
}

export function ProcessingFallback() {
  return (
    <div
      role="alert"
      className="m-3 rounded-xl border border-slate-300 bg-slate-50 p-4"
    >
      <strong>I couldn’t safely process that.</strong>
      <p className="mt-1 text-sm text-slate-600">
        No answer was created. You can try again or send this to a nurse or
        clinic.
      </p>
    </div>
  );
}

export function Citations({ items }: { items: Citation[] }) {
  if (!items.length) return null;
  return (
    <details className="mx-3 mb-3 rounded-xl border border-line bg-white p-3">
      <summary className="cursor-pointer font-semibold">Sources</summary>
      <ul className="mt-2 space-y-2">
        {items.map((c) => (
          <li key={c.citation_id}>
            <a
              className="text-teal underline"
              href={c.source_url}
              rel="noreferrer"
              target="_blank"
            >
              {c.title}
            </a>
            <span className="ml-2 text-xs text-slate-500">{c.publisher}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function InlineError({ message }: { message: string | null }) {
  return message ? (
    <div
      role="alert"
      className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      {message}
    </div>
  ) : null;
}

"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api-client";
import { InlineError } from "./ui";

export function StaffSignIn() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (api.mockMode) {
      router.push("/staff");
      return;
    }
    setError("Staff authentication must be connected by the clinic backend.");
    setBusy(false);
  }
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-line bg-white p-7 shadow-soft">
      <p className="text-xs font-extrabold uppercase tracking-widest text-teal">
        Clinic team
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        Sign in to the clinic workspace
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        For authorised staff, nurses and clinicians.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="text-sm font-semibold">
          Work email
          <input
            required
            type="email"
            defaultValue={api.mockMode ? "nurse@example.test" : ""}
            className="mt-1 block w-full rounded-xl border border-line px-3 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Password
          <input
            required
            type="password"
            defaultValue={api.mockMode ? "synthetic-demo" : ""}
            className="mt-1 block w-full rounded-xl border border-line px-3 py-3 font-normal"
          />
        </label>
        <button
          disabled={busy}
          className="rounded-xl bg-ink px-4 py-3 font-bold text-white"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <InlineError message={error} />
      {api.mockMode && (
        <p className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-slate-600">
          <strong>Developer demo.</strong> This opens synthetic clinic data; no
          authentication occurs.
        </p>
      )}
    </section>
  );
}

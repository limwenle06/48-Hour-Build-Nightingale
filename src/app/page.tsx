import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-20">
      <section className="grid min-h-[66vh] items-center gap-10 md:grid-cols-[1.35fr_.8fr] md:gap-16">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-teal">
            The first step
          </p>
          <h1 className="display my-4 text-5xl font-semibold leading-[1.02] md:text-7xl">
            Say what’s wrong.
            <br />
            We’ll help organise it.
          </h1>
          <p className="mb-8 max-w-xl text-lg text-slate-600">
            A few words is enough. No account needed. Nightingale AI is not a
            doctor.
          </p>
          <div>
            <Link
              className="focus-ring inline-block rounded-xl bg-teal px-6 py-4 text-lg font-bold text-white"
              href="/start?source_channel=instagram_ad_click&source_platform=instagram&campaign_id=ivf_over40&creative=story_a"
            >
              Ask a question
            </Link>
            <p className="mt-2 text-sm text-slate-500">Start now.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-7 shadow-soft">
          <Principle n="01" title="Ask first">
            No signup.
          </Principle>
          <Principle n="02" title="You choose">
            We only see what you consent to share.
          </Principle>
          <Principle n="03" title="Safety first">
            Urgent matters interrupt everything else.
          </Principle>
        </div>
      </section>
      <div className="border-t border-line py-6 text-right">
        <Link
          className="text-sm font-semibold text-slate-500 underline-offset-4 hover:underline"
          href="/staff/sign-in"
        >
          Clinic staff sign in
        </Link>
      </div>
    </main>
  );
}
function Principle({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-2 border-b border-line py-4 last:border-0">
      <span className="text-sm font-bold text-teal">{n}</span>
      <div>
        <strong>{title}</strong>
        <p className="mt-1 text-sm text-slate-500">{children}</p>
      </div>
    </div>
  );
}

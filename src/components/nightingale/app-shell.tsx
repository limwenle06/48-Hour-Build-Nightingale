"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./api-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  function end() {
    api.endDemoSession();
    router.push("/");
  }
  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-[5vw]">
        <Link className="focus-ring text-xl font-extrabold text-ink" href="/">
          <span className="text-teal">✦</span> Nightingale
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-mint px-3 py-1 text-xs font-semibold sm:inline">
            Your health, our priority
          </span>
          {api.mockMode && pathname.startsWith("/patient") && (
            <button onClick={end} className="text-sm font-semibold underline">
              End demo session
            </button>
          )}
        </div>
      </header>
      {children}
    </>
  );
}

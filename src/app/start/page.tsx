import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestJourney } from "@/components/nightingale/guest-journey";
export const metadata:Metadata={title:"Ask Nightingale"};
export default function StartPage(){return <main className="mx-auto max-w-6xl px-3 py-5 md:px-5 md:py-9"><Suspense fallback={<p className="p-8 text-center">Opening your secure guest session…</p>}><GuestJourney/></Suspense></main>}

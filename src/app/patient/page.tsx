import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientJourney } from "@/components/nightingale/patient-journey";
export const metadata:Metadata={title:"Your secure chat"};
export default function PatientPage(){return <main className="mx-auto max-w-6xl px-3 py-5 md:px-5 md:py-9"><Suspense fallback={<p className="p-8 text-center">Opening your secure chat…</p>}><PatientJourney/></Suspense></main>}

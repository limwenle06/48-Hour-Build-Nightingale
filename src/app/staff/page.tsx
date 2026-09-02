import type { Metadata } from "next";
import { StaffDashboard } from "@/components/nightingale/staff-dashboard";
export const metadata:Metadata={title:"Clinic workspace"};
export default function StaffPage(){return <main className="mx-auto max-w-6xl px-4 py-8"><StaffDashboard/></main>}

import type { Metadata } from "next";
import { StaffSignIn } from "@/components/nightingale/staff-sign-in";
export const metadata: Metadata = { title: "Clinic staff sign in" };
export default function StaffSignInPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <StaffSignIn />
    </main>
  );
}

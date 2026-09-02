import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/nightingale/app-shell";

export const metadata: Metadata = {
  title: { default: "Nightingale", template: "%s · Nightingale" },
  description: "A secure first step from healthcare inquiry to human care.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nightingale" }
};
export const viewport: Viewport = { themeColor: "#123c42", width: "device-width", initialScale: 1 };

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}

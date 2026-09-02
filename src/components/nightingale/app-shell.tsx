"use client";
import Link from "next/link";
import { useEffect } from "react";

export function AppShell({children}:{children:React.ReactNode}){
  useEffect(()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>undefined)},[]);
  return <><header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-[5vw]"><Link className="focus-ring text-xl font-extrabold text-ink" href="/"><span className="text-teal">✦</span> Nightingale</Link><span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold">AI care guide</span></header>{children}</>;
}

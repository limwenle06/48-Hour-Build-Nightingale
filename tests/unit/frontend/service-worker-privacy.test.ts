import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const publicWorker = readFileSync(
  resolve(process.cwd(), "public/sw.js"),
  "utf8",
);
const scaffoldWorker = readFileSync(
  resolve(process.cwd(), "src/public/sw.js"),
  "utf8",
);

describe("service worker privacy boundary", () => {
  it("keeps the public and scaffold workers aligned", () => {
    expect(scaffoldWorker).toBe(publicWorker);
  });

  it("never runtime-caches protected pages or API responses", () => {
    expect(publicWorker).toContain('pathname.startsWith("/api/")');
    expect(publicWorker).toContain('pathname.startsWith("/patient")');
    expect(publicWorker).toContain('pathname.startsWith("/staff")');
    expect(publicWorker).toContain('pathname.startsWith("/_next/static/")');
  });

  it("replaces the earlier broad runtime cache", () => {
    expect(publicWorker).toContain('"nightingale-public-shell-v3"');
    expect(publicWorker).toContain("caches.delete(key)");
    expect(publicWorker).not.toContain('"nightingale-shell-v1"');
  });

  it("uses the network before its public-shell fallback", () => {
    expect(publicWorker).toContain("fetch(event.request)");
    expect(publicWorker).toContain(".catch(() => caches.match(event.request))");
    expect(publicWorker).toContain("self.skipWaiting()");
    expect(publicWorker).toContain("self.clients.claim()");
  });
});

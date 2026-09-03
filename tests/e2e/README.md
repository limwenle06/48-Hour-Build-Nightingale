# End-to-end tests

**Shared ownership:** Persons 1, 2, and 3

`mock-journey.spec.ts` owns the reliable browser-level challenge journey: acquisition → guest value → simulated authentication and consent → patient message → clinical-review state → escalation → staff queue. It always starts its own mock-mode server and uses synthetic data.

Run it with `npm.cmd run test:e2e`. The Windows-safe runner builds the app, starts a hidden temporary mock server, runs Chromium, and shuts the server down. The first machine setup may require `npx.cmd playwright install chromium`.

The final manual connected check follows `docs/SUPABASE_SETUP.md`. It requires a configured Supabase project and remains separate from the deterministic mock browser test.

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: [
            "tests/unit/ai-safety/**/*.test.ts",
            "tests/unit/backend/**/*.test.ts",
            "tests/integration/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["tests/unit/frontend/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/frontend/setup.ts"],
        },
      },
    ],
  },
});

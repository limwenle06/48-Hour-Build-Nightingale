import type { Config } from "tailwindcss";

export default {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16383b", teal: "#147f7a", mint: "#dff3ec", paper: "#f7f8f4",
        coral: "#da6d52", line: "#dce4df"
      },
      boxShadow: { soft: "0 18px 60px rgba(23,59,61,.07)" }
    }
  },
  plugins: []
} satisfies Config;

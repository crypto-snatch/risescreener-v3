import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e0f",
        panel: "#11181a",
        panel2: "#162023",
        border: "#1f2c2f",
        accent: "#2dd4bf",
        long: "#34d399",
        short: "#f87171",
        muted: "#6b7d80",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

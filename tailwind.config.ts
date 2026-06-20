import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Palette — Section 6 of the spec
        brand: {
          DEFAULT: "#1F3D2B", // Deep Italian green (primary / brand)
          deep: "#163021",
          tint: "#E7EDE8",
        },
        gold: {
          DEFAULT: "#B08D57", // Warm gold (accent)
          soft: "#F1E8D9",
        },
        cream: "#F2EFE9", // Background
        surface: "#FFFFFF", // Cards
        ink: "#1A1A1A", // Primary text
        muted: "#555555", // Secondary text
        line: "#E6E1D7", // Hairline borders on cream
      },
      fontFamily: {
        // Brand/headings = elegant serif; UI/body = clean sans
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn: "12px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26,26,26,0.04), 0 8px 24px rgba(26,26,26,0.06)",
        lift: "0 2px 4px rgba(26,26,26,0.05), 0 14px 40px rgba(26,26,26,0.10)",
      },
      keyframes: {
        "scale-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "draw-check": {
          "0%": { strokeDashoffset: "48" },
          "100%": { strokeDashoffset: "0" },
        },
        "fade-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "scale-in": "scale-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
        "draw-check": "draw-check 0.5s 0.2s ease-out forwards",
        "fade-up": "fade-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;

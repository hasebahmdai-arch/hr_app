import type { Config } from "tailwindcss";

const brandPrimary = process.env.BRAND_PRIMARY_HEX || "#F97316";
const brandDark = process.env.BRAND_PRIMARY_DARK_HEX || "#EA580C";
const brandDarker = process.env.BRAND_PRIMARY_DARKER_HEX || "#C2410C";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: brandPrimary,
          dark: brandDark,
          darker: brandDarker,
          light: "#FB923C",
          tint: "#FFF7ED",
          foreground: "#ffffff",
        },
        surface: "#ffffff",
        muted: {
          DEFAULT: "#e5e7eb",
          bg: "#f9fafb",
          foreground: "#374151",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: { DEFAULT: "#16a34a", light: "#dcfce7" },
        warning: { DEFAULT: "#f59e0b", light: "#fef3c7" },
      },
      fontFamily: {
        sans: ["var(--font-livvic)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        elevated: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;

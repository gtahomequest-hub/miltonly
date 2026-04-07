import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A1628",
          50: "#E8EDF5",
          100: "#C5D0E3",
          200: "#8DA1C6",
          300: "#5573A9",
          400: "#2D4A7C",
          500: "#152D52",
          600: "#0F2140",
          700: "#0A1628",
          800: "#060E1A",
          900: "#03070D",
        },
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#2563EB",
          600: "#1D4ED8",
          700: "#1E40AF",
          800: "#1E3A8A",
          900: "#172554",
        },
        accent: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#16A34A",
          600: "#15803D",
          700: "#166534",
        },
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display": ["3.5rem", { lineHeight: "1.1", fontWeight: "800" }],
        "display-lg": ["4.5rem", { lineHeight: "1.05", fontWeight: "800" }],
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.08)",
        "glow-brand": "0 0 20px rgba(37,99,235,0.3), 0 0 60px rgba(37,99,235,0.1)",
        "glow-accent": "0 0 20px rgba(22,163,74,0.3), 0 0 60px rgba(22,163,74,0.1)",
      },
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [],
};
export default config;

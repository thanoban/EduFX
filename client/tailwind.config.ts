import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2f6cf2",
          strong: "#1747b0",
          soft: "#eef4ff",
          border: "#b2ceff",
          muted: "#93c5fd",
        },
        success: { DEFAULT: "#1ea95a", soft: "#f0fdf4", border: "#bbf7d0" },
        warning: { DEFAULT: "#e59a18", soft: "#fffbeb", border: "#fde68a" },
        danger: { DEFAULT: "#d94d4d", soft: "#fef2f2", border: "#fecaca" },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#eef4ff",
          strong: "#0f2749",
          raised: "#f8fafc",
          border: "#d8e3f1",
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Helvetica Neue"', "sans-serif"],
      },
      borderRadius: {
        card: "24px",
        btn: "16px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(20,36,64,0.06)",
        brand: "0 14px 30px rgba(47,108,242,0.26)",
      },
    },
  },
  plugins: [],
};

export default config;

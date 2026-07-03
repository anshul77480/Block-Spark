/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // surface layers (dark SOC theme)
        base: "#080b12",
        surface: "#0f141f",
        "surface-2": "#151b28",
        "surface-3": "#1b2333",
        border: "#232c3d",
        "border-soft": "#1a2130",
        // text
        ink: "#e6ebf4",
        muted: "#93a1b8",
        faint: "#5f6c82",
        // brand
        brand: {
          DEFAULT: "#4f8cff",
          soft: "#6ea0ff",
          dim: "#2f5bd0",
        },
        // risk semantics
        risk: {
          low: "#34d399",
          medium: "#fbbf24",
          high: "#f5566c",
        },
        // keep legacy tokens so nothing breaks mid-refactor
        soc: {
          bg: "#080b12",
          panel: "#0f141f",
          border: "#232c3d",
          accent: "#4f8cff",
        },
      },
      fontFamily: {
        sans: [
          "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "0.85rem",
        "2xl": "1.1rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(79,140,255,0.35), 0 0 24px -6px rgba(79,140,255,0.45)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(4px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "70%": { boxShadow: "0 0 0 6px rgba(52,211,153,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 2s infinite",
      },
    },
  },
  plugins: [],
};

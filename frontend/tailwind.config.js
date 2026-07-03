/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: "#0a0e17",
          panel: "#111725",
          border: "#1e2739",
          accent: "#38bdf8",
        },
        risk: {
          low: "#22c55e",
          medium: "#f59e0b",
          high: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: "#0a0a0f",
          surface: "#111118",
          card: "#16161f",
          gold: "#d4a843",
          crimson: "#c0392b",
          neon: "#38bdf8",
          reel: "#1a1a26",
        },
      },
      fontFamily: {
        heading: ['"Playfair Display"', "Georgia", "serif"],
        body: ['"Inter"', '"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(251,191,36,0.35)",
        "cinema-gold": "0 0 40px rgba(212,168,67,0.15)",
        "cinema-neon": "0 0 30px rgba(56,189,248,0.12)",
        "cinema-crimson": "0 0 25px rgba(192,57,43,0.15)",
      },
      animation: {
        "film-flicker": "flicker 4s ease-in-out infinite",
        "projector-sweep": "projectorSweep 8s linear infinite",
        "reel-spin": "reelSpin 3s linear infinite",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.97" },
          "52%": { opacity: "0.94" },
          "54%": { opacity: "1" },
        },
        projectorSweep: {
          "0%": { transform: "translateX(-100%) rotate(15deg)" },
          "100%": { transform: "translateX(200%) rotate(15deg)" },
        },
        reelSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};

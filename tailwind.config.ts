import type { Config } from "tailwindcss";

// Design tokens sampled from the approved prototype screenshots (deep green + gold on warm off-white)
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0E3F36",   // sidebar / header deep green
          deep: "#0A2F29",
          soft: "#1A5247",
          hover: "#164A40",
          green: "#0F6B4B",     // primary chart green / progress
          gold: "#C9A227",
          goldSoft: "#E6C765",
          cream: "#F5F5F0",
          card: "#FFFFFF",
          border: "#E4E6E1",
          text: "#1F2A26",
          muted: "#6B7672",
        },
        rag: {
          green: "#0F7A4E",
          greenBg: "#E9F5EE",
          amber: "#D99B2B",
          amberBg: "#FBF3E1",
          red: "#C63B3B",
          redBg: "#FBE9E9",
          orange: "#E2792C",
          blue: "#2F6F8F",
          blueBg: "#E7F0F5",
        },
      },
      fontFamily: {
        sans: ['"Sakkal Majalla"', '"IBM Plex Sans Arabic"', "Tahoma", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 40, 30, 0.04), 0 1px 6px rgba(20, 40, 30, 0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;

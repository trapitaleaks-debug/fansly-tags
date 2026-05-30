import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: "#0d0d0d",
        "surface-2": "#141414",
        border: "#222222",
        accent: "#dc2626",
        "accent-hover": "#b91c1c",
        "text-primary": "#f5f5f5",
        "text-muted": "#888888",
        "text-dim": "#555555",
        rising: "#22c55e",
        falling: "#dc2626",
      },
    },
  },
  plugins: [],
}
export default config

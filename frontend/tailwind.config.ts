import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        "page-bg": "#0d1117",
        "sidebar-bg": "#0a0e14",
        "card-bg": "#151d28",
        "card-border": "#1e2d3d",
        "icon-bg": "#1a2535",
        "input-bg": "#0d1117",
        "input-border": "#1e2d3d",

        // Accent colors
        "accent": "#3dd9c6",
        "accent-hover": "#4ae3d0",
        "status-green": "#22c55e",
        "status-yellow": "#eab308",
        "status-red": "#ef4444",

        // Text colors
        "text-primary": "#ffffff",
        "text-secondary": "#8899a8",
        "text-muted": "#5a6a78",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title": ["24px", { lineHeight: "1.2", fontWeight: "600" }],
        "stat-number": ["36px", { lineHeight: "1.1", fontWeight: "700" }],
        "stat-label": ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        "stat-change": ["12px", { lineHeight: "1.3", fontWeight: "400" }],
        "nav-item": ["14px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      spacing: {
        "sidebar": "240px",
        "page-padding": "32px",
        "card-padding": "24px",
      },
      borderRadius: {
        "card": "12px",
      },
      boxShadow: {
        "card": "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)",
        "glow": "0 0 20px rgba(61, 217, 198, 0.3)",
      },
      transitionDuration: {
        "fast": "200ms",
      },
    },
  },
  plugins: [],
};

export default config;

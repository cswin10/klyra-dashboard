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
        // Background colors - dark theme
        "page-bg": "#0a0a0f",
        "sidebar": "#0d0d12",
        "sidebar-bg": "#0d0d12",
        "card-bg": "#12121a",
        "card-border": "#252530",
        "border-card": "#252530",
        "icon-bg": "#1e1e2a",
        "input-bg": "#1a1a24",
        "input-border": "#35354a",

        // Accent colors - silver brand
        "accent": "#c0c0c0",
        "accent-hover": "#e0e0e0",
        "accent-muted": "#808090",
        "silver": "#c0c0c0",
        "silver-bright": "#f0f0f0",
        "navy": "#1a365d",
        "navy-light": "#2d4a7c",
        "navy-glow": "#3d5a9f",

        // Status colors
        "status-green": "#22c55e",
        "status-yellow": "#eab308",
        "status-red": "#ef4444",
        "status-blue": "#3b82f6",

        // Text colors
        "text-primary": "#ffffff",
        "text-secondary": "#9898a8",
        "text-muted": "#606070",
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
        "card": "16px",
      },
      boxShadow: {
        "card": "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "glow": "0 0 30px rgba(192, 192, 192, 0.2)",
        "glow-navy": "0 0 30px rgba(45, 74, 124, 0.4)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)",
        "shimmer": "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
        "navy-gradient": "linear-gradient(135deg, rgba(26, 54, 93, 0.4) 0%, rgba(45, 74, 124, 0.2) 100%)",
      },
      backdropBlur: {
        "glass": "20px",
      },
      animation: {
        "shimmer": "shimmer 2s infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      transitionDuration: {
        "fast": "200ms",
      },
    },
  },
  plugins: [],
};

export default config;

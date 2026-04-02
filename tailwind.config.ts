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
        background: "var(--background)",
        foreground: "var(--foreground)",
        'sa-bg': '#0f1219',
        'sa-card': '#1a1f2e',
        'sa-border': '#2a2f3e',
        'sa-up': '#4ade80',
        'sa-down': '#f87171',
        'sa-alert': '#ef4444',
        'sa-accent': '#60a5fa',
        'sa-text': '#e2e8f0',
        'sa-text-secondary': '#94a3b8',
      },
    },
  },
  plugins: [],
};
export default config;

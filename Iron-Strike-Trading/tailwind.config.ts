import type { Config } from "tailwindcss";

/**
 * IRON STRIKE TRADING — PRECISION AI ENGINE DESIGN SYSTEM v1.0
 * 
 * This is not a trading app. This is an AI decision engine.
 * Calm authority. Technical precision. Quiet confidence.
 */

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./shared/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      /* ─────────────────────────────────────────────────────────────────────
         TYPOGRAPHY SCALE (Desktop reference)
         H1: 48px / 1.1
         H2: 32px / 1.2
         H3: 24px / 1.3
         Body: 16px / 1.6
         Label/meta: 12px / uppercase / letter-spaced
         ───────────────────────────────────────────────────────────────────── */
      fontSize: {
        'hero': ['3rem', { lineHeight: '1.1', fontWeight: '600' }],      // 48px
        'display': ['2rem', { lineHeight: '1.2', fontWeight: '600' }],   // 32px
        'heading': ['1.5rem', { lineHeight: '1.3', fontWeight: '500' }], // 24px
        'subheading': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }], // 20px
        'body': ['1rem', { lineHeight: '1.6' }],                          // 16px
        'label': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.1em', fontWeight: '500' }], // 12px
      },

      borderRadius: {
        lg: "0.375rem",  // 6px - restrained, not rounded
        md: "0.25rem",   // 4px
        sm: "0.125rem",  // 2px
      },

      colors: {
        /* ─────────────────────────────────────────────────────────────────
           BACKGROUNDS — Deep charcoal layered system
           ─────────────────────────────────────────────────────────────────*/
        background: "hsl(var(--background) / <alpha-value>)",
        "background-secondary": "hsl(var(--background-secondary) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        "foreground-secondary": "hsl(var(--foreground-secondary) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",

        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },

        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },

        /* ─────────────────────────────────────────────────────────────────
           ACCENT — ONLY ONE (cyan #22D3EE)
           Focus, active states, confirmations only.
           Never decoration. Never stacked. Never glowing.
           ─────────────────────────────────────────────────────────────────*/
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },

        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },

        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },

        ring: "hsl(var(--ring) / <alpha-value>)",

        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },

        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },

        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },

        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)",
        },

        /* Semantic colors for data display */
        success: {
          DEFAULT: "hsl(142 76% 36%)",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT: "hsl(38 92% 50%)",
          foreground: "hsl(0 0% 0%)",
        },
        info: {
          DEFAULT: "hsl(187 85% 53%)",
          foreground: "hsl(0 0% 0%)",
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },

      /* ─────────────────────────────────────────────────────────────────────
         SPACING SCALE
         4 / 8 / 16 / 24 / 32 / 48 / 64 / 96
         Whitespace creates trust.
         ───────────────────────────────────────────────────────────────────── */
      spacing: {
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '30': '7.5rem',   // 120px
      },

      maxWidth: {
        'content': '72rem',   // 1152px - max content width
        'narrow': '48rem',    // 768px - narrow content
        'prose': '40rem',     // 640px - prose width
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

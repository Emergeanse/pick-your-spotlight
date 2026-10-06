import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        'xs': '375px',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
        },
        // Design system Pick v1.0 — docs/DESIGN_SYSTEM.md
        pick: {
          surface: "hsl(var(--pick-surface))",
          "surface-hover": "hsl(var(--pick-surface-hover))",
          "purple-light": "hsl(var(--pick-purple-light))",
          magenta: "hsl(var(--pick-magenta))",
          pink: "hsl(var(--pick-pink))",
          gold: "hsl(var(--pick-gold))",
          "text-secondary": "hsl(var(--pick-text-secondary))",
          "text-muted": "hsl(var(--pick-text-muted))",
          border: "rgb(139 92 246 / 0.18)",
          "border-hover": "rgb(139 92 246 / 0.38)",
          "border-active": "rgb(168 85 247 / 0.70)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        // Échelle Pick : 8 / 12 / 16 / 20 px, et rounded-full pour les pilules.
        "pick-sm": "8px",
        "pick-md": "12px",
        "pick-lg": "16px",
        "pick-xl": "20px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        pick: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        // Clic 120 ms, survol 180 ms, ouverture 260 ms.
        120: "120ms",
        180: "180ms",
        260: "260ms",
      },
      boxShadow: {
        "pick-card": "0 8px 24px rgba(0,0,0,.30)",
        "pick-hover": "0 8px 28px rgba(0,0,0,.35), 0 0 12px rgba(139,92,246,.10)",
        "pick-active": "0 0 16px rgba(168,85,247,.22)",
        "pick-cta": "0 0 18px rgba(168,85,247,.32), 0 0 32px rgba(217,70,239,.12)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

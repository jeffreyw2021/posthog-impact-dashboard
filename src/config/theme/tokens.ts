/**
 * Design system tokens — ported from Clipboard Health ATS (src/config/theme/).
 *
 * Single source of truth. CSS variables in globals.css are derived from these.
 * Use the JS constants here when you need token values in TypeScript code.
 */

// ─── Primary ──────────────────────────────────────────────────────────────────

export const primary = {
  main:  "#477FFF",
  light: "#edf2ff",   // lighten(main, 0.9)
  dark:  "#3259b3",   // darken(main, 0.3)
  trans: "rgba(71, 127, 255, 0.12)",
} as const;

// ─── Branded grey scale ────────────────────────────────────────────────────────
// brandedGreys(primary.main, 4, 'light')

export const grey = {
  50:  "#fafafa",
  100: "#f4f5f5",
  200: "#ecedee",
  300: "#dfe0e2",
  400: "#babcbf",
  500: "#9a9da2",
  600: "#71737a",
  700: "#5d5f65",
  800: "#404145",
  900: "#202122",
} as const;

// ─── Semantic text ────────────────────────────────────────────────────────────

export const text = {
  primary:   "rgba(0,0,0,0.87)",
  secondary:  "rgba(0,0,0,0.6)",
  disabled:  "rgba(0,0,0,0.38)",
} as const;

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export const surface = {
  bg:      grey[100],  // #f4f5f5 — page ground
  paper:   "#ffffff",  // elevated surfaces / cards
  divider: "#e2e2e4",
} as const;

// ─── Semantic palette ─────────────────────────────────────────────────────────

export const palette = {
  blue:   { 50: "#f0f4ff", 100: "#e0e8ff", 200: "#c0d1ff", 500: "#80a2ff", 700: "#4073ff" },
  green:  { 50: "#ebfbee", 500: "#51cf66", 700: "#37b24d" },
  yellow: { 50: "#fff9db", 500: "#fcc419" },
  red:    { 50: "#fff5f5", 500: "#ff6b6b", 700: "#f03e3e" },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Base unit only — MUI derives the full scale via theme.spacing(n) = n × spacingBase.

export const spacingBase = 8;

// ─── Shape ────────────────────────────────────────────────────────────────────

export const radius = {
  sm:  "4px",
  md:  "8px",   // default
  lg:  "12px",
  xl:  "16px",
  "2xl": "20px",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: "Urbanist, ui-sans-serif, system-ui, sans-serif",
  mono: "Inter, ui-monospace, monospace",
} as const;

export const typography = {
  h1:      { size: "32px", weight: 500, lineHeight: 1.12 },
  h2:      { size: "24px", weight: 500, lineHeight: 1.3  },
  h3:      { size: "20px", weight: 500, lineHeight: 1.4  },
  h4:      { size: "18px", weight: 500, lineHeight: 1.4  },
  h5:      { size: "15px", weight: 500, lineHeight: 1.5  },
  h6:      { size: "14px", weight: 500, lineHeight: 1.1  },
  body1:   { size: "15px", weight: 400, lineHeight: 1.36 },
  body2:   { size: "12px", weight: 400, lineHeight: 1.5  },
  caption: { size: "13px", weight: 500, lineHeight: 1.4  },
} as const;

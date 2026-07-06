"use client";

import { createTheme, alpha } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";
import { primary, grey, palette, typography, fontFamily, spacingBase } from "./tokens";

// ─── Font stacks ──────────────────────────────────────────────────────────────
// CSS variables injected by next/font in layout.tsx
export const PRIMARY_FONT = `var(--font-urbanist), ${fontFamily.sans}`;
export const SECONDARY_FONT = `var(--font-inter), ${fontFamily.mono}`;
export const PRIMARY_COLOR = primary.main;

// ─── Flat shadows (no elevation drop-shadows, same as ATS) ───────────────────
const FLAT_SHADOWS = Array.from({ length: 25 }, () => "none") as Shadows;

// ─── MUI theme factory ────────────────────────────────────────────────────────
export function createAppTheme(mode: "light" | "dark" = "dark") {
  
  const isDark = mode === "dark";

  return createTheme({
    shadows: FLAT_SHADOWS,

    palette: {
      mode,
      primary: {
        main:  primary.main,
        light: primary.light,
        dark:  primary.dark,
        contrastText: "#fff",
      },
      grey,
      divider: isDark ? "rgba(255,255,255,0.12)" : "#e2e2e4",
      background: {
        default: isDark ? "#131415" : "#f4f5f5",  // grey ground (grey[100] in light)
        paper:   isDark ? "#1e2022" : "#ffffff",   // elevated surfaces / cards
      },
      text: {
        primary:   isDark ? "rgba(255,255,255,0.87)" : "rgba(0,0,0,0.87)",
        secondary: isDark ? "rgba(255,255,255,0.6)"  : "rgba(0,0,0,0.6)",
        disabled:  isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)",
      },
      error:   { main: palette.red[500],    dark: palette.red[700],    light: palette.red[50]    },
      warning: { main: palette.yellow[500], light: palette.yellow[50]                             },
      success: { main: palette.green[500],  dark: palette.green[700],  light: palette.green[50]  },
    },

    typography: {
      htmlFontSize: 16,
      fontFamily: PRIMARY_FONT,
      fontWeightLight:   300,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    700,
      h1:      { fontFamily: PRIMARY_FONT, fontSize: typography.h1.size,      fontWeight: typography.h1.weight,      lineHeight: typography.h1.lineHeight      },
      h2:      { fontFamily: PRIMARY_FONT, fontSize: typography.h2.size,      fontWeight: typography.h2.weight,      lineHeight: typography.h2.lineHeight      },
      h3:      { fontFamily: PRIMARY_FONT, fontSize: typography.h3.size,      fontWeight: typography.h3.weight,      lineHeight: typography.h3.lineHeight      },
      h4:      { fontFamily: PRIMARY_FONT, fontSize: typography.h4.size,      fontWeight: typography.h4.weight,      lineHeight: typography.h4.lineHeight      },
      h5:      { fontFamily: PRIMARY_FONT, fontSize: typography.h5.size,      fontWeight: typography.h5.weight,      lineHeight: typography.h5.lineHeight      },
      h6:      { fontFamily: PRIMARY_FONT, fontSize: typography.h6.size,      fontWeight: typography.h6.weight,      lineHeight: typography.h6.lineHeight      },
      body1:   { fontFamily: PRIMARY_FONT, fontSize: typography.body1.size,   fontWeight: typography.body1.weight,   lineHeight: typography.body1.lineHeight   },
      body2:   { fontFamily: PRIMARY_FONT, fontSize: typography.body2.size,   fontWeight: typography.body2.weight,   lineHeight: typography.body2.lineHeight   },
      caption: { fontFamily: PRIMARY_FONT, fontSize: typography.caption.size, fontWeight: typography.caption.weight, lineHeight: typography.caption.lineHeight },
      button:  { textTransform: "none" },
    },

    spacing: spacingBase,
    shape: { borderRadius: 8 },

    transitions: {
      easing: {
        easeInOut: "ease-in-out",
        easeOut:   "ease-in-out",
        easeIn:    "ease-in-out",
        sharp:     "ease-in-out",
      },
      duration: {
        shortest:      150,
        shorter:       200,
        short:         250,
        standard:      300,
        complex:       375,
        enteringScreen: 225,
        leavingScreen:  195,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "*, *::before, *::after": { boxSizing: "border-box" },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            transition: "none",
            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({ borderRadius: theme.shape.borderRadius }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
        },
      },
    },
  });
}

export const theme = createAppTheme("light");
export default theme;

// ─── Re-exports for convenience (same pattern as ATS theme.ts) ───────────────
export { alpha, useTheme, lighten, darken, styled, keyframes } from "@mui/material/styles";
export type { SxProps, Theme, Breakpoint } from "@mui/material/styles";

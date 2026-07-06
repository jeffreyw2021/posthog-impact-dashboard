"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type Engineer, cardSx } from "./engineerTypes";

// ─── Conventional commit parser ───────────────────────────────────────────────

function parsePR(title: string) {
  const m = title.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/);
  if (m) return { type: m[1], scope: m[2] ?? null, desc: m[3] };
  return { type: null, scope: null, desc: title };
}

const TYPE_META: Record<string, { color: string; label: string }> = {
  feat:     { color: "#4f87f5", label: "feat"     },
  fix:      { color: "#f0a050", label: "fix"      },
  refactor: { color: "#8b75e8", label: "refactor" },
  perf:     { color: "#2dbdac", label: "perf"     },
  chore:    { color: "#94a3b8", label: "chore"    },
  docs:     { color: "#5bb88a", label: "docs"     },
  test:     { color: "#e07aaa", label: "test"     },
  style:    { color: "#94a3b8", label: "style"    },
  build:    { color: "#b0806e", label: "build"    },
  ci:       { color: "#94a3b8", label: "ci"       },
};

function getMeta(type: string | null) {
  if (type && TYPE_META[type]) return TYPE_META[type];
  return { color: "#94a3b8", label: type ?? "pr" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecentPRsCard({ engineer }: { engineer: Engineer }) {
  const samplePRs = engineer.samplePRTitles ?? [];
  const parsed = samplePRs.map(parsePR);

  return (
    <Box sx={{ ...cardSx, p: 2.5, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.disabled"
        sx={{ textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}
      >
        Commits to Repository
      </Typography>

      {/* Scrollable git-tree */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 2, pr: 0.5,
        /* thin custom scrollbar */
        "&::-webkit-scrollbar": { width: 3 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "grey.300", borderRadius: 2 },
      }}>
        {parsed.map((pr, i) => {
          const { color, label } = getMeta(pr.type);
          const isLast = i === parsed.length - 1;

          return (
            <Box key={i} sx={{ display: "flex", gap: 1.5 }}>

              {/* ── Timeline rail ── */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
                {/* Node */}
                <Box sx={{
                  width: 9, height: 9,
                  borderRadius: "50%",
                  bgcolor: color,
                  flexShrink: 0,
                  mt: "3px",
                  boxShadow: `0 0 0 2px ${color}28`,
                }} />
                {/* Rail */}
                {!isLast && (
                  <Box sx={{ width: "1px", flex: 1, minHeight: 20, bgcolor: "grey.200", my: "3px" }} />
                )}
              </Box>

              {/* ── Commit content ── */}
              <Box sx={{ pb: isLast ? 0 : 2, minWidth: 0, flex: 1 }}>
                {/* Type + scope badges */}
                <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5} flexWrap="wrap">
                  <Box sx={{
                    px: 0.75, py: "1px",
                    borderRadius: 0.75,
                    bgcolor: `${color}15`,
                    border: "1px solid",
                    borderColor: `${color}35`,
                    display: "inline-flex",
                  }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color, lineHeight: 1.5, letterSpacing: "0.02em" }}>
                      {label}
                    </Typography>
                  </Box>
                  {pr.scope && (
                    <Typography sx={{ fontSize: 10, color: "text.disabled", lineHeight: 1 }}>
                      {pr.scope}
                    </Typography>
                  )}
                </Stack>

                {/* Description */}
                <Typography
                  variant="caption"
                  color="text.primary"
                  sx={{ lineHeight: 1.55, display: "block", fontWeight: 400 }}
                >
                  {pr.desc}
                </Typography>
              </Box>

            </Box>
          );
        })}

        {samplePRs.length === 0 && (
          <Typography variant="caption" color="text.disabled">No PR data available</Typography>
        )}
      </Box>
    </Box>
  );
}

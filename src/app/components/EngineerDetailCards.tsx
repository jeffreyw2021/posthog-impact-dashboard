"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { useTheme } from "@mui/material/styles";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import { type Engineer, DIM, cardSx } from "./engineerTypes";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.3 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}

function shortPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `${parts[0]}/…/${parts.at(-1)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EngineerDetailCards({ engineer }: { engineer: Engineer }) {
  const theme = useTheme();

  const topFiles = engineer.topFiles?.slice(0, 4) ?? [];
  const samplePRs = engineer.samplePRTitles ?? [];

  const radarData = [
    { subject: "Centrality", value: engineer.centralityScore },
    { subject: "Influence",  value: engineer.influenceScore  },
    { subject: "Breadth",    value: engineer.breadthScore    },
    { subject: "Shipping",   value: engineer.shippingScore   },
    { subject: "Reviewing",  value: engineer.reviewingScore  },
  ];


  return (
    // No alignItems — default "stretch" makes all cells the same height
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>

      {/* ── Card 1: Pentagon radar ──────────────────────────────────────── */}
      <Box sx={{ ...cardSx, p: 2.5, display: "flex", flexDirection: "column" }}>

        {/* Profile row */}
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
          <Avatar
            src={engineer.avatarUrl}
            alt={engineer.login}
            variant="rounded"
            sx={{ width: 36, height: 36, borderRadius: 1.5, flexShrink: 0 }}
          />
          <Box minWidth={0}>
            <Typography
              component="a"
              href={`https://github.com/${engineer.login}`}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              fontWeight={600}
              sx={{ color: "text.secondary", textDecoration: "none", "&:hover": { color: "primary.main" } }}
            >
              @{engineer.login}
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="baseline">
              <Typography variant="h2" color="text.primary" sx={{ lineHeight: 1 }}>
                {engineer.impactScore.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.disabled">/100</Typography>
            </Stack>
          </Box>
        </Stack>

        {/* Pentagon chart — flex: 1 fills remaining vertical space */}
        <Box sx={{ flex: 1, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="62%" data={radarData}>
              <PolarGrid gridType="polygon" stroke={theme.palette.grey[200]} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              />
              <Radar
                dataKey="value"
                stroke={DIM.centrality.color}
                fill={DIM.centrality.color}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Box>

        {/* Stats footer — pinned to bottom of flex column */}
        <Stack
          direction="row"
          justifyContent="space-around"
          pt={2}
          sx={{ borderTop: "1px solid", borderColor: "divider" }}
        >
          <StatPill value={engineer.prCount} label="PRs merged" />
          <StatPill value={engineer.filesCount.toLocaleString()} label="files touched" />
          <StatPill value={engineer.uniqueModules} label="modules" />
        </Stack>
      </Box>

      {/* ── Card 2: Load-bearing files (no bars) ───────────────────────── */}
      <Box sx={{ ...cardSx, p: 2.5, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.disabled"
          sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Load-Bearing Files
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mt={0.5}
          mb={2.5}
          sx={{ lineHeight: 1.5 }}
        >
          Files they own that many teammates also edit — shared infrastructure touchpoints
        </Typography>

        <Stack spacing={2.5}>
          {topFiles.map((f, i) => (
            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Stack spacing={0.5} minWidth={0}>
                <Box
                  sx={{
                    display: "inline-flex",
                    px: 0.75, py: 0.2,
                    borderRadius: 0.75,
                    bgcolor: "grey.100",
                    width: "fit-content",
                  }}
                >
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: 10 }}>
                    {f.module}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shortPath(f.path)}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ color: DIM.centrality.color, flexShrink: 0 }}
              >
                {f.uniqueAuthors} coauthors
              </Typography>
            </Stack>
          ))}
          {topFiles.length === 0 && (
            <Typography variant="caption" color="text.disabled">No file data available</Typography>
          )}
        </Stack>
      </Box>

      {/* ── Card 3: Recent PRs (5) ──────────────────────────────────────── */}
      <Box sx={{ ...cardSx, p: 2.5, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.disabled"
          sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Recent PRs Merged
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mt={0.5}
          mb={2.5}
          sx={{ lineHeight: 1.5 }}
        >
          A sample of what they shipped — read these to understand their area of focus
        </Typography>

        <Stack spacing={1.75}>
          {samplePRs.map((title, i) => (
            <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
              <Box
                sx={{
                  width: 18, height: 18,
                  borderRadius: "50%",
                  bgcolor: "grey.100",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, mt: "1px",
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.disabled", lineHeight: 1 }}>
                  {i + 1}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {title}
              </Typography>
            </Stack>
          ))}
          {samplePRs.length === 0 && (
            <Typography variant="caption" color="text.disabled">No PR data available</Typography>
          )}
        </Stack>
      </Box>

    </Box>
  );
}

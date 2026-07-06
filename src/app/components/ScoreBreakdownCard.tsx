"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { useTheme } from "@mui/material/styles";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { type Engineer, DIM, cardSx } from "./engineerTypes";

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

export function ScoreBreakdownCard({ engineer }: { engineer: Engineer }) {
  const theme = useTheme();

  const radarData = [
    { subject: "Centrality", value: engineer.centralityScore },
    { subject: "Influence",  value: engineer.influenceScore  },
    { subject: "Breadth",    value: engineer.breadthScore    },
    { subject: "Shipping",   value: engineer.shippingScore   },
    { subject: "Reviewing",  value: engineer.reviewingScore  },
  ];

  return (
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

      {/* Pentagon radar — flex: 1 fills remaining vertical space */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
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

      {/* Stats footer */}
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
  );
}

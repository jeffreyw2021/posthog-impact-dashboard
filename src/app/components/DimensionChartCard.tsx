"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { type Engineer, DIM, cardSx } from "./engineerTypes";

export function DimensionChartCard({ engineers }: { engineers: Engineer[] }) {
  const theme = useTheme();

  const chartData = engineers.map((e) => ({
    name: e.login.length > 9 ? `${e.login.slice(0, 8)}…` : e.login,
    Centrality: Math.round(e.centralityScore),
    Influence:  Math.round(e.influenceScore),
    Breadth:    Math.round(e.breadthScore),
    Shipping:   Math.round(e.shippingScore  ?? 0),
    Reviewing:  Math.round(e.reviewingScore ?? 0),
  }));

  return (
    <Box sx={{ ...cardSx, p: 2.5, display: "flex", flexDirection: "column", gap: 6 }}>

      {/* Header */}
      <Box>
        <Typography variant="caption" fontWeight={600} letterSpacing="0.06em" sx={{ textTransform: "uppercase", color: "text.disabled" }}>
          Impact Comparison
        </Typography>
        <Stack direction="row" spacing={2} mt={0.75} justifyContent="flex-end">
          {Object.values(DIM).map(({ label, color }) => (
            <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Chart */}
      <Box>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="38%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[200]} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 20]}
              ticks={[0, 5, 10, 15, 20]}
              tick={{ fontSize: 10, fill: theme.palette.text.disabled }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                border: "none",
                borderRadius: theme.shape.borderRadius,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                background: theme.palette.background.paper,
              }}
              cursor={{ fill: theme.palette.grey[100] }}
            />
            <Bar dataKey="Centrality" fill={DIM.centrality.color} radius={[3, 3, 0, 0]} maxBarSize={11} />
            <Bar dataKey="Influence"  fill={DIM.influence.color}  radius={[3, 3, 0, 0]} maxBarSize={11} />
            <Bar dataKey="Breadth"    fill={DIM.breadth.color}    radius={[3, 3, 0, 0]} maxBarSize={11} />
            <Bar dataKey="Shipping"   fill={DIM.shipping.color}   radius={[3, 3, 0, 0]} maxBarSize={11} />
            <Bar dataKey="Reviewing"  fill={DIM.reviewing.color}  radius={[3, 3, 0, 0]} maxBarSize={11} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

    </Box>
  );
}

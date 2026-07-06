"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import rawData from "./data.json";
import { type Engineer } from "./components/engineerTypes";
import { EngineerListCard } from "./components/EngineerListCard";
import { DimensionChartCard } from "./components/DimensionChartCard";
import { ScoreBreakdownCard } from "./components/ScoreBreakdownCard";
import { LoadBearingFilesCard } from "./components/LoadBearingFilesCard";
import { RecentPRsCard } from "./components/RecentPRsCard";
import { ModuleSearchBar, type Module } from "./components/ModuleSearchBar";
import { DimensionDeepDive } from "./components/DimensionDeepDive";

const top5: Engineer[] = (rawData.all as unknown as Engineer[]).slice(0, 5);
const modules = (rawData as unknown as { modules: Module[] }).modules;
const { since, until } = rawData as unknown as { since: string; until: string };

export default function Page() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  return (
    <Box
      component="main"
      sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}
    >
      <Stack
        sx={{ maxWidth: 1280, mx: "auto", pt: 3, px: 3, pb: 4 }}
        direction="column"
        spacing={1}
      >
        {/* Header */}
        <Typography variant="h1" color="text.primary" sx={{ pb: 1 }}>
          Engineering Impact Dashboard
        </Typography>

        {/* Module filter toolbar — full row below title */}
        <ModuleSearchBar
          modules={modules}
          value={selectedModule}
          onChange={setSelectedModule}
        />

        {/* Main two-panel grid — list (narrow) left, chart (wide) right */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 1 }}>
          <EngineerListCard
            engineers={top5}
            selected={selectedIdx}
            onSelect={setSelectedIdx}
          />
          <DimensionChartCard engineers={top5} />
        </Box>

        {/* Dimension deep-dive — 5 tab chips + full-width viz card */}
        <DimensionDeepDive
          engineer={top5[selectedIdx]}
          allModules={modules}
          since={since}
          until={until}
        />

        {/* Selected engineer detail — 3 equal cards in a row */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridAutoRows: "360px", gap: 1 }}>
          <ScoreBreakdownCard engineer={top5[selectedIdx]} />
          <LoadBearingFilesCard engineer={top5[selectedIdx]} />
          <RecentPRsCard engineer={top5[selectedIdx]} />
        </Box>
      </Stack>
    </Box>
  );
}

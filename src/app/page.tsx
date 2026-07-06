"use client";

import { useState, useMemo } from "react";
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

const allEngineers = rawData.all as unknown as Engineer[];
const modules = (rawData as unknown as { modules: Module[] }).modules;
const { since, until } = rawData as unknown as { since: string; until: string };

export default function Page() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Re-rank by module-specific scores when a module is selected
  const displayEngineers = useMemo<Engineer[]>(() => {
    if (!selectedModule) return allEngineers.slice(0, 5);
    return [...allEngineers]
      .filter(e => e.moduleScores?.[selectedModule])
      .sort((a, b) =>
        (b.moduleScores![selectedModule].impactScore ?? 0) -
        (a.moduleScores![selectedModule].impactScore ?? 0)
      )
      .slice(0, 5)
      .map(e => {
        const ms = e.moduleScores![selectedModule];
        return {
          ...e,
          centralityScore: ms.centralityScore,
          influenceScore:  ms.influenceScore,
          breadthScore:    ms.breadthScore,
          shippingScore:   ms.shippingScore,
          reviewingScore:  ms.reviewingScore,
          impactScore:     ms.impactScore,
          // Filter detail files to the selected module
          topFiles: e.topFiles.filter(f => f.module === selectedModule),
        };
      });
  }, [selectedModule]);

  function handleModuleChange(v: string | null) {
    setSelectedModule(v);
    setSelectedIdx(0);
  }

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
          onChange={handleModuleChange}
        />

        {/* Main two-panel grid — list (narrow) left, chart (wide) right */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 1 }}>
          <EngineerListCard
            engineers={displayEngineers}
            selected={selectedIdx}
            onSelect={setSelectedIdx}
          />
          <DimensionChartCard engineers={displayEngineers} />
        </Box>

        {/* Dimension deep-dive — 5 tab chips + full-width viz card */}
        <DimensionDeepDive
          engineer={displayEngineers[selectedIdx]}
          allModules={modules}
          since={since}
          until={until}
        />

        {/* Selected engineer detail — 3 equal cards in a row */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridAutoRows: "360px", gap: 1 }}>
          <ScoreBreakdownCard engineer={displayEngineers[selectedIdx]} />
          <LoadBearingFilesCard engineer={displayEngineers[selectedIdx]} />
          <RecentPRsCard engineer={displayEngineers[selectedIdx]} />
        </Box>
      </Stack>
    </Box>
  );
}

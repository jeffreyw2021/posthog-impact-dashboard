"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import rawData from "./data.json";
import { type Engineer } from "./components/engineerTypes";
import { EngineerListCard } from "./components/EngineerListCard";
import { DimensionChartCard } from "./components/DimensionChartCard";
import { EngineerDetailCards } from "./components/EngineerDetailCards";
import { ModuleSearchBar, type Module } from "./components/ModuleSearchBar";

const top5: Engineer[] = (rawData.all as unknown as Engineer[]).slice(0, 5);
const modules = (rawData as unknown as { modules: Module[] }).modules;


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

        {/* Selected engineer detail — 3 equal cards in a row */}
        <EngineerDetailCards engineer={top5[selectedIdx]} />
      </Stack>
    </Box>
  );
}

"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type Engineer, DIM, cardSx } from "./engineerTypes";

function shortPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `${parts[0]}/…/${parts.at(-1)}`;
}

export function LoadBearingFilesCard({ engineer }: { engineer: Engineer }) {
  const topFiles = engineer.topFiles?.slice(0, 4) ?? [];

  return (
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
            <Typography variant="caption" fontWeight={700} sx={{ color: DIM.centrality.color, flexShrink: 0 }}>
              {f.uniqueAuthors} coauthors
            </Typography>
          </Stack>
        ))}
        {topFiles.length === 0 && (
          <Typography variant="caption" color="text.disabled">No file data available</Typography>
        )}
      </Stack>
    </Box>
  );
}

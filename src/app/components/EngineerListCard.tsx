"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { type Engineer, cardSx } from "./engineerTypes";

export function EngineerListCard({
  engineers, selected, onSelect,
}: {
  engineers: Engineer[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <Box sx={{ ...cardSx, display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Top 5 Most Impactful Engineers
        </Typography>
      </Box>
      {engineers.map((eng, i) => {
        const isSelected = selected === i;
        const isLast = i === engineers.length - 1;
        return (
          <Stack
            key={eng.login}
            component="button"
            onClick={() => onSelect(i)}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              flex: 1,
              width: "100%", textAlign: "left", cursor: "pointer",
              border: "none",
              borderBottom: isLast ? "none" : "1px solid",
              borderColor: "divider",
              bgcolor: isSelected ? "primary.light" : "background.paper",
              px: 2.5,
              transition: "background-color 0.15s",
              "&:hover": { bgcolor: isSelected ? "primary.light" : "grey.50" },
            }}
          >
            <Box sx={{ position: "relative", flexShrink: 0 }}>
              <Avatar
                src={eng.avatarUrl}
                alt={eng.login}
                variant="rounded"
                sx={{ width: 36, height: 36, borderRadius: 1.5 }}
              />
              <Box sx={{
                position: "absolute", top: -5, left: -5,
                width: 16, height: 16, borderRadius: "50%",
                bgcolor: isSelected ? "primary.main" : "grey.700",
                color: "#fff", fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}>
                {i + 1}
              </Box>
            </Box>

            <Typography variant="body2" fontWeight={600} color="text.primary" noWrap sx={{ flex: 1 }}>
              {eng.login}
            </Typography>

            <Stack direction="row" alignItems="baseline" spacing={0.25} sx={{ flexShrink: 0 }}>
              <Typography variant="h2" color="text.primary" sx={{ lineHeight: 1 }}>
                {eng.impactScore.toFixed(0)}
              </Typography>
              <Typography variant="caption" color="text.disabled">/100</Typography>
            </Stack>
          </Stack>
        );
      })}
    </Box>
  );
}

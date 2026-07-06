"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OutlinedInput from "@mui/material/OutlinedInput";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import { Search, X } from "lucide-react";

export type Module = {
  name: string;
  fileCount: number;
  prCount: number;
  uniqueEngineers: number;
};

interface ModuleSearchBarProps {
  modules: Module[];
  value: string | null;
  onChange: (v: string | null) => void;
}

const CONTROL_HEIGHT = 44;

export function ModuleSearchBar({
  modules,
  value,
  onChange,
}: ModuleSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return modules;
    const q = query.toLowerCase();
    return modules.filter((m) => m.name.toLowerCase().includes(q));
  }, [query, modules]);

  const inputSx = {
    flex: 1,
    "&.MuiOutlinedInput-root": {
      height: CONTROL_HEIGHT,
      backgroundColor: "#ffffff !important",
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
    },
    "& input": { py: 0, fontSize: 14 },
  };

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%" }}>
      {/* ── Input row: text field + search button ─────────────────────── */}
      <Stack direction="row" spacing={0.5} alignItems="stretch">
        <OutlinedInput
          fullWidth
          placeholder="Focus on a module (e.g. frontend, posthog)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          endAdornment={
            value ? (
              <Box
                component="button"
                onClick={() => {
                  onChange(null);
                  setQuery("");
                }}
                sx={{
                  display: "flex",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "text.disabled",
                  p: 0,
                  mr: -0.5,
                  "&:hover": { color: "text.primary" },
                }}
              >
                <X size={14} strokeWidth={1.5} />
              </Box>
            ) : null
          }
          sx={inputSx}
        />

        <IconButton
          aria-label="Search module"
          sx={{
            width: CONTROL_HEIGHT,
            height: CONTROL_HEIGHT,
            flexShrink: 0,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            color: "text.primary",
            "&:hover": { bgcolor: "grey.50" },
          }}
        >
          <Search size={16} strokeWidth={1.5} />
        </IconButton>
      </Stack>

      {/* ── Dropdown ──────────────────────────────────────────────────── */}
      {open && filtered.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: CONTROL_HEIGHT + 4, // align with right edge of input (not button)
            zIndex: 1300,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            maxHeight: 240,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {filtered.map((mod) => {
            const isSelected = mod.name === value;
            return (
              <Stack
                key={mod.name}
                component="button"
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(mod.name);
                  setOpen(false);
                }}
                sx={{
                  width: "100%",
                  px: 1.75,
                  py: 1,
                  border: "none",
                  bgcolor: isSelected ? "primary.light" : "background.paper",
                  cursor: "pointer",
                  textAlign: "left",
                  "&:hover": {
                    bgcolor: isSelected ? "primary.light" : "grey.50",
                  },
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={isSelected ? 600 : 400}
                  sx={{ color: isSelected ? "primary.main" : "text.primary" }}
                >
                  {mod.name}/
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {mod.prCount} PRs · {mod.uniqueEngineers} engineers
                </Typography>
              </Stack>
            );
          })}
        </Paper>
      )}
    </Box>
  );
}

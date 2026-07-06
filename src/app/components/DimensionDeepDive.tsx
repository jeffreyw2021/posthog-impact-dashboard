"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush,
  Treemap, ScatterChart, Scatter, ZAxis,
} from "recharts";
import type { TreemapNode } from "recharts";
import { type Engineer, DIM, cardSx } from "./engineerTypes";
import { type Module } from "./ModuleSearchBar";

// ─── Palette & helpers ────────────────────────────────────────────────────────

const MOD_PALETTE = [
  '#5284E8','#8B6FE6','#2FBDAA','#F0A93E','#E8687A',
  '#5BB88A','#B0806E','#6366F1','#EC4899','#14B8A6',
];
function modColor(name: string | null | undefined): string {
  if (!name) return MOD_PALETTE[0];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return MOD_PALETTE[h % MOD_PALETTE.length];
}
function shortPath(p: string) {
  const pts = p.split('/');
  return pts.length <= 2 ? p : `${pts[0]}/…/${pts.at(-1)}`;
}
function fmtWeek(s: string) {
  const d = new Date(s + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function fillWeeks(
  data: { week: string; [k: string]: any }[],
  since: string,
  until: string,
  zero: Record<string, number>,
): { week: string; [k: string]: any }[] {
  const map = new Map(data.map(d => [d.week, d]));
  const result: { week: string; [k: string]: any }[] = [];
  const cur = new Date(since + 'T00:00:00Z');
  const day = cur.getUTCDay() || 7;
  cur.setUTCDate(cur.getUTCDate() + 1 - day);
  const end = new Date(until + 'T00:00:00Z');
  while (cur <= end) {
    const wk = cur.toISOString().slice(0, 10);
    result.push(map.get(wk) ?? { week: wk, ...zero });
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return result;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const DIMS = [
  { key: 'centrality', ...DIM.centrality },
  { key: 'influence',  ...DIM.influence  },
  { key: 'breadth',    ...DIM.breadth    },
  { key: 'shipping',   ...DIM.shipping   },
  { key: 'reviewing',  ...DIM.reviewing  },
] as const;
type DimKey = (typeof DIMS)[number]['key'];

const DIM_SUB: Record<DimKey, string> = {
  centrality: "Each dot is a file this engineer contributed to. Further right = more teammates depend on it. Higher = more of their code there. Top-right = critical infrastructure they own.",
  influence:  "Each bubble is a file this engineer seeded early (1st, 2nd, or 3rd contributor). Bubble size = how many engineers later built on their foundation.",
  breadth:    "Every codebase module sized by its total file count. Highlighted = this engineer contributed there. Deeper color = more files they touched in that module.",
  shipping:   "Merged PR shipping weight per week (√files × log LOC). Taller bars = more substantive PRs. Drag the slider handles to zoom into a window.",
  reviewing:  "Review comments (solid) and approvals (lighter) stacked per week. Consistent bars = this engineer is actively unblocking teammates.",
};

// ─── Shared axis style ────────────────────────────────────────────────────────

const axTick = { fontSize: 10, fill: '#94a3b8' } as const;
const axLine = { axisLine: false, tickLine: false } as const;

// ─── CENTRALITY — 2-D scatter: X = coauthors, Y = their additions ────────────
// Story: top-right quadrant = "I own code that the whole team depends on."

function CentralityViz({ engineer }: { engineer: Engineer }) {
  const files = (engineer.topFiles ?? []).slice(0, 10);
  if (!files.length) return <Empty />;

  const data = files.map(f => ({
    x: f.uniqueAuthors,
    y: f.additions,
    module: f.module,
    path: f.path,
    uniqueAuthors: f.uniqueAuthors,
    additions: f.additions,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, left: -4, bottom: 26 }}>
        <CartesianGrid stroke="#f1f5f9" />
        <XAxis
          type="number" dataKey="x" name="Coauthors" tick={axTick} {...axLine}
          label={{ value: 'coauthors on this file →', position: 'insideBottom', offset: -16, fontSize: 10, fill: '#94a3b8' }}
        />
        <YAxis
          type="number" dataKey="y" name="Their additions" tick={axTick} {...axLine}
          label={{ value: 'their additions', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', dx: 14 }}
        />
        <ZAxis type="number" range={[56, 56]} />
        <Tooltip
          content={({ payload }) => {
            const d = payload?.[0]?.payload;
            if (!d) return null;
            return (
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25, maxWidth: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <Typography variant="caption" fontWeight={600} display="block" mb={0.25} sx={{ fontFamily: 'monospace' }}>{shortPath(d.path)}</Typography>
                <Typography variant="caption" color="text.secondary">{d.uniqueAuthors} coauthors · {d.additions.toLocaleString()} lines added</Typography>
              </Box>
            );
          }}
        />
        <Scatter
          data={data}
          isAnimationActive={false}
          shape={(props: any) => {
            const { cx, cy, payload } = props;
            return <circle cx={cx} cy={cy} r={8} fill={modColor(payload.module)} fillOpacity={0.82} />;
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── INFLUENCE — bubble constellation: size = ripple, uniform violet ──────────
// Story: they planted seeds early; the bigger the bubble, the more grew from it.

const RANK_LABEL = ['1st', '2nd', '3rd'] as const;

function InfluenceViz({ engineer }: { engineer: Engineer }) {
  const raw = (engineer.influenceFiles ?? []).slice(0, 8);
  if (!raw.length) return <Empty />;

  const sorted = [...raw].sort((a, b) => b.laterAuthors - a.laterAuthors);
  const maxLater = sorted[0]?.laterAuthors ?? 1;
  const totalLater = sorted.reduce((s, f) => s + f.laterAuthors, 0);

  const MIN_R = 18, MAX_R = 46;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Summary stat */}
      <Stack direction="row" spacing={2.5} mb={1.5} flexShrink={0}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: DIM.influence.color }}>
            {sorted.length}
          </Typography>
          <Typography variant="caption" color="text.disabled">files pioneered</Typography>
        </Box>
        <Box sx={{ width: '1px', bgcolor: 'divider' }} />
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: DIM.influence.color }}>
            {totalLater}
          </Typography>
          <Typography variant="caption" color="text.disabled">engineers built after</Typography>
        </Box>
      </Stack>

      {/* Bubble constellation row */}
      <Box sx={{
        flex: 1, minHeight: 0,
        overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', alignItems: 'center', gap: 2.5, pb: 0.5,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.200', borderRadius: 2 },
      }}>
        {sorted.map((f, i) => {
          const r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(f.laterAuthors / maxLater);
          const fill = DIM.influence.color;
          const d = Math.ceil(r) * 2 + 8; // SVG bounding box
          const filename = f.path.split('/').at(-1) ?? f.path;

          return (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              <svg width={d} height={d} style={{ overflow: 'visible' }}>
                {/* Subtle ring */}
                <circle cx={d / 2} cy={d / 2} r={r + 4} fill={fill} fillOpacity={0.12} />
                {/* Main bubble */}
                <circle cx={d / 2} cy={d / 2} r={r} fill={fill} fillOpacity={0.8} />
                {/* Rank label */}
                <text x={d / 2} y={d / 2 - 7} fill="rgba(255,255,255,0.75)" textAnchor="middle"
                  fontSize={9} fontWeight="600" style={{ pointerEvents: 'none' }}>
                  {RANK_LABEL[f.earlyRank - 1]}
                </text>
                {/* Count */}
                <text x={d / 2} y={d / 2 + 8} fill="#fff" textAnchor="middle"
                  fontSize={13} fontWeight="700" style={{ pointerEvents: 'none' }}>
                  +{f.laterAuthors}
                </text>
              </svg>
              {/* filename only — no path — constrained to bubble width to prevent overlap */}
              <Box sx={{ width: d + 8, overflow: 'hidden' }}>
                <Typography sx={{ fontSize: 9, fontFamily: 'monospace', color: 'text.secondary', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                  {filename}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── BREADTH — stock-heatmap treemap ─────────────────────────────────────────

function BreadthViz({ engineer, allModules }: { engineer: Engineer; allModules: Module[] }) {
  const contribMap = new Map((engineer.moduleContribs ?? []).map(m => [m.module, m]));
  const color = DIM.breadth.color;

  const data = allModules.map(m => {
    const c = contribMap.get(m.name);
    const intensity = c ? Math.min(c.fileCount / Math.max(m.fileCount, 1), 1) : 0;
    return { name: m.name, value: m.fileCount, contributed: !!c, intensity, engineerFiles: c?.fileCount ?? 0 };
  });
  const covered = data.filter(d => d.contributed).length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="baseline" flexShrink={0}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color }}>{covered}</Typography>
        <Typography variant="caption" color="text.disabled">of {allModules.length} modules</Typography>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="value" nameKey="name" nodeGap={2} isAnimationActive={false}
            content={(node: TreemapNode) => {
              const { x, y, width, height } = node;
              if (node.value === undefined || width < 2 || height < 2) return <g />;
              const contributed = node.contributed as boolean;
              const intensity = (node.intensity as number) ?? 0;
              const ef = (node.engineerFiles as number) ?? 0;
              const opacity = contributed ? 0.45 + intensity * 0.5 : 1;
              const fill = contributed ? color : '#e2e8f0';
              const tc  = contributed ? '#ffffff' : '#94a3b8';
              const tc2 = contributed ? 'rgba(255,255,255,0.65)' : '#b0bec5';
              return (
                <g>
                  <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={opacity} rx={3} ry={3} />
                  {width > 32 && height > 16 && (
                    <text x={x + 6} y={y + 14} fill={tc} fontSize={11} fontWeight={contributed ? '600' : '400'} style={{ pointerEvents: 'none' }}>
                      {node.name as string}
                    </text>
                  )}
                  {contributed && ef > 0 && width > 32 && height > 30 && (
                    <text x={x + 6} y={y + 26} fill={tc2} fontSize={10} style={{ pointerEvents: 'none' }}>
                      {ef} files
                    </text>
                  )}
                </g>
              );
            }}
          />
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

// ─── SHIPPING — GitHub-style weekly bar + Brush ───────────────────────────────

function ShippingViz({ engineer, since, until }: { engineer: Engineer; since: string; until: string }) {
  const data = fillWeeks(engineer.weeklyShipping ?? [], since, until, { weight: 0 });
  const color = DIM.shipping.color;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="week" tickFormatter={fmtWeek} tick={axTick} {...axLine} minTickGap={36} />
        <YAxis tick={axTick} {...axLine} />
        <Tooltip
          formatter={(v: number) => [v.toFixed(1), 'Shipping weight']}
          labelFormatter={(l: string) => `Week of ${fmtWeek(l)}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="weight" fill={color} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
        <Brush dataKey="week" height={22} stroke={color} fill="#f8fafc" travellerWidth={5} tickFormatter={fmtWeek} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── REVIEWING — GitHub-style weekly stacked bar + Brush ─────────────────────

function ReviewingViz({ engineer, since, until }: { engineer: Engineer; since: string; until: string }) {
  const raw = engineer.weeklyReviewing ?? [];
  const color = DIM.reviewing.color;

  if (!raw.length) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
        <Stack direction="row" spacing={3}>
          {[
            { v: engineer.reviewComments ?? 0, l: 'review comments' },
            { v: engineer.reviewApprovals ?? 0, l: 'approvals' },
            { v: `${engineer.reviewingScore}/20`, l: 'score' },
          ].map((s, i) => (
            <Box key={i}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color }}>{s.v}</Typography>
              <Typography variant="caption" color="text.disabled">{s.l}</Typography>
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          Weekly timeline refreshing in background…
        </Typography>
      </Box>
    );
  }

  const data = fillWeeks(raw, since, until, { comments: 0, approvals: 0, total: 0 });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="week" tickFormatter={fmtWeek} tick={axTick} {...axLine} minTickGap={36} />
        <YAxis tick={axTick} {...axLine} />
        <Tooltip
          formatter={(v: number, key: string) => [v, key === 'comments' ? 'Review comments' : 'Approvals']}
          labelFormatter={(l: string) => `Week of ${fmtWeek(l)}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="comments" stackId="a" fill={color} fillOpacity={0.85} radius={[0, 0, 0, 0]} />
        <Bar dataKey="approvals" stackId="a" fill={color} fillOpacity={0.35} radius={[2, 2, 0, 0]} />
        <Brush dataKey="week" height={22} stroke={color} fill="#f8fafc" travellerWidth={5} tickFormatter={fmtWeek} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty() {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="caption" color="text.disabled">No data available</Typography>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  engineer: Engineer;
  allModules: Module[];
  since: string;
  until: string;
}

export function DimensionDeepDive({ engineer, allModules, since, until }: Props) {
  const [active, setActive] = useState<DimKey>('centrality');
  const dim = DIMS.find(d => d.key === active)!;

  return (
    <Box>
      {/* Pill tab chips */}
      <Stack direction="row" spacing={0.75} mb={1} flexWrap="wrap">
        {DIMS.map(d => {
          const on = d.key === active;
          return (
            <Box
              key={d.key}
              component="button"
              onClick={() => setActive(d.key)}
              sx={{
                height: 30, px: 1.75,
                borderRadius: '15px',
                border: '1px solid',
                borderColor: on ? d.color : 'divider',
                bgcolor: on ? d.color : 'transparent',
                color: on ? '#fff' : 'text.secondary',
                cursor: 'pointer',
                fontSize: 12, fontWeight: on ? 600 : 400, fontFamily: 'inherit',
                letterSpacing: '0.01em',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: d.color, color: on ? '#fff' : d.color, bgcolor: on ? d.color : `${d.color}12` },
              }}
            >
              {d.label}
            </Box>
          );
        })}
      </Stack>

      {/* Visualization card */}
      <Box sx={{ ...cardSx, p: 3, height: 360, display: 'flex', flexDirection: 'column' }}>
        {/* Title + subtitle */}
        <Box flexShrink={0} mb={1.5}>
          <Typography variant="caption" fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: dim.color }}>
            {dim.label}
          </Typography>
          <Typography variant="caption" color="text.secondary"
            sx={{ display: 'block', mt: 0.5, lineHeight: 1.55 }}>
            {DIM_SUB[active]}
          </Typography>
        </Box>

        {/* Visualization fills remaining height */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {active === 'centrality' && <CentralityViz engineer={engineer} />}
          {active === 'influence'  && <InfluenceViz  engineer={engineer} />}
          {active === 'breadth'    && <BreadthViz    engineer={engineer} allModules={allModules} />}
          {active === 'shipping'   && <ShippingViz   engineer={engineer} since={since} until={until} />}
          {active === 'reviewing'  && <ReviewingViz  engineer={engineer} since={since} until={until} />}
        </Box>
      </Box>
    </Box>
  );
}

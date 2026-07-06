"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import data from "./data.json";

// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleScore = {
  centralityScore: number;
  influenceScore: number;
  breadthScore: number;
  impactScore: number;
};

type Engineer = {
  login: string;
  avatarUrl: string;
  prCount: number;
  filesCount: number;
  uniqueModules: number;
  samplePRTitles: string[];
  centralityScore: number;
  influenceScore: number;
  breadthScore: number;
  impactScore: number;
  moduleScores: Record<string, ModuleScore>;
  moduleList: string[];
  topFiles: Array<{ path: string; module: string; additions: number; uniqueAuthors: number }>;
};

type Module = {
  name: string;
  fileCount: number;
  prCount: number;
  uniqueEngineers: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = "#477FFF";
const GREY = {
  50: "#fafafa", 100: "#f4f5f5", 200: "#ecedee",
  300: "#dfe0e2", 400: "#babcbf", 500: "#9a9da2",
  600: "#71737a", 700: "#5d5f65", 800: "#404145", 900: "#202122",
};
const DIM_COLORS = {
  centrality: PRIMARY,
  influence:  "#7c3aed",
  breadth:    "#059669",
};

const ALL_ENGINEERS = data.all as unknown as Engineer[];
const MODULES = (data as unknown as { modules: Module[] }).modules as Module[];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getScores(eng: Engineer, module: string | null): ModuleScore {
  if (!module) {
    return {
      centralityScore: eng.centralityScore,
      influenceScore:  eng.influenceScore,
      breadthScore:    eng.breadthScore,
      impactScore:     eng.impactScore,
    };
  }
  return eng.moduleScores?.[module] ?? {
    centralityScore: 0, influenceScore: 0, breadthScore: 0, impactScore: 0,
  };
}

function shortPath(path: string, maxLen = 38) {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  const file = parts.at(-1) ?? path;
  const dir = parts.slice(0, -1).join("/");
  if (dir.length + file.length + 4 <= maxLen) return `${dir}/…/${file}`;
  return `…/${file}`;
}

// ─── DimensionBar ────────────────────────────────────────────────────────────
function DimBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        style={{ height: 6, borderRadius: 3, backgroundColor: GREY[200], flex: 1, overflow: "hidden" }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            backgroundColor: color,
            width: `${Math.max(value, 0)}%`,
            transition: "width 0.35s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: GREY[500], width: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}

// ─── ModuleCombobox ───────────────────────────────────────────────────────────
function ModuleCombobox({
  value, onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return MODULES;
    const q = query.toLowerCase();
    return MODULES.filter(m => m.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div ref={ref} style={{ position: "relative", width: 320 }}>
      <div
        style={{
          display: "flex", alignItems: "center",
          height: 44, borderRadius: 8,
          border: `1.5px solid ${open ? PRIMARY : GREY[300]}`,
          backgroundColor: "#fff",
          padding: "0 12px",
          gap: 8,
          transition: "border-color 0.15s",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 5.5A3.5 3.5 0 1 1 9 5.5A3.5 3.5 0 0 1 2 5.5Zm3.5-5A5 5 0 1 0 9.8 9.09l3.05 3.06a.75.75 0 1 0 1.06-1.06L10.87 8.04A5 5 0 0 0 5.5.5Z" fill={GREY[500]} fillRule="evenodd" clipRule="evenodd"/>
        </svg>
        <input
          type="text"
          placeholder="Filter by module (e.g. frontend, posthog)"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{
            border: "none", outline: "none", flex: 1,
            fontSize: 14, fontFamily: "inherit", background: "transparent",
            color: GREY[900],
          }}
        />
        {value && (
          <button
            onClick={() => { onChange(null); setQuery(""); }}
            style={{ border: "none", background: "none", cursor: "pointer", color: GREY[500], padding: 0, display: "flex" }}
            title="Clear filter"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            backgroundColor: "#fff", border: `1px solid ${GREY[200]}`, borderRadius: 8,
            overflow: "hidden", maxHeight: 260, overflowY: "auto",
          }}
        >
          {filtered.map(mod => (
            <button
              key={mod.name}
              onMouseDown={e => { e.preventDefault(); onChange(mod.name); setQuery(mod.name); setOpen(false); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "9px 14px", border: "none",
                backgroundColor: mod.name === value ? "#edf2ff" : "transparent",
                cursor: "pointer", textAlign: "left",
                color: mod.name === value ? PRIMARY : GREY[800],
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = mod.name === value ? "#edf2ff" : GREY[50]; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = mod.name === value ? "#edf2ff" : "transparent"; }}
            >
              <span style={{ fontSize: 13, fontWeight: mod.name === value ? 600 : 400 }}>
                {mod.name}/
              </span>
              <span style={{ fontSize: 11, color: GREY[500] }}>
                {mod.prCount} PRs · {mod.uniqueEngineers} engineers
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EngineerCard ─────────────────────────────────────────────────────────────
function EngineerCard({
  engineer, rank, selected, module, onClick,
}: {
  engineer: Engineer;
  rank: number;
  selected: boolean;
  module: string | null;
  onClick: () => void;
}) {
  const s = getScores(engineer, module);
  const isInactive = module && s.impactScore === 0;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", cursor: "pointer", width: "100%",
        borderRadius: 12, border: `1.5px solid ${selected ? PRIMARY : GREY[200]}`,
        backgroundColor: selected ? "#f0f4ff" : "#fff",
        padding: 16, transition: "border-color 0.15s, background 0.15s",
        opacity: isInactive ? 0.45 : 1,
      }}
    >
      {/* Header: rank + avatar + name + score */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={engineer.avatarUrl}
            alt={engineer.login}
            width={40} height={40}
            style={{ borderRadius: "50%", display: "block" }}
            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${engineer.login}&size=40&background=edf2ff&color=477fff`; }}
          />
          <span style={{
            position: "absolute", top: -4, left: -4,
            width: 18, height: 18, borderRadius: "50%",
            backgroundColor: rank === 1 ? PRIMARY : GREY[800],
            color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {rank}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: GREY[900], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {engineer.login}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: GREY[900], lineHeight: 1.1 }}>
              {isInactive ? "—" : s.impactScore.toFixed(0)}
            </span>
            {!isInactive && (
              <span style={{ fontSize: 11, color: GREY[500] }}>/100</span>
            )}
          </div>
        </div>
      </div>

      {!isInactive && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: GREY[500], marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Centrality</div>
            <DimBar value={s.centralityScore} color={DIM_COLORS.centrality} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: GREY[500], marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Influence</div>
            <DimBar value={s.influenceScore} color={DIM_COLORS.influence} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: GREY[500], marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Breadth</div>
            <DimBar value={s.breadthScore} color={DIM_COLORS.breadth} />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 4, paddingTop: 12, borderTop: `1px solid ${GREY[100]}`,
      }}>
        {[
          { val: engineer.prCount, label: "PRs" },
          { val: engineer.filesCount, label: "files" },
          { val: engineer.uniqueModules, label: "modules" },
        ].map(({ val, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GREY[800] }}>{val}</div>
            <div style={{ fontSize: 10, color: GREY[500] }}>{label}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── DimensionChart ───────────────────────────────────────────────────────────
function DimensionChart({ engineers, module }: { engineers: Engineer[]; module: string | null }) {
  const chartData = engineers.map(e => {
    const s = getScores(e, module);
    return {
      name: e.login.length > 9 ? e.login.slice(0, 8) + "…" : e.login,
      Centrality: s.centralityScore,
      Influence:  s.influenceScore,
      Breadth:    s.breadthScore,
    };
  });

  return (
    <div>
      <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        Impact Dimension Breakdown {module ? `· ${module}/` : "· All Modules"}
      </p>
      <ResponsiveContainer width="100%" height={172}>
        <BarChart data={chartData} margin={{ top: 0, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={GREY[100]} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: GREY[600] }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: GREY[400] }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${GREY[200]}`, borderRadius: 8, background: "#fff" }}
            cursor={{ fill: GREY[50] }}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="Centrality" fill={DIM_COLORS.centrality} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Influence"  fill={DIM_COLORS.influence}  radius={[3, 3, 0, 0]} />
          <Bar dataKey="Breadth"    fill={DIM_COLORS.breadth}    radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── EngineerDetail ───────────────────────────────────────────────────────────
function EngineerDetail({ engineer, module }: { engineer: Engineer; module: string | null }) {
  const s = getScores(engineer, module);
  const modFiles = module
    ? engineer.topFiles.filter(f => f.module === module)
    : engineer.topFiles;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Profile header */}
      <div style={{
        borderRadius: 12, border: `1.5px solid ${GREY[200]}`,
        backgroundColor: "#fff", padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={engineer.avatarUrl} alt={engineer.login}
            width={32} height={32} style={{ borderRadius: "50%" }}
            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${engineer.login}&size=32&background=edf2ff&color=477fff`; }}
          />
          <div>
            <a
              href={`https://github.com/${engineer.login}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: PRIMARY, textDecoration: "none" }}
            >
              @{engineer.login}
            </a>
            <div style={{ fontSize: 11, color: GREY[500], marginTop: 1 }}>
              Impact score: <strong style={{ color: GREY[800] }}>{s.impactScore.toFixed(1)}</strong>
              {module && <span> in <strong style={{ color: GREY[800] }}>{module}/</strong></span>}
            </div>
          </div>
        </div>

        {/* Why impactful */}
        <div style={{ fontSize: 12, color: GREY[700], lineHeight: 1.6 }}>
          <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: GREY[500] }}>Why they&apos;re impactful</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {s.centralityScore > 40 && (
              <li>Works on <strong>{s.centralityScore.toFixed(0)}/100</strong> centrality — their files are touched by many teammates, signaling shared infrastructure work</li>
            )}
            {s.influenceScore > 30 && (
              <li>Influence score <strong>{s.influenceScore.toFixed(0)}/100</strong> — code they wrote early was later extended by others</li>
            )}
            {s.breadthScore > 40 && (
              <li>Contributes across <strong>{engineer.uniqueModules} modules</strong> — reduces silos by working across the stack</li>
            )}
            {s.centralityScore <= 40 && s.influenceScore <= 30 && s.breadthScore <= 40 && (
              <li>Consistent contributor with balanced centrality, influence, and breadth</li>
            )}
          </ul>
        </div>
      </div>

      {/* Top central files */}
      {modFiles.length > 0 && (
        <div style={{
          borderRadius: 12, border: `1.5px solid ${GREY[200]}`,
          backgroundColor: "#fff", padding: 16,
        }}>
          <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Most Central Files {module ? `in ${module}/` : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modFiles.slice(0, 4).map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 11, color: GREY[700], fontFamily: "var(--font-inter), monospace", wordBreak: "break-all", flex: 1 }}>
                  {shortPath(f.path)}
                </span>
                <span style={{
                  fontSize: 10, color: PRIMARY, fontWeight: 600,
                  backgroundColor: "#edf2ff", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {f.uniqueAuthors} authors
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample PRs */}
      {engineer.samplePRTitles.length > 0 && (
        <div style={{
          borderRadius: 12, border: `1.5px solid ${GREY[200]}`,
          backgroundColor: "#fff", padding: 16,
        }}>
          <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Sample PRs
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {engineer.samplePRTitles.map((title, i) => (
              <div key={i} style={{ fontSize: 11, color: GREY[600], fontStyle: "italic", lineHeight: 1.4 }}>
                &ldquo;{title}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MethodologyPanel ─────────────────────────────────────────────────────────
function MethodologyPanel() {
  const items = [
    {
      key: "centrality", label: "Centrality", weight: "40%", color: DIM_COLORS.centrality,
      desc: "Files touched by many unique engineers are load-bearing infrastructure. Score = Σ (file_unique_authors ÷ max) × (your_additions ÷ file_total). Working on shared code gets weighted by how shared it is.",
    },
    {
      key: "influence", label: "Influence", weight: "35%", color: DIM_COLORS.influence,
      desc: "Files you contributed to early that others subsequently built on. If you're among the first 3 authors and many teammates later modified the same file, your code had compounding leverage.",
    },
    {
      key: "breadth", label: "Breadth", weight: "25%", color: DIM_COLORS.breadth,
      desc: "Unique top-level modules contributed to, normalized across the team. Engineers who span the codebase reduce knowledge silos and increase their coordination value.",
    },
  ];

  return (
    <div style={{
      borderRadius: 12, border: `1.5px solid ${GREY[200]}`,
      backgroundColor: "#fff", padding: "16px 20px",
    }}>
      <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        How Impact Is Calculated · PR count, commits, and raw LOC are not used
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {items.map(({ key, label, weight, color, desc }) => (
          <div key={key} style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 3, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: GREY[800] }}>
                {label} <span style={{ fontWeight: 400, color: GREY[500] }}>({weight})</span>
              </div>
              <div style={{ fontSize: 11, color: GREY[600], marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  // Track by login so selection persists through re-sorts
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);

  // Sort top-5 by module-specific score when a module is selected
  const top5 = useMemo(() => {
    const pool = ALL_ENGINEERS.slice(0, 25);
    const sorted = [...pool].sort((a, b) => {
      const sa = getScores(a, selectedModule).impactScore;
      const sb = getScores(b, selectedModule).impactScore;
      return sb - sa;
    });
    return sorted.slice(0, 5);
  }, [selectedModule]);

  const selectedIdx = Math.max(0, top5.findIndex(e => e.login === selectedLogin));
  const selectedEngineer = top5[selectedIdx] ?? top5[0];

  const since = new Date(data.since + "T00:00:00");
  const until = new Date(data.until + "T00:00:00");
  const dateRange = `${since.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const selectedModuleInfo = selectedModule
    ? MODULES.find(m => m.name === selectedModule)
    : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f5f5", fontFamily: "var(--font-urbanist), Urbanist, sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 32px" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                backgroundColor: "#fff5e6", color: "#e86700",
              }}>
                PostHog / posthog
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: GREY[900], margin: 0, lineHeight: 1.15 }}>
              Engineering Impact Dashboard
            </h1>
            <p style={{ fontSize: 13, color: GREY[500], margin: "4px 0 0" }}>
              {dateRange} · Code centrality &amp; influence analysis
            </p>
          </div>
          <div style={{ display: "flex", gap: 28, textAlign: "right" }}>
            {[
              { val: data.totalPRs.toLocaleString(), label: "merged PRs" },
              { val: ((data as unknown as Record<string, number>).prsWithFileData ?? 0).toLocaleString(), label: "with file data" },
              { val: data.totalEngineers, label: "contributors" },
            ].map(({ val, label }) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: GREY[900] }}>{val}</div>
                <div style={{ fontSize: 11, color: GREY[500] }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Module Filter ───────────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 12,
          border: `1.5px solid ${GREY[200]}`, padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 20, marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: GREY[700], marginBottom: 6 }}>
              Focus on a module
            </div>
            <ModuleCombobox value={selectedModule} onChange={setSelectedModule} />
          </div>
          <div style={{ flex: 1 }}>
            {selectedModule ? (
              <div style={{
                backgroundColor: "#edf2ff", borderRadius: 8, padding: "10px 14px",
                border: `1px solid #c0d1ff`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 2 }}>
                  {selectedModule}/
                </div>
                <div style={{ fontSize: 11, color: GREY[600] }}>
                  {selectedModuleInfo?.prCount ?? 0} PRs &nbsp;·&nbsp;
                  {selectedModuleInfo?.fileCount ?? 0} files &nbsp;·&nbsp;
                  {selectedModuleInfo?.uniqueEngineers ?? 0} engineers &nbsp;—&nbsp;
                  scores below reflect only work in this module
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: GREY[500], margin: 0 }}>
                Select a module to see who&apos;s most impactful in that specific part of the codebase.
                Scores update live — useful for understanding per-area ownership.
              </p>
            )}
          </div>
        </div>

        {/* ── Top 5 Cards ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Top 5 Most Impactful Engineers {selectedModule ? `· ${selectedModule}/` : "· All Modules"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {top5.map((eng, i) => (
              <EngineerCard
                key={eng.login}
                engineer={eng}
                rank={i + 1}
                selected={selectedIdx === i}
                module={selectedModule}
                onClick={() => setSelectedLogin(eng.login)}
              />
            ))}
          </div>
        </div>

        {/* ── Charts + Detail ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "span 2", backgroundColor: "#fff", borderRadius: 12, border: `1.5px solid ${GREY[200]}`, padding: 20 }}>
            <DimensionChart engineers={top5} module={selectedModule} />
          </div>
          <div>
            <p style={{ fontSize: 10, color: GREY[500], margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Selected · click a card above
            </p>
            {selectedEngineer && (
              <EngineerDetail engineer={selectedEngineer} module={selectedModule} />
            )}
          </div>
        </div>

        {/* ── Methodology ─────────────────────────────────────────────────────── */}
        <MethodologyPanel />

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 11, color: GREY[500] }}>
          <span>Source: GitHub API (PostHog/posthog) · Generated {new Date(data.generatedAt).toLocaleString()}</span>
          <span>Bots excluded · Minimum 2 PRs or 5 files to qualify</span>
        </div>
      </div>
    </div>
  );
}

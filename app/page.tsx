"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import data from "./data.json";

type Engineer = (typeof data.top5)[0];

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07"];
const MONTH_LABELS: Record<string, string> = {
  "2026-04": "Apr",
  "2026-05": "May",
  "2026-06": "Jun",
  "2026-07": "Jul",
};

const COLORS = {
  shipping: "#2563eb",
  review: "#7c3aed",
  collab: "#059669",
  accent: "#2563eb",
};

const DIM_INFO = {
  shipping: {
    label: "Shipping",
    weight: "35%",
    desc: "Merged PRs weighted by complexity (√files × log-scaled LOC). Rewards meaningful scope without over-counting auto-generated code.",
  },
  review: {
    label: "Reviewing",
    weight: "35%",
    desc: "Review comments left on others' PRs plus approvals (0.5×). Rewards substantive code review, not just rubber-stamping.",
  },
  collab: {
    label: "Enabling",
    weight: "30%",
    desc: "Unique teammates' PRs they reviewed. Rewards breadth — engineers who unblock many people vs. ones who only review a few.",
  },
};

function ScoreBar({
  value,
  color,
  max = 100,
}: {
  value: number;
  color: string;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

function EngineerCard({
  engineer,
  rank,
  selected,
  onClick,
}: {
  engineer: Engineer;
  rank: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all cursor-pointer w-full ${
        selected
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={engineer.avatarUrl}
            alt={engineer.login}
            className="w-10 h-10 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${engineer.login}&size=40`;
            }}
          />
          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center font-bold">
            {rank}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">
            {engineer.login}
          </div>
          <div className="text-2xl font-bold text-gray-900 leading-tight">
            {engineer.impactScore}
            <span className="text-xs font-normal text-gray-400 ml-1">/ 100</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
            <span>Shipping</span>
          </div>
          <ScoreBar value={engineer.shippingScore} color={COLORS.shipping} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
            <span>Reviewing</span>
          </div>
          <ScoreBar value={engineer.reviewScore} color={COLORS.review} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
            <span>Enabling</span>
          </div>
          <ScoreBar value={engineer.collabScore} color={COLORS.collab} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-sm font-bold text-gray-800">{engineer.mergedPRCount}</div>
          <div className="text-[10px] text-gray-500">PRs merged</div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">{engineer.reviewCommentCount}</div>
          <div className="text-[10px] text-gray-500">review comments</div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">{engineer.uniqueAuthorsHelped}</div>
          <div className="text-[10px] text-gray-500">devs enabled</div>
        </div>
      </div>
    </button>
  );
}

function DimensionBreakdownChart({ engineers }: { engineers: Engineer[] }) {
  const chartData = engineers.map((e) => ({
    name: e.login,
    Shipping: e.shippingScore,
    Reviewing: e.reviewScore,
    Enabling: e.collabScore,
  }));

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Impact Dimension Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar dataKey="Shipping" fill={COLORS.shipping} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Reviewing" fill={COLORS.review} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Enabling" fill={COLORS.collab} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VelocityChart({ engineers }: { engineers: Engineer[] }) {
  const chartData = MONTHS.map((m) => {
    const row: Record<string, string | number> = { month: MONTH_LABELS[m] };
    for (const e of engineers) {
      row[e.login] = (e.monthlyPRs as Record<string, number>)[m] ?? 0;
    }
    return row;
  });

  const ENG_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626"];

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Monthly PR Velocity
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={chartData}
          margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          {engineers.map((e, i) => (
            <Line
              key={e.login}
              type="monotone"
              dataKey={e.login}
              stroke={ENG_COLORS[i]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SelectedDetail({ engineer }: { engineer: Engineer }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-center gap-3 mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={engineer.avatarUrl}
          alt={engineer.login}
          className="w-8 h-8 rounded-full"
        />
        <div>
          <a
            href={`https://github.com/${engineer.login}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-blue-700 hover:underline text-sm"
          >
            @{engineer.login}
          </a>
          <div className="text-xs text-gray-500">
            Impact Score: <strong>{engineer.impactScore}</strong>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600 space-y-1.5">
        <div className="font-medium text-gray-700 mb-1">Why they&apos;re impactful:</div>
        <ul className="space-y-1 list-disc list-inside">
          {engineer.shippingScore > 50 && (
            <li>
              Shipped <strong>{engineer.mergedPRCount} PRs</strong> — among the
              highest delivery volume, weighted by change complexity
              (complexity score: {engineer.shippingWeight})
            </li>
          )}
          {engineer.reviewScore > 30 && (
            <li>
              Left <strong>{engineer.reviewCommentCount} review comments</strong> and{" "}
              <strong>{engineer.approvalCount} approvals</strong> on teammates&apos; work
            </li>
          )}
          {engineer.collabScore > 60 && (
            <li>
              Reviewed PRs from <strong>{engineer.uniqueAuthorsHelped} unique engineers</strong>{" "}
              — broad collaboration across the team
            </li>
          )}
          {engineer.shippingScore <= 50 &&
            engineer.reviewScore <= 30 &&
            engineer.collabScore <= 60 && (
              <li>
                Balanced contributions across all three dimensions — ships code,
                reviews teammates&apos; work, and collaborates broadly
              </li>
            )}
        </ul>

        {engineer.samplePRTitles.length > 0 && (
          <div className="mt-2">
            <div className="font-medium text-gray-700 mb-1">Sample PRs:</div>
            <ul className="space-y-0.5">
              {engineer.samplePRTitles.map((title, i) => (
                <li key={i} className="text-gray-500 italic truncate">
                  &ldquo;{title}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const top5 = data.top5 as Engineer[];
  const selected = top5[selectedIdx];

  const since = new Date(data.since + "T00:00:00");
  const until = new Date(data.until + "T00:00:00");
  const dateRange = `${since.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                PostHog / posthog
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Engineering Impact Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{dateRange}</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xl font-bold text-gray-900">
                {data.totalPRs.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">merged PRs analyzed</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">
                {data.totalEngineers}
              </div>
              <div className="text-xs text-gray-500">contributors</div>
            </div>
          </div>
        </div>

        {/* Methodology strip */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              What &ldquo;Impact&rdquo; means here
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(DIM_INFO) as [keyof typeof DIM_INFO, typeof DIM_INFO.shipping][]).map(
              ([key, info]) => (
                <div key={key} className="flex gap-3">
                  <div
                    className="w-1 flex-shrink-0 rounded-full mt-0.5"
                    style={{
                      backgroundColor:
                        COLORS[key as keyof typeof COLORS],
                      minHeight: 40,
                    }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-700">
                      {info.label}{" "}
                      <span className="font-normal text-gray-400">
                        ({info.weight})
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {info.desc}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Top 5 cards */}
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Top 5 Most Impactful Engineers
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {top5.map((e, i) => (
              <EngineerCard
                key={e.login}
                engineer={e}
                rank={i + 1}
                selected={selectedIdx === i}
                onClick={() => setSelectedIdx(i)}
              />
            ))}
          </div>
        </div>

        {/* Charts + Detail */}
        <div className="grid grid-cols-12 gap-4">
          {/* Dimension breakdown chart */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-200 p-4">
            <DimensionBreakdownChart engineers={top5} />
          </div>

          {/* Velocity chart */}
          <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-4">
            <VelocityChart engineers={top5} />
          </div>

          {/* Selected engineer detail */}
          <div className="col-span-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Selected Profile
            </h3>
            <SelectedDetail engineer={selected} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-xs text-gray-400 flex justify-between items-center">
          <span>
            Source: GitHub API (PostHog/posthog) · Generated{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </span>
          <span>
            Bots excluded · Min. threshold: 2 PRs or 3 reviews
          </span>
        </div>
      </div>
    </div>
  );
}

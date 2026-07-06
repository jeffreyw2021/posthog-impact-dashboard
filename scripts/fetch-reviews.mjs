#!/usr/bin/env node
/**
 * Step 2.5: Fetch PR review activity in the last 90 days.
 *
 * Two signals:
 *   1. Inline review comments  — GET /repos/PostHog/posthog/pulls/comments (bulk, paginated)
 *   2. Approval reviews        — batched GraphQL (100 PRs per request) for APPROVED / CHANGES_REQUESTED
 *
 * Self-reviews are excluded (commenter == PR author).
 * Bots are excluded.
 *
 * Writes: scripts/reviews-raw.json
 * Schema: { login: string; reviewComments: number; approvals: number }[]
 */

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prsPath    = join(__dirname, 'prs-raw.json');
const outPath    = join(__dirname, 'reviews-raw.json');

const SINCE_DAYS = 90;
const since = new Date();
since.setDate(since.getDate() - SINCE_DAYS);
const sinceStr = since.toISOString();

// ─── Bot filtering (mirrors fetch-prs.mjs) ───────────────────────────────────
const BOT_PATTERNS = [
  /\[bot\]$/i, /-bot$/i, /-app$/i, /-apps$/i, /-ai$/i,
  /^copilot-/i, /^dependabot/i, /^renovate/i, /^github-actions/i,
  /^stale$/i, /^netlify$/i, /^vercel$/i, /^snyk/i, /^semantic-release/i,
  /^mergify/i, /^linear$/i, /^codecov/i, /^chatgpt/i, /^graphite-/i,
  /^hex-/i, /^greptile/i, /^veria/i, /^stamphog$/i, /^sweep-ai/i,
];
const SKIP_ACCOUNTS = new Set(['posthog', 'stamphog']);
function isBot(login) {
  if (!login) return true;
  if (SKIP_ACCOUNTS.has(login)) return true;
  return BOT_PATTERNS.some(p => p.test(login));
}

// ─── Load PR meta (for self-review detection + week keys) ────────────────────
if (!existsSync(prsPath)) {
  console.error('prs-raw.json not found. Run fetch-prs.mjs first.');
  process.exit(1);
}
const { prs } = JSON.parse(readFileSync(prsPath, 'utf8'));
// Store author + mergedAt so approvals can be bucketed by the PR's merge week
const prMetaByNumber = new Map(prs.map(p => [p.number, { author: p.author, mergedAt: p.mergedAt }]));

function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay() || 7; // Mon=1…Sun=7
  d.setUTCDate(d.getUTCDate() + 1 - day); // snap to Monday
  return d.toISOString().slice(0, 10);
}

// review tally
const reviewMap = new Map(); // login → { reviewComments, approvals, weeklyActivity }
function tally(login, field, weekKey) {
  if (isBot(login)) return;
  if (!reviewMap.has(login)) reviewMap.set(login, { reviewComments: 0, approvals: 0, weeklyActivity: new Map() });
  const entry = reviewMap.get(login);
  entry[field]++;
  if (weekKey) {
    if (!entry.weeklyActivity.has(weekKey)) entry.weeklyActivity.set(weekKey, { comments: 0, approvals: 0 });
    const wk = entry.weeklyActivity.get(weekKey);
    wk[field === 'reviewComments' ? 'comments' : 'approvals']++;
  }
}

// ─── 1. Bulk review comments ─────────────────────────────────────────────────
console.log(`Fetching inline review comments since ${sinceStr.slice(0, 10)}…`);

let page = 1;
let totalComments = 0;
while (true) {
  const raw = execFileSync('gh', [
    'api',
    `repos/PostHog/posthog/pulls/comments?since=${sinceStr}&per_page=100&page=${page}&direction=asc`,
  ], { maxBuffer: 50 * 1024 * 1024 }).toString();
  const batch = JSON.parse(raw);
  if (!batch.length) break;

  for (const c of batch) {
    const reviewer = c.user?.login;
    if (!reviewer || isBot(reviewer)) continue;
    // Extract PR number from pull_request_url: ".../pulls/12345"
    const prNum = Number(c.pull_request_url?.split('/pulls/')[1]);
    const prMeta = prMetaByNumber.get(prNum);
    if (reviewer === prMeta?.author) continue; // skip self-review
    const weekKey = getWeekKey(c.created_at); // exact review timestamp
    tally(reviewer, 'reviewComments', weekKey);
  }
  totalComments += batch.length;
  process.stdout.write(`\r  comments fetched: ${totalComments}   `);
  if (batch.length < 100) break;
  page++;
}
console.log(`\n  → ${totalComments} raw comments processed`);

// ─── 2. Approval reviews (batched GraphQL, 100 PRs per query) ─────────────────
console.log('Fetching approval reviews via batched GraphQL…');
const prNumbers = prs.map(p => p.number);
const BATCH = 100;
let approvalCount = 0;

for (let i = 0; i < prNumbers.length; i += BATCH) {
  const batch = prNumbers.slice(i, i + BATCH);
  const fields = batch.map(n =>
    `pr${n}: pullRequest(number: ${n}) { author { login } reviews(first: 50, states: [APPROVED, CHANGES_REQUESTED]) { nodes { author { login } state } } }`
  ).join('\n');

  const query = `{ repository(owner: "PostHog", name: "posthog") {\n${fields}\n} }`;
  let result;
  try {
    const raw = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
      maxBuffer: 10 * 1024 * 1024,
    }).toString();
    result = JSON.parse(raw);
  } catch {
    continue;
  }
  const repo = result?.data?.repository || {};
  for (const prNum of batch) {
    const prData = repo[`pr${prNum}`];
    if (!prData) continue;
    const prAuthor = prData.author?.login;
    // Use PR merge date as week proxy for approvals (no separate review timestamp in this query)
    const weekKey = getWeekKey(prMetaByNumber.get(prNum)?.mergedAt);
    for (const review of prData.reviews?.nodes || []) {
      const reviewer = review.author?.login;
      if (!reviewer || reviewer === prAuthor || isBot(reviewer)) continue;
      tally(reviewer, 'approvals', weekKey);
      approvalCount++;
    }
  }
  process.stdout.write(`\r  batches done: ${Math.floor(i / BATCH) + 1}/${Math.ceil(prNumbers.length / BATCH)}  approvals: ${approvalCount}   `);
}
console.log('\n  → approval reviews processed');

// ─── Output ───────────────────────────────────────────────────────────────────
const output = [...reviewMap.entries()]
  .map(([login, v]) => ({
    login,
    reviewComments: v.reviewComments,
    approvals: v.approvals,
    // Serialize weeklyActivity Map → plain object sorted by week key
    weeklyActivity: Object.fromEntries([...v.weeklyActivity.entries()].sort()),
  }))
  .sort((a, b) => (b.reviewComments + b.approvals * 0.5) - (a.reviewComments + a.approvals * 0.5));

writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nSaved ${output.length} reviewers to ${outPath}`);
console.log('Top 5 reviewers:');
output.slice(0, 5).forEach((r, i) =>
  console.log(`  ${i + 1}. ${r.login}: ${r.reviewComments} comments + ${r.approvals} approvals`)
);

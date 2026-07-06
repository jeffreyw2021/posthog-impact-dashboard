#!/usr/bin/env node
/**
 * Fetches PostHog GitHub data for the last 90 days and computes
 * multi-dimensional engineer impact scores.
 *
 * Impact Philosophy:
 *   Real impact = shipping code + enabling others to ship + doing it consistently
 *
 * Dimensions:
 *   1. SHIPPING (35%) — Merged PRs weighted by complexity (file count, not raw LOC)
 *   2. REVIEWING (35%) — Review thoroughness: comments left on others' PRs, not just approvals
 *   3. COLLABORATION (30%) — How many unique teammates they enabled to ship
 *
 * We deliberately avoid:
 *   - Raw LOC (trivially gamed, auto-generated code, reformatting)
 *   - Commit count (rebases, fixups, merge commits distort this)
 *   - Self-reviews or bot accounts
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SINCE_DAYS = 90;
const SINCE = new Date();
SINCE.setDate(SINCE.getDate() - SINCE_DAYS);
const SINCE_DATE = SINCE.toISOString().substring(0, 10);

// Bot/app/automated account patterns
function isBot(login) {
  if (!login) return true;
  const lower = login.toLowerCase();
  // Exact known bots
  const knownBots = new Set([
    'dependabot', 'renovate', 'github-actions', 'posthog-bot',
    'semantic-release-bot', 'stale', 'netlify', 'vercel', 'snyk-bot',
    'mergify', 'linear', 'copilot', 'coderabbitai', 'codecov',
    'stamphog', 'posthog-heroku',
  ]);
  const base = lower.replace(/\[bot\]$/, '').replace(/-bot$/, '');
  if (knownBots.has(lower) || knownBots.has(base)) return true;
  // Pattern-based: ends with common bot suffixes
  if (lower.endsWith('[bot]')) return true;
  if (lower.endsWith('-bot')) return true;
  if (lower.endsWith('-app') && !lower.includes('webapp')) return true;
  if (lower.endsWith('-apps')) return true;
  if (lower.endsWith('-ai') && lower !== 'veria-ai') return true; // 'veria-ai' seems like a real account? Let's still filter pattern-based
  // '-ai' suffix is usually a bot
  if (lower.endsWith('-ai')) return true;
  return false;
}

function ghGraphQL(query) {
  const result = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
    maxBuffer: 50 * 1024 * 1024,
    encoding: 'utf8'
  });
  return JSON.parse(result);
}

// Generate weekly date ranges for the last 90 days
function getWeeklyRanges() {
  const ranges = [];
  const end = new Date();
  let rangeEnd = new Date(end);

  while (rangeEnd > SINCE) {
    let rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeStart.getDate() - 14); // 2-week chunks
    if (rangeStart < SINCE) rangeStart = new Date(SINCE);

    ranges.push({
      from: rangeStart.toISOString().substring(0, 10),
      to: rangeEnd.toISOString().substring(0, 10),
    });

    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() - 1);
  }

  return ranges;
}

async function fetchPRsForRange(from, to) {
  const prs = [];
  let cursor = null;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';

    const query = `{
      search(
        query: "repo:PostHog/posthog is:pr is:merged merged:${from}..${to}",
        type: ISSUE,
        first: 100
        ${afterClause}
      ) {
        issueCount
        nodes {
          ... on PullRequest {
            number
            title
            author { login }
            mergedAt
            additions
            deletions
            changedFiles
            labels(first: 10) { nodes { name } }
            reviews(first: 50) {
              nodes {
                author { login }
                state
                submittedAt
                comments { totalCount }
              }
            }
            comments(first: 1) { totalCount }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const resp = ghGraphQL(query);
    const search = resp.data.search;

    for (const pr of search.nodes) {
      if (pr.mergedAt) prs.push(pr);
    }

    if (!search.pageInfo.hasNextPage) break;
    cursor = search.pageInfo.endCursor;
  }

  return prs;
}

async function fetchAllMergedPRs() {
  const ranges = getWeeklyRanges();
  console.log(`Fetching in ${ranges.length} date chunks...`);

  const allPRs = [];
  const seenPRs = new Set();

  for (const { from, to } of ranges) {
    process.stdout.write(`  ${from} → ${to}...`);
    const prs = await fetchPRsForRange(from, to);
    let added = 0;
    for (const pr of prs) {
      if (!seenPRs.has(pr.number)) {
        seenPRs.add(pr.number);
        allPRs.push(pr);
        added++;
      }
    }
    process.stdout.write(` ${added} PRs (total: ${allPRs.length})\n`);
  }

  return allPRs;
}

function computeShippingWeight(pr) {
  // Weight = sqrt(changedFiles) * (1 + log10(1 + max(additions, deletions)/100))
  // Rewards meaningful changes but dampens extreme LOC outliers (auto-generated files, etc.)
  const files = Math.max(1, pr.changedFiles || 1);
  const loc = Math.max(pr.additions || 0, pr.deletions || 0);
  return Math.sqrt(files) * (1 + Math.log10(1 + loc / 100));
}

function processData(prs) {
  const engineers = new Map();

  function getOrCreate(login) {
    if (!engineers.has(login)) {
      engineers.set(login, {
        login,
        mergedPRs: [],
        reviewsGiven: [],
        reviewCommentCount: 0,
        approvalCount: 0,
        uniqueAuthorsHelped: new Set(),
        shippingWeight: 0,
        monthlyPRs: {},
        topLabels: {},
        prTitles: [],
      });
    }
    return engineers.get(login);
  }

  for (const pr of prs) {
    const authorLogin = pr.author?.login;
    if (!authorLogin || isBot(authorLogin)) continue;

    const author = getOrCreate(authorLogin);
    author.mergedPRs.push(pr.number);
    author.prTitles.push(pr.title);
    author.shippingWeight += computeShippingWeight(pr);

    const month = pr.mergedAt.substring(0, 7);
    author.monthlyPRs[month] = (author.monthlyPRs[month] || 0) + 1;

    for (const label of (pr.labels?.nodes || [])) {
      author.topLabels[label.name] = (author.topLabels[label.name] || 0) + 1;
    }

    // Process reviews — only count reviews by other humans
    const seenReviewers = new Set();
    for (const review of (pr.reviews?.nodes || [])) {
      const reviewerLogin = review.author?.login;
      if (!reviewerLogin || isBot(reviewerLogin) || reviewerLogin === authorLogin) continue;

      const reviewer = getOrCreate(reviewerLogin);

      if (!seenReviewers.has(reviewerLogin)) {
        reviewer.uniqueAuthorsHelped.add(authorLogin);
        reviewer.reviewsGiven.push({ prNumber: pr.number, prAuthor: authorLogin, state: review.state });
        seenReviewers.add(reviewerLogin);
      }

      reviewer.reviewCommentCount += review.comments?.totalCount || 0;
      if (review.state === 'APPROVED') reviewer.approvalCount++;
    }
  }

  return engineers;
}

function normalizeScores(engineers, totalPRs) {
  const values = [...engineers.values()].filter(e =>
    e.mergedPRs.length >= 2 || e.reviewsGiven.length >= 3
  );

  const maxShipping = Math.max(...values.map(e => e.shippingWeight)) || 1;
  const maxReview = Math.max(...values.map(e => e.reviewCommentCount + e.approvalCount * 0.5)) || 1;
  const maxCollab = Math.max(...values.map(e => e.uniqueAuthorsHelped.size)) || 1;

  return values.map(e => {
    const shippingScore = e.shippingWeight / maxShipping;
    const reviewRaw = e.reviewCommentCount + e.approvalCount * 0.5;
    const reviewScore = reviewRaw / maxReview;
    const collabScore = e.uniqueAuthorsHelped.size / maxCollab;

    const impactScore = (shippingScore * 0.35 + reviewScore * 0.35 + collabScore * 0.30) * 100;

    // What pct of total PRs did they author
    const prShare = ((e.mergedPRs.length / totalPRs) * 100).toFixed(1);

    return {
      login: e.login,
      avatarUrl: `https://github.com/${e.login}.png?size=64`,
      impactScore: Math.round(impactScore * 10) / 10,
      shippingScore: Math.round(shippingScore * 100 * 10) / 10,
      reviewScore: Math.round(reviewScore * 100 * 10) / 10,
      collabScore: Math.round(collabScore * 100 * 10) / 10,
      mergedPRCount: e.mergedPRs.length,
      reviewCommentCount: e.reviewCommentCount,
      approvalCount: e.approvalCount,
      uniqueAuthorsHelped: e.uniqueAuthorsHelped.size,
      shippingWeight: Math.round(e.shippingWeight * 10) / 10,
      prShare,
      monthlyPRs: e.monthlyPRs,
      topLabels: Object.entries(e.topLabels)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      samplePRTitles: e.prTitles.slice(0, 3),
      rawReviewComments: e.reviewCommentCount,
      rawApprovals: e.approvalCount,
    };
  });
}

async function main() {
  console.log('=== PostHog Engineering Impact Data Fetcher ===');
  console.log(`Date range: ${SINCE_DATE} → ${new Date().toISOString().substring(0, 10)}\n`);

  const prs = await fetchAllMergedPRs();
  console.log(`\nTotal merged PRs in window: ${prs.length}`);

  const engineers = processData(prs);
  const scored = normalizeScores(engineers, prs.length);
  scored.sort((a, b) => b.impactScore - a.impactScore);

  const output = {
    generatedAt: new Date().toISOString(),
    since: SINCE_DATE,
    until: new Date().toISOString().substring(0, 10),
    totalPRs: prs.length,
    totalEngineers: scored.length,
    top5: scored.slice(0, 5),
    all: scored.slice(0, 25),
  };

  const outPath = join(__dirname, '..', 'src', 'app', 'data.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log('\nTop 15 by impact:');
  scored.slice(0, 15).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.login}: ${e.impactScore} (PRs:${e.mergedPRCount} ship:${e.shippingScore} review:${e.reviewScore} collab:${e.collabScore})`);
  });
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Step 1: Fetch all merged PRs from PostHog/posthog in the last 90 days.
 * Saves prs-raw.json — PR numbers, authors, dates, and file counts.
 * Uses date-chunked GraphQL search to stay under the 1000-result limit.
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SINCE_DAYS = 90;
const SINCE = new Date();
SINCE.setDate(SINCE.getDate() - SINCE_DAYS);

const BOT_PATTERNS = [
  /\[bot\]$/i, /-bot$/i, /-app$/i, /-apps$/i, /-ai$/i,
  /^copilot-/i, /^dependabot/i, /^renovate/i, /^github-actions/i,
  /^stale$/i, /^netlify$/i, /^vercel$/i, /^snyk/i, /^semantic-release/i,
  /^mergify/i, /^linear$/i, /^codecov/i, /^chatgpt/i, /^graphite-/i,
  /^hex-/i, /^greptile/i, /^veria/i, /^stamphog$/i, /^coderabbitai/i,
  /^sweep-ai$/i, /^cursor-ai$/i, /^devin-ai$/i,
];

function isBot(login) {
  if (!login) return true;
  return BOT_PATTERNS.some(p => p.test(login));
}

function ghGraphQL(query) {
  const result = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
    maxBuffer: 50 * 1024 * 1024, encoding: 'utf8'
  });
  return JSON.parse(result);
}

function getChunks() {
  const chunks = [];
  let end = new Date();
  while (end > SINCE) {
    let start = new Date(end);
    start.setDate(start.getDate() - 14);
    if (start < SINCE) start = new Date(SINCE);
    chunks.push({
      from: start.toISOString().substring(0, 10),
      to: end.toISOString().substring(0, 10),
    });
    end = new Date(start);
    end.setDate(end.getDate() - 1);
  }
  return chunks;
}

async function fetchChunk(from, to) {
  const prs = [];
  let cursor = null;
  while (true) {
    const after = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      search(query: "repo:PostHog/posthog is:pr is:merged merged:${from}..${to}", type: ISSUE, first: 100 ${after}) {
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
            labels(first: 5) { nodes { name } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const resp = ghGraphQL(query);
    const s = resp.data.search;
    for (const pr of s.nodes) {
      if (pr.mergedAt && pr.author?.login && !isBot(pr.author.login)) {
        prs.push({
          number: pr.number,
          title: pr.title,
          author: pr.author.login,
          mergedAt: pr.mergedAt,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          labels: (pr.labels?.nodes || []).map(l => l.name),
        });
      }
    }
    if (!s.pageInfo.hasNextPage) break;
    cursor = s.pageInfo.endCursor;
  }
  return prs;
}

async function main() {
  console.log('=== Step 1: Fetch PR list ===');
  const chunks = getChunks();
  const allPRs = [];
  const seen = new Set();

  for (const { from, to } of chunks) {
    process.stdout.write(`  ${from} → ${to}...`);
    const prs = await fetchChunk(from, to);
    let added = 0;
    for (const pr of prs) {
      if (!seen.has(pr.number)) {
        seen.add(pr.number);
        allPRs.push(pr);
        added++;
      }
    }
    process.stdout.write(` ${added} PRs (total: ${allPRs.length})\n`);
  }

  const out = join(__dirname, '..', 'scripts', 'prs-raw.json');
  writeFileSync(out, JSON.stringify({ prs: allPRs, since: SINCE.toISOString().substring(0, 10), until: new Date().toISOString().substring(0, 10) }, null, 2));
  console.log(`\nSaved ${allPRs.length} PRs to ${out}`);
}

main().catch(console.error);

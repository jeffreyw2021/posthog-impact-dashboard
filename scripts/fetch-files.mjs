#!/usr/bin/env node
/**
 * Step 2: For each PR, fetch the list of files changed via GitHub REST API.
 * Reads prs-raw.json, writes files-raw.json.
 *
 * Strategy: Process PRs sorted by changedFiles desc (most complex first).
 * Stops after MAX_PRS or if rate limit is running low.
 * Saves progress incrementally — safe to re-run.
 */

import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_PRS = 3000;       // Stop after this many to stay within rate limits
const CONCURRENCY = 5;      // Parallel REST requests
const RATE_LIMIT_BUFFER = 200; // Stop if fewer than this many requests remain

const prsPath = join(__dirname, 'prs-raw.json');
const filesPath = join(__dirname, 'files-raw.json');

function ghRest(path) {
  const result = execFileSync('gh', ['api', path, '--paginate'], {
    maxBuffer: 10 * 1024 * 1024, encoding: 'utf8'
  });
  // --paginate concatenates JSON arrays
  try {
    return JSON.parse(result);
  } catch {
    // Sometimes multiple JSON arrays are concatenated; try splitting
    const parts = result.trim().split(/\]\[/).map((p, i, arr) => {
      if (i === 0) return p + ']';
      if (i === arr.length - 1) return '[' + p;
      return '[' + p + ']';
    });
    return parts.flatMap(p => { try { return JSON.parse(p); } catch { return []; } });
  }
}

function checkRateLimit() {
  try {
    const result = execFileSync('gh', ['api', 'rate_limit'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const data = JSON.parse(result);
    return data.resources.core.remaining;
  } catch {
    return Infinity;
  }
}

async function fetchFilesForPR(prNumber) {
  try {
    const files = ghRest(`/repos/PostHog/posthog/pulls/${prNumber}/files`);
    if (!Array.isArray(files)) return [];
    return files.map(f => ({
      path: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status, // added, modified, removed, renamed
    }));
  } catch (e) {
    process.stderr.write(`  Warning: PR #${prNumber} failed: ${e.message}\n`);
    return null; // null = skip, don't retry
  }
}

async function processPool(prs, concurrency) {
  const existing = existsSync(filesPath)
    ? JSON.parse(readFileSync(filesPath, 'utf8'))
    : { files: {}, processedCount: 0 };

  const alreadyDone = new Set(Object.keys(existing.files).map(Number));
  const toProcess = prs
    .sort((a, b) => b.changedFiles - a.changedFiles) // most complex first
    .filter(pr => !alreadyDone.has(pr.number))
    .slice(0, MAX_PRS - alreadyDone.size);

  if (toProcess.length === 0) {
    console.log('All PRs already processed!');
    return existing;
  }

  console.log(`Need to fetch files for ${toProcess.length} PRs (${alreadyDone.size} already done)`);
  console.log(`Processing most complex PRs first (sorted by changedFiles desc)`);

  let i = 0;
  let batch = [];

  async function processOne(pr) {
    const files = await fetchFilesForPR(pr.number);
    if (files !== null) {
      existing.files[pr.number] = { files, author: pr.author, mergedAt: pr.mergedAt };
    }
  }

  while (i < toProcess.length) {
    // Check rate limit every 100 PRs
    if (i % 100 === 0 && i > 0) {
      const remaining = checkRateLimit();
      process.stdout.write(`\n  Rate limit remaining: ${remaining}\n`);
      if (remaining < RATE_LIMIT_BUFFER) {
        console.log('\n⚠️  Rate limit low — stopping early. Re-run later to continue.');
        break;
      }
    }

    // Fill batch
    batch = [];
    for (let j = 0; j < concurrency && i < toProcess.length; j++, i++) {
      batch.push(processOne(toProcess[i]));
    }
    await Promise.all(batch);

    if (i % 50 === 0 || i === toProcess.length) {
      existing.processedCount = Object.keys(existing.files).length;
      writeFileSync(filesPath, JSON.stringify(existing, null, 2));
      process.stdout.write(`\r  Progress: ${existing.processedCount} PRs fetched`);
    }
  }

  existing.processedCount = Object.keys(existing.files).length;
  writeFileSync(filesPath, JSON.stringify(existing, null, 2));
  console.log(`\n\nDone. ${existing.processedCount} PRs with file data saved.`);
  return existing;
}

async function main() {
  console.log('=== Step 2: Fetch file paths per PR ===');

  if (!existsSync(prsPath)) {
    console.error('prs-raw.json not found. Run fetch-prs.mjs first.');
    process.exit(1);
  }

  const { prs } = JSON.parse(readFileSync(prsPath, 'utf8'));
  const remaining = checkRateLimit();
  console.log(`Rate limit: ${remaining} remaining`);
  console.log(`PRs to process: up to ${Math.min(MAX_PRS, prs.length)} of ${prs.length}`);

  await processPool(prs, CONCURRENCY);
}

main().catch(console.error);

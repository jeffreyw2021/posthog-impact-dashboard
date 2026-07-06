#!/usr/bin/env node
/**
 * Step 2: Fetch file paths per PR via GitHub REST API.
 * Uses truly async parallel execution — runs CONCURRENCY requests simultaneously.
 *
 * Reads:  scripts/prs-raw.json
 * Writes: scripts/files-raw.json  (incrementally, resumable)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

const MAX_PRS = 3000;
const CONCURRENCY = 8;
const RATE_LIMIT_BUFFER = 300;
const SAVE_EVERY = 25;

const prsPath = join(__dirname, 'prs-raw.json');
const filesPath = join(__dirname, 'files-raw.json');

async function ghRestAsync(path) {
  try {
    // Use gh api with JSON output; --paginate concatenates pages
    const { stdout } = await execFileAsync('gh', ['api', path, '--paginate', '-H', 'Accept: application/vnd.github+json'], {
      maxBuffer: 20 * 1024 * 1024,
    });
    // GitHub --paginate concatenates JSON arrays: [...][ ...] — merge them
    const clean = stdout.trim().replace(/\]\s*\[/g, ',');
    return JSON.parse(clean);
  } catch (e) {
    return null; // skip this PR
  }
}

async function checkRateLimit() {
  try {
    const { stdout } = await execFileAsync('gh', ['api', 'rate_limit'], { maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout);
    return data.resources.core.remaining;
  } catch {
    return Infinity;
  }
}

async function fetchFilesForPR(prNumber) {
  const data = await ghRestAsync(`/repos/PostHog/posthog/pulls/${prNumber}/files`);
  if (!Array.isArray(data)) return null;
  return data.map(f => ({
    path: f.filename,
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    status: f.status,
  }));
}

async function main() {
  console.log('=== Step 2: Fetch file paths per PR (async parallel) ===');

  if (!existsSync(prsPath)) {
    console.error('prs-raw.json not found. Run fetch-prs.mjs first.');
    process.exit(1);
  }

  const { prs } = JSON.parse(readFileSync(prsPath, 'utf8'));

  // Load existing progress
  const existing = existsSync(filesPath)
    ? JSON.parse(readFileSync(filesPath, 'utf8'))
    : { files: {} };
  const alreadyDone = new Set(Object.keys(existing.files).map(Number));

  const toProcess = prs
    .filter(pr => !alreadyDone.has(pr.number))
    .sort((a, b) => b.changedFiles - a.changedFiles) // most complex first
    .slice(0, MAX_PRS - alreadyDone.size);

  if (toProcess.length === 0) {
    console.log('All PRs already processed!');
    return;
  }

  const remaining = await checkRateLimit();
  console.log(`Rate limit: ${remaining} remaining`);
  console.log(`Processing ${toProcess.length} PRs with ${CONCURRENCY} concurrent requests`);
  console.log(`Already done: ${alreadyDone.size}`);

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process in sliding window of CONCURRENCY
  let i = 0;
  const inFlight = new Set();

  function formatETA() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    if (rate < 0.01) return '...';
    const remaining_ = toProcess.length - processed;
    const etaSec = remaining_ / rate;
    if (etaSec > 60) return `~${Math.round(etaSec / 60)}m remaining`;
    return `~${Math.round(etaSec)}s remaining`;
  }

  async function runOne(pr) {
    const files = await fetchFilesForPR(pr.number);
    if (files !== null) {
      existing.files[pr.number] = { files, author: pr.author, mergedAt: pr.mergedAt };
    } else {
      errors++;
    }
    processed++;
    inFlight.delete(pr.number);

    if (processed % SAVE_EVERY === 0) {
      writeFileSync(filesPath, JSON.stringify(existing));
      process.stdout.write(`\r  ${processed}/${toProcess.length} (${errors} errors) ${formatETA()}     `);

      // Rate limit check
      if (processed % 200 === 0) {
        const rl = await checkRateLimit();
        process.stdout.write(`\n  Rate limit: ${rl} remaining\n`);
        if (rl < RATE_LIMIT_BUFFER) {
          console.log('\n⚠️  Rate limit low — saving and stopping. Re-run to continue.');
          writeFileSync(filesPath, JSON.stringify(existing));
          process.exit(0);
        }
      }
    }
  }

  // Launch sliding window
  while (i < toProcess.length || inFlight.size > 0) {
    // Fill up to CONCURRENCY
    while (i < toProcess.length && inFlight.size < CONCURRENCY) {
      const pr = toProcess[i++];
      inFlight.add(pr.number);
      runOne(pr); // fire and forget (tracked via inFlight)
    }
    // Wait a bit for some to complete
    await new Promise(r => setTimeout(r, 50));
  }

  writeFileSync(filesPath, JSON.stringify(existing));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n\nDone! ${Object.keys(existing.files).length} PRs with file data in ${elapsed}s`);
}

main().catch(console.error);

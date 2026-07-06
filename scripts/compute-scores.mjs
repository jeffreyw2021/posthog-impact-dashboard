#!/usr/bin/env node
/**
 * Step 3: Compute impact scores from file-level contribution data.
 *
 * Impact Model — 5 dimensions, each 0–20 (total 0–100):
 *
 *   CENTRALITY (20pts)
 *     Files that many unique engineers touch are load-bearing shared infrastructure.
 *     Score = Σ (file_unique_authors / max_unique_authors) × (your_additions / file_total_additions)
 *
 *   INFLUENCE (20pts)
 *     Files you were among the first 3 contributors to, that others subsequently built on.
 *     Score = Σ unique_later_authors_on_your_early_files
 *
 *   BREADTH (20pts)
 *     unique_top_level_modules_you_contributed_to / max_any_engineer
 *
 *   SHIPPING (20pts)
 *     Merged PRs weighted by √(filesChanged) × log₁₀(max(additions+deletions, 1)).
 *     Penalizes noise (1-line PRs) while not over-rewarding mass auto-generated changes.
 *
 *   REVIEWING (20pts)
 *     review_comments + 0.5 × approvals on OTHER people's PRs.
 *     Catches engineers who unblock the team but don't appear in commit counts.
 *
 *   MODULE FILTER (pre-computed):
 *     Per-module scores for top 20 modules (Centrality/Influence/Breadth/Shipping are
 *     module-scoped; Reviewing is global and stays constant across filters).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prsPath     = join(__dirname, 'prs-raw.json');
const filesPath   = join(__dirname, 'files-raw.json');
const reviewsPath = join(__dirname, 'reviews-raw.json');
const outPath     = join(__dirname, '..', 'src', 'app', 'data.json');

function getModule(filePath) {
  const parts = filePath.split('/');
  return parts.length === 1 ? '(root)' : parts[0];
}

function main() {
  console.log('=== Step 3: Compute impact scores ===');

  if (!existsSync(prsPath) || !existsSync(filesPath)) {
    console.error('Missing prs-raw.json or files-raw.json. Run fetch scripts first.');
    process.exit(1);
  }
  if (!existsSync(reviewsPath)) {
    console.warn('reviews-raw.json not found — Reviewing dimension will be 0. Run fetch-reviews.mjs first.');
  }

  const { prs, since, until } = JSON.parse(readFileSync(prsPath, 'utf8'));
  const { files: prFiles } = JSON.parse(readFileSync(filesPath, 'utf8'));
  const reviewsRaw = existsSync(reviewsPath)
    ? JSON.parse(readFileSync(reviewsPath, 'utf8'))
    : [];

  // Bot patterns shared with fetch-reviews.mjs
  const REVIEW_BOT_PATTERNS = [
    /\[bot\]$/i, /-bot$/i, /-app$/i, /-apps$/i, /-ai$/i,
    /^copilot/i, /^dependabot/i, /^renovate/i, /^github-actions/i,
    /^stale$/i, /^netlify$/i, /^vercel$/i, /^snyk/i, /^semantic-release/i,
    /^mergify/i, /^linear$/i, /^codecov/i, /^chatgpt/i, /^graphite-/i,
    /^hex-/i, /^greptile/i, /^veria/i, /^stamphog$/i, /^sweep-ai/i,
  ];
  const REVIEW_SKIP = new Set(['posthog', 'stamphog', 'copilot']);
  function isBotReviewer(login) {
    if (REVIEW_SKIP.has(login?.toLowerCase())) return true;
    return REVIEW_BOT_PATTERNS.some(p => p.test(login));
  }

  // reviewing raw score: comments + 0.5 × approvals, keyed by login
  const reviewingByLogin = new Map(
    reviewsRaw
      .filter(r => !isBotReviewer(r.login))
      .map(r => [r.login, r.reviewComments + r.approvals * 0.5])
  );

  const prsByNumber = new Map(prs.map(pr => [pr.number, pr]));

  // Sort PR keys by mergedAt (oldest first) for influence calculation
  const sortedPRKeys = Object.keys(prFiles).sort((a, b) => {
    const dA = prFiles[a]?.mergedAt || '';
    const dB = prFiles[b]?.mergedAt || '';
    return dA.localeCompare(dB);
  });

  // === Build global file map ===
  // fileMap[path] = { totalAdditions, authorMap: Map<login, {additions, firstSeenDate}> }
  const fileMap = new Map();

  for (const key of sortedPRKeys) {
    const prNum = Number(key);
    const { files, author, mergedAt } = prFiles[prNum] || {};
    if (!author || !files?.length) continue;

    for (const file of files) {
      if (!file.path) continue;
      if (!fileMap.has(file.path)) {
        fileMap.set(file.path, { totalAdditions: 0, authorMap: new Map() });
      }
      const fm = fileMap.get(file.path);
      fm.totalAdditions += (file.additions || 0);
      if (!fm.authorMap.has(author)) {
        fm.authorMap.set(author, { additions: 0, firstSeen: mergedAt });
      }
      fm.authorMap.get(author).additions += (file.additions || 0);
    }
  }

  console.log(`Files in dataset: ${fileMap.size}`);

  // === Build engineer profiles ===
  const engineerMap = new Map();
  function getOrCreate(login) {
    if (!engineerMap.has(login)) {
      engineerMap.set(login, {
        login,
        prCount: 0,
        samplePRTitles: [],
        fileContribs: [],
        modules: new Set(),
        shippingRaw: 0,
      });
    }
    return engineerMap.get(login);
  }

  // Populate base PR data (also accumulate shipping weight)
  for (const pr of prs) {
    const e = getOrCreate(pr.author);
    e.prCount++;
    if (e.samplePRTitles.length < 5) e.samplePRTitles.push(pr.title);
    // Shipping: √(changedFiles) × log₁₀(max(additions+deletions, 1))
    const loc = Math.max((pr.additions || 0) + (pr.deletions || 0), 1);
    const files = Math.max(pr.changedFiles || 0, 0);
    e.shippingRaw += Math.sqrt(files) * Math.log10(loc);
  }

  // Populate file contributions
  for (const key of sortedPRKeys) {
    const prNum = Number(key);
    const { files, author, mergedAt } = prFiles[prNum] || {};
    if (!author || !files?.length) continue;
    const e = getOrCreate(author);
    for (const file of files) {
      if (!file.path) continue;
      e.fileContribs.push({ path: file.path, additions: file.additions || 0, mergedAt });
      e.modules.add(getModule(file.path));
    }
  }

  // Filter to engineers with meaningful activity (exclude shared/company accounts)
  const SKIP_ACCOUNTS = new Set(['posthog', 'stamphog']);
  const allEngineers = [...engineerMap.values()].filter(e =>
    !SKIP_ACCOUNTS.has(e.login) && (e.prCount >= 2 || e.fileContribs.length >= 5)
  );
  const totalEngineers = allEngineers.length;
  console.log(`Engineers (≥2 PRs or 5 files): ${totalEngineers}`);

  // === Scoring function for a given file scope ===
  function scoreEngineer(engineer, scopeFiles /* Set<filePath> | null */) {
    const relevant = scopeFiles
      ? engineer.fileContribs.filter(f => scopeFiles.has(f.path))
      : engineer.fileContribs;

    if (relevant.length === 0) return { centralityRaw: 0, influenceRaw: 0, breadthRaw: 0 };

    // For normalization, compute max values across all engineers in this scope
    // (called after computing raw for all, then normalize)

    let centralityRaw = 0;
    for (const { path, additions } of relevant) {
      const fm = fileMap.get(path);
      if (!fm) continue;
      // Weight by unique authors (centrality of file) × your share of additions
      const uniqueAuthors = fm.authorMap.size;
      const totalAdds = Math.max(fm.totalAdditions, 1);
      centralityRaw += uniqueAuthors * Math.min(additions / totalAdds, 1);
    }

    // Influence: files where you were among the first 3 contributors
    let influenceRaw = 0;
    const seenPaths = new Set();
    for (const { path } of relevant) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      const fm = fileMap.get(path);
      if (!fm) continue;
      // Rank this engineer by their firstSeen date among all authors of this file
      const sorted = [...fm.authorMap.entries()].sort((a, b) => a[1].firstSeen.localeCompare(b[1].firstSeen));
      const rank = sorted.findIndex(([l]) => l === engineer.login);
      if (rank >= 0 && rank <= 2) {
        // Count unique authors who came AFTER this engineer
        const laterAuthors = sorted.slice(rank + 1).length;
        influenceRaw += laterAuthors;
      }
    }

    // Breadth in scope
    const scopeModules = scopeFiles
      ? new Set([...relevant].map(f => getModule(f.path)))
      : engineer.modules;
    const breadthRaw = scopeModules.size;

    return { centralityRaw, influenceRaw, breadthRaw };
  }

  // === Global scores ===
  const rawScores = allEngineers.map(e => ({
    e,
    ...scoreEngineer(e, null),
    shippingRaw:  e.shippingRaw,
    reviewingRaw: reviewingByLogin.get(e.login) || 0,
  }));

  const maxC  = Math.max(...rawScores.map(s => s.centralityRaw))  || 1;
  const maxI  = Math.max(...rawScores.map(s => s.influenceRaw))   || 1;
  const maxB  = Math.max(...rawScores.map(s => s.breadthRaw))     || 1;
  const maxSh = Math.max(...rawScores.map(s => s.shippingRaw))    || 1;
  const maxRv = Math.max(...rawScores.map(s => s.reviewingRaw))   || 1;

  const norm20 = (raw, max) => Math.round((raw / max) * 200) / 10; // → 0–20 with 1dp

  const globalScored = rawScores.map(({ e, centralityRaw, influenceRaw, breadthRaw, shippingRaw, reviewingRaw }) => {
    const c  = norm20(centralityRaw,  maxC);
    const inf = norm20(influenceRaw,  maxI);
    const b  = norm20(breadthRaw,     maxB);
    const sh = norm20(shippingRaw,    maxSh);
    const rv = norm20(reviewingRaw,   maxRv);
    return {
      login: e.login,
      avatarUrl: `https://github.com/${e.login}.png?size=64`,
      prCount: e.prCount,
      filesCount: e.fileContribs.length,
      uniqueModules: e.modules.size,
      samplePRTitles: e.samplePRTitles,
      centralityScore: c,
      influenceScore:  inf,
      breadthScore:    b,
      shippingScore:   sh,
      reviewingScore:  rv,
      impactScore: Math.round((c + inf + b + sh + rv) * 10) / 10,
      topFiles: [...new Map(e.fileContribs.map(f => [f.path, f])).values()]
        .map(f => ({
          path: f.path,
          module: getModule(f.path),
          additions: f.additions,
          uniqueAuthors: fileMap.get(f.path)?.authorMap.size || 0,
        }))
        .sort((a, b) => b.uniqueAuthors - a.uniqueAuthors)
        .slice(0, 5),
      moduleList: [...e.modules].sort(),
    };
  }).sort((a, b) => b.impactScore - a.impactScore);

  // === Per-module scores for top modules ===
  // Build module → file set
  const moduleFileSets = new Map();
  for (const [path] of fileMap.entries()) {
    const mod = getModule(path);
    if (!moduleFileSets.has(mod)) moduleFileSets.set(mod, new Set());
    moduleFileSets.get(mod).add(path);
  }

  // Pick top 20 modules by PR activity
  const moduleActivity = new Map();
  for (const key of sortedPRKeys) {
    const { files } = prFiles[key] || {};
    if (!files?.length) continue;
    const mods = new Set(files.filter(f => f.path).map(f => getModule(f.path)));
    for (const mod of mods) {
      moduleActivity.set(mod, (moduleActivity.get(mod) || 0) + 1);
    }
  }

  const topModuleNames = [...moduleActivity.entries()]
    .filter(([name]) => name !== '(root)' && (moduleFileSets.get(name)?.size || 0) >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name]) => name);

  console.log(`Computing per-module scores for: ${topModuleNames.join(', ')}`);

  // Enrich engineers with per-module scores
  // Shipping per-module uses file-level additions from prFiles
  function moduleShippingRaw(engineer, scopeFiles) {
    // sum √(files_in_scope_for_this_pr) × log₁₀(additions_in_scope+1) across engineer's PRs
    let raw = 0;
    for (const key of sortedPRKeys) {
      const prNum = Number(key);
      const { files, author } = prFiles[prNum] || {};
      if (author !== engineer.login || !files?.length) continue;
      const inScope = files.filter(f => f.path && scopeFiles.has(f.path));
      if (!inScope.length) continue;
      const adds = inScope.reduce((s, f) => s + (f.additions || 0), 0);
      raw += Math.sqrt(inScope.length) * Math.log10(Math.max(adds, 1));
    }
    return raw;
  }

  const enriched = globalScored.slice(0, 25).map(eng => {
    const engineer = engineerMap.get(eng.login);
    const moduleScores = {};
    for (const mod of topModuleNames) {
      const scopeFiles = moduleFileSets.get(mod);
      if (!scopeFiles) continue;
      const { centralityRaw, influenceRaw, breadthRaw } = scoreEngineer(engineer, scopeFiles);
      moduleScores[mod] = {
        centralityRaw,
        influenceRaw,
        breadthRaw,
        shippingRaw: moduleShippingRaw(engineer, scopeFiles),
      };
    }
    return { ...eng, moduleScores };
  });

  // For each module, compute normalization factors and resolve scores
  const moduleNorms = {};
  for (const mod of topModuleNames) {
    moduleNorms[mod] = {
      maxC:  Math.max(...enriched.map(e => e.moduleScores[mod]?.centralityRaw || 0)) || 1,
      maxI:  Math.max(...enriched.map(e => e.moduleScores[mod]?.influenceRaw  || 0)) || 1,
      maxB:  Math.max(...enriched.map(e => e.moduleScores[mod]?.breadthRaw    || 0)) || 1,
      maxSh: Math.max(...enriched.map(e => e.moduleScores[mod]?.shippingRaw   || 0)) || 1,
    };
  }

  // Replace raw with normalized 0–20 scores (Reviewing stays global)
  const finalEngineers = enriched.map(eng => {
    const moduleScoresFinal = {};
    for (const mod of topModuleNames) {
      const raw = eng.moduleScores[mod];
      if (!raw) continue;
      const { maxC: mC, maxI: mI, maxB: mB, maxSh: mSh } = moduleNorms[mod];
      const c  = norm20(raw.centralityRaw, mC);
      const i  = norm20(raw.influenceRaw,  mI);
      const b  = norm20(raw.breadthRaw,    mB);
      const sh = norm20(raw.shippingRaw,   mSh);
      const rv = eng.reviewingScore; // global, not module-scoped
      moduleScoresFinal[mod] = {
        centralityScore: c,
        influenceScore:  i,
        breadthScore:    b,
        shippingScore:   sh,
        reviewingScore:  rv,
        impactScore: Math.round((c + i + b + sh + rv) * 10) / 10,
      };
    }
    const { moduleScores: _, ...rest } = eng;
    return { ...rest, moduleScores: moduleScoresFinal };
  });

  // Build module list for autocomplete
  const modules = topModuleNames.map(name => ({
    name,
    fileCount: moduleFileSets.get(name)?.size || 0,
    prCount: moduleActivity.get(name) || 0,
    uniqueEngineers: allEngineers.filter(e => e.modules.has(name)).length,
  }));

  // File centrality reference — top 10 most central files
  const topCentralFiles = [...fileMap.entries()]
    .map(([path, fm]) => ({
      path,
      module: getModule(path),
      uniqueAuthors: fm.authorMap.size,
      totalAdditions: fm.totalAdditions,
      authors: [...fm.authorMap.keys()].slice(0, 5),
    }))
    .filter(f => f.module !== '(root)')
    .sort((a, b) => b.uniqueAuthors - a.uniqueAuthors)
    .slice(0, 15);

  const output = {
    generatedAt: new Date().toISOString(),
    since,
    until,
    totalPRs: prs.length,
    prsWithFileData: Object.keys(prFiles).length,
    totalEngineers: finalEngineers.length,
    modules,
    top5: finalEngineers.slice(0, 5),
    all: finalEngineers,
    topCentralFiles,
    methodology: {
      centrality: { maxPts: 20, description: "Files touched by many unique engineers = load-bearing infrastructure. Score weights your contribution share by file popularity." },
      influence:  { maxPts: 20, description: "Files you contributed to early that others subsequently built on. Captures 'I laid the foundation, others extended it'." },
      breadth:    { maxPts: 20, description: "Unique modules (top-level directories) contributed to. Broad contributors reduce silos and multiply team-wide value." },
      shipping:   { maxPts: 20, description: "Merged PRs weighted by √(filesChanged) × log₁₀(additions+deletions). Rewards genuine scope; penalizes 1-line noise and auto-generated mass changes." },
      reviewing:  { maxPts: 20, description: "Review comments on others' PRs + 0.5× approvals. Catches engineers who unblock the team but don't show up in commit counts." },
    },
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('\nTop 10 engineers:');
  finalEngineers.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i+1}. ${e.login}: ${e.impactScore} (C:${e.centralityScore} I:${e.influenceScore} B:${e.breadthScore} Sh:${e.shippingScore} Rv:${e.reviewingScore}) PRs:${e.prCount} files:${e.filesCount}`);
  });

  console.log(`\nTop modules: ${modules.slice(0, 6).map(m => `${m.name}(${m.prCount})`).join(', ')}`);
  console.log(`\nSaved to ${outPath}`);
}

main();

#!/usr/bin/env node
/**
 * Step 3: Compute impact scores from file-level contribution data.
 *
 * Impact Model:
 *
 *   CENTRALITY (40%)
 *     Files that many unique engineers touch are load-bearing shared infrastructure.
 *     Score = Σ (file_unique_authors / max_unique_authors) × (your_additions / file_total_additions)
 *     This rewards working on high-traffic files in proportion to your contribution.
 *
 *   INFLUENCE (35%)
 *     Files you were among the first 3 contributors to, that others subsequently built on.
 *     Score = Σ unique_later_authors_on_your_early_files / max_unique_authors
 *     Captures "I built it, others kept extending it" — compounding leverage.
 *
 *   BREADTH (25%)
 *     unique_top_level_modules_you_contributed_to / max_any_engineer
 *     Engineers who span the codebase reduce silos and multiply coordination value.
 *
 *   MODULE FILTER (pre-computed):
 *     Per-module scores pre-computed for the top 20 modules.
 *     UI lets engineering leader select a module; scores update instantly.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prsPath = join(__dirname, 'prs-raw.json');
const filesPath = join(__dirname, 'files-raw.json');
const outPath = join(__dirname, '..', 'app', 'data.json');

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

  const { prs, since, until } = JSON.parse(readFileSync(prsPath, 'utf8'));
  const { files: prFiles } = JSON.parse(readFileSync(filesPath, 'utf8'));

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
        // files: [{path, additions, mergedAt, module}]
        fileContribs: [],
        modules: new Set(),
      });
    }
    return engineerMap.get(login);
  }

  // Populate base PR data
  for (const pr of prs) {
    const e = getOrCreate(pr.author);
    e.prCount++;
    if (e.samplePRTitles.length < 3) e.samplePRTitles.push(pr.title);
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
  const rawScores = allEngineers.map(e => ({ e, ...scoreEngineer(e, null) }));
  const maxC = Math.max(...rawScores.map(s => s.centralityRaw)) || 1;
  const maxI = Math.max(...rawScores.map(s => s.influenceRaw)) || 1;
  const maxB = Math.max(...rawScores.map(s => s.breadthRaw)) || 1;

  const globalScored = rawScores.map(({ e, centralityRaw, influenceRaw, breadthRaw }) => {
    const c = (centralityRaw / maxC) * 100;
    const inf = (influenceRaw / maxI) * 100;
    const b = (breadthRaw / maxB) * 100;
    return {
      login: e.login,
      avatarUrl: `https://github.com/${e.login}.png?size=64`,
      prCount: e.prCount,
      filesCount: e.fileContribs.length,
      uniqueModules: e.modules.size,
      samplePRTitles: e.samplePRTitles,
      centralityScore: Math.round(c * 10) / 10,
      influenceScore: Math.round(inf * 10) / 10,
      breadthScore: Math.round(b * 10) / 10,
      impactScore: Math.round((c * 0.40 + inf * 0.35 + b * 0.25) * 10) / 10,
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
  const enriched = globalScored.slice(0, 25).map(eng => {
    const engineer = engineerMap.get(eng.login);
    const moduleScores = {};
    for (const mod of topModuleNames) {
      const scopeFiles = moduleFileSets.get(mod);
      if (!scopeFiles) continue;
      const { centralityRaw, influenceRaw, breadthRaw } = scoreEngineer(engineer, scopeFiles);
      // Store raw (will normalize per-module in UI)
      moduleScores[mod] = { centralityRaw, influenceRaw, breadthRaw };
    }
    return { ...eng, moduleScores };
  });

  // For each module, compute normalization factors and resolve scores
  const moduleNorms = {};
  for (const mod of topModuleNames) {
    const maxC_ = Math.max(...enriched.map(e => e.moduleScores[mod]?.centralityRaw || 0)) || 1;
    const maxI_ = Math.max(...enriched.map(e => e.moduleScores[mod]?.influenceRaw || 0)) || 1;
    const maxB_ = Math.max(...enriched.map(e => e.moduleScores[mod]?.breadthRaw || 0)) || 1;
    moduleNorms[mod] = { maxC: maxC_, maxI: maxI_, maxB: maxB_ };
  }

  // Replace raw with normalized 0-100 scores
  const finalEngineers = enriched.map(eng => {
    const moduleScoresFinal = {};
    for (const mod of topModuleNames) {
      const raw = eng.moduleScores[mod];
      if (!raw) continue;
      const { maxC: mC, maxI: mI, maxB: mB } = moduleNorms[mod];
      const c = (raw.centralityRaw / mC) * 100;
      const i = (raw.influenceRaw / mI) * 100;
      const b = (raw.breadthRaw / mB) * 100;
      moduleScoresFinal[mod] = {
        centralityScore: Math.round(c * 10) / 10,
        influenceScore: Math.round(i * 10) / 10,
        breadthScore: Math.round(b * 10) / 10,
        impactScore: Math.round((c * 0.40 + i * 0.35 + b * 0.25) * 10) / 10,
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
      centrality: { weight: 0.40, description: "Files touched by many unique engineers = load-bearing infrastructure. Score weights your contribution share by file popularity." },
      influence: { weight: 0.35, description: "Files you contributed to early that others subsequently built on. Captures 'I laid the foundation, others extended it'." },
      breadth: { weight: 0.25, description: "Unique modules (top-level directories) contributed to. Broad contributors reduce silos and multiply team-wide value." },
    },
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('\nTop 10 engineers:');
  finalEngineers.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i+1}. ${e.login}: ${e.impactScore} (C:${e.centralityScore} I:${e.influenceScore} B:${e.breadthScore}) PRs:${e.prCount} files:${e.filesCount}`);
  });

  console.log(`\nTop modules: ${modules.slice(0, 6).map(m => `${m.name}(${m.prCount})`).join(', ')}`);
  console.log(`\nSaved to ${outPath}`);
}

main();

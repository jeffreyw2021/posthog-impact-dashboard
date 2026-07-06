#!/usr/bin/env node
// Quick post-processing: filter bots, renormalize, save
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'app', 'data.json');

const BOT_PATTERNS = [
  /\[bot\]$/i, /-bot$/i, /-app$/i, /-apps$/i, /-ai$/i,
  /^copilot-/i, /^dependabot/i, /^renovate/i, /^github-actions/i,
  /^stale$/i, /^netlify$/i, /^vercel$/i, /^snyk/i, /^semantic-release/i,
  /^mergify/i, /^linear$/i, /^codecov/i, /^chatgpt/i, /^graphite-/i,
  /^hex-/i, /^greptile/i, /^veria/i, /^stamphog$/i,
];

function isBot(login) {
  return BOT_PATTERNS.some(p => p.test(login));
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));

// Filter bots from the 'all' list
const humans = data.all.filter(e => !isBot(e.login));
console.log(`After bot filter: ${humans.length} humans (was ${data.all.length})`);

// Renormalize using raw counts stored on each engineer
const maxShipping = Math.max(...humans.map(e => e.shippingWeight)) || 1;
const maxReview = Math.max(...humans.map(e => e.reviewCommentCount + e.approvalCount * 0.5)) || 1;
const maxCollab = Math.max(...humans.map(e => e.uniqueAuthorsHelped)) || 1;

const rescored = humans.map(e => {
  const shippingScore = e.shippingWeight / maxShipping;
  const reviewRaw = e.reviewCommentCount + e.approvalCount * 0.5;
  const reviewScore = reviewRaw / maxReview;
  const collabScore = e.uniqueAuthorsHelped / maxCollab;
  const impactScore = (shippingScore * 0.35 + reviewScore * 0.35 + collabScore * 0.30) * 100;
  return {
    ...e,
    impactScore: Math.round(impactScore * 10) / 10,
    shippingScore: Math.round(shippingScore * 100 * 10) / 10,
    reviewScore: Math.round(reviewScore * 100 * 10) / 10,
    collabScore: Math.round(collabScore * 100 * 10) / 10,
  };
});

rescored.sort((a, b) => b.impactScore - a.impactScore);

console.log('\nTop 10 after reprocessing:');
rescored.slice(0, 10).forEach((e, i) => {
  console.log(`  ${i + 1}. ${e.login}: ${e.impactScore} (PRs:${e.mergedPRCount} ship:${e.shippingScore} review:${e.reviewScore} collab:${e.collabScore})`);
});

const output = {
  ...data,
  generatedAt: new Date().toISOString(),
  top5: rescored.slice(0, 5),
  all: rescored,
};

writeFileSync(dataPath, JSON.stringify(output, null, 2));
console.log('\nSaved.');

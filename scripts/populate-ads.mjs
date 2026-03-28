#!/usr/bin/env node
/**
 * Populate Qdrant with ads collections from assets/ads_dataset.csv
 *
 * Usage:
 *   node scripts/populate-ads.mjs
 *
 * Env vars (or .env in repo root):
 *   GOOGLE_API_KEY  – Gemini API key
 *   QDRANT_URL      – Qdrant endpoint (default http://localhost:6333)
 *   DIMENSIONS      – embedding dimensions (default 3072)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load .env from dashboard/.env (same keys the app uses) ──────────
function loadEnv() {
  for (const envPath of [
    resolve(ROOT, 'dashboard/.env'),
    resolve(ROOT, '.env'),
  ]) {
    try {
      const lines = readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}
loadEnv();

const API_KEY = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || '';
const QDRANT_URL = process.env.VITE_QDRANT_URL || process.env.QDRANT_URL || 'http://localhost:6333';
const DIMENSIONS = Number(process.env.DIMENSIONS) || 3072;
const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

if (!API_KEY) {
  console.error('ERROR: No API key found. Set GOOGLE_API_KEY or VITE_GOOGLE_API_KEY in .env');
  process.exit(1);
}

// ── Parse CSV ───────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple quoted-CSV parse
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);
    if (cols.length >= 5) {
      rows.push({
        id: cols[0],
        category: cols[1],
        title: cols[2],
        description: cols[3],
        filename: cols[4],
      });
    }
  }
  return rows;
}

// ── Embed text via Gemini ───────────────────────────────────────────
async function embedText(text) {
  const res = await fetch(`${EMBED_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: DIMENSIONS,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.embedding.values;
}

// ── Qdrant helpers ──────────────────────────────────────────────────
async function deleteCollectionIfExists(name) {
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) {
    await fetch(`${QDRANT_URL}/collections/${name}`, { method: 'DELETE' });
    console.log(`  Deleted existing collection: ${name}`);
  }
}

async function createCollection(name) {
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: DIMENSIONS, distance: 'Cosine' } }),
  });
  if (!res.ok) throw new Error(`Create collection failed: ${await res.text()}`);
  console.log(`  Created collection: ${name} (${DIMENSIONS}d)`);
}

async function upsertPoints(collectionName, points) {
  const res = await fetch(`${QDRANT_URL}/collections/${collectionName}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Upsert failed: ${await res.text()}`);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`Qdrant: ${QDRANT_URL}`);
  console.log(`Dimensions: ${DIMENSIONS}`);
  console.log(`Model: ${EMBED_MODEL}\n`);

  // Read CSV
  const csvPath = resolve(ROOT, 'assets/ads_dataset.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csv);
  console.log(`Loaded ${rows.length} ads from CSV\n`);

  // Group by category
  const groups = {};
  for (const row of rows) {
    const key = row.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  for (const [category, ads] of Object.entries(groups)) {
    const collName = `ads-${category.toLowerCase().replace(/\s+/g, '-')}`;
    console.log(`\n[${collName}] — ${ads.length} ads`);

    await deleteCollectionIfExists(collName);
    await createCollection(collName);

    const points = [];
    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      const textToEmbed = `${ad.title}. ${ad.description}`;
      console.log(`  Embedding (${i + 1}/${ads.length}): ${ad.title}`);
      const vector = await embedText(textToEmbed);
      points.push({
        id: i + 1,
        vector,
        payload: {
          adId: ad.id,
          title: ad.title,
          description: ad.description,
          filename: ad.filename,
          category: ad.category,
        },
      });
    }

    await upsertPoints(collName, points);
    console.log(`  Upserted ${points.length} points to ${collName}`);
  }

  console.log('\nDone! Collections created:');
  const res = await fetch(`${QDRANT_URL}/collections`);
  const data = await res.json();
  const adsCols = data.result.collections
    .map(c => c.name)
    .filter(n => n.startsWith('ads-'))
    .sort();
  for (const name of adsCols) {
    console.log(`  - ${name}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

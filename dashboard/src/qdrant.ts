const QDRANT_URL = import.meta.env.VITE_QDRANT_URL || 'http://localhost:6333';

export function collectionName(dimensions: number): string {
  return `live-${dimensions}`;
}

// Ensure collection exists with the right vector size
export async function ensureCollection(dimensions: number): Promise<void> {
  const name = collectionName(dimensions);

  // Check if exists
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) {
    // Delete and recreate to ensure clean state on preprocess
    await fetch(`${QDRANT_URL}/collections/${name}`, { method: 'DELETE' });
  }

  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: {
        size: dimensions,
        distance: 'Cosine',
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create collection: ${await res.text()}`);
  }
}

// Upsert category example embeddings as points (multiple per category)
export async function upsertExamples(
  dimensions: number,
  examples: { categoryId: string; categoryName: string; exampleText: string; embedding: number[] }[],
): Promise<void> {
  const name = collectionName(dimensions);

  const points = examples.map((ex, idx) => ({
    id: idx + 1,
    vector: ex.embedding,
    payload: {
      categoryId: ex.categoryId,
      categoryName: ex.categoryName,
      exampleText: ex.exampleText,
    },
  }));

  const res = await fetch(`${QDRANT_URL}/collections/${name}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });

  if (!res.ok) {
    throw new Error(`Failed to upsert points: ${await res.text()}`);
  }
}

// Create a named collection (for ads)
export async function createNamedCollection(name: string, dimensions: number): Promise<void> {
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) {
    await fetch(`${QDRANT_URL}/collections/${name}`, { method: 'DELETE' });
  }
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: dimensions, distance: 'Cosine' } }),
  });
  if (!res.ok) throw new Error(`Failed to create collection ${name}: ${await res.text()}`);
}

// Upsert points into a named collection
export async function upsertToCollection(
  name: string,
  points: { id: number; vector: number[]; payload: Record<string, string> }[],
): Promise<void> {
  const res = await fetch(`${QDRANT_URL}/collections/${name}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Upsert to ${name} failed: ${await res.text()}`);
}

// Get all points from a named collection
export async function getAllPoints(name: string): Promise<{ id: number; payload: Record<string, string> }[]> {
  const res = await fetch(`${QDRANT_URL}/collections/${name}/points/scroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 100, with_payload: true }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.result.points.map((p: any) => ({ id: p.id, payload: p.payload }));
}

// List all collections matching ads-* pattern
export async function listAdsCollections(): Promise<string[]> {
  const res = await fetch(`${QDRANT_URL}/collections`);
  if (!res.ok) return [];
  const data = await res.json();
  const names: string[] = data.result.collections
    .map((c: any) => c.name)
    .filter((n: string) => n.startsWith('ads-'));
  return names.sort();
}

export interface AdMatch {
  title: string;
  description: string;
  filename: string;
  score: number;
}

// Search an ads collection with a frame embedding
export async function searchAdsCollection(
  collectionName: string,
  frameEmbedding: number[],
  limit: number = 6,
): Promise<AdMatch[]> {
  const res = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: frameEmbedding,
      limit,
      with_payload: true,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.result.points.map((p: any) => ({
    title: p.payload.title,
    description: p.payload.description,
    filename: p.payload.filename,
    score: p.score,
  }));
}

export interface SearchResult {
  categoryId: string;
  name: string;
  score: number;
}

// Search for most similar categories given a frame embedding
export async function searchSimilar(
  dimensions: number,
  frameEmbedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  const name = collectionName(dimensions);

  const res = await fetch(`${QDRANT_URL}/collections/${name}/points/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: frameEmbedding,
      limit,
      with_payload: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${await res.text()}`);
  }

  const data = await res.json();
  return data.result.points.map((p: any) => ({
    categoryId: p.payload.categoryId,
    name: p.payload.name,
    score: p.score,
  }));
}

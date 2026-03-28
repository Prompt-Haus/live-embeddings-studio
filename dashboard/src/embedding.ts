const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const MODEL = 'gemini-embedding-2-preview';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;

export interface EmbeddingConfig {
  frameIntervalMs: number; // how often to capture frames
  dimensions: number; // embedding dimensions (128, 768, 1536, 3072)
  adLengthMs: number; // how long a triggered ad stays visible
  adCooldownMs: number; // minimum time before switching to a new ad
  detectionThreshold: number; // similarity score to trigger detection (0-1)
}

export const DEFAULT_CONFIG: EmbeddingConfig = {
  frameIntervalMs: 1000,
  dimensions: 3072,
  adLengthMs: 5000,
  adCooldownMs: 10000,
  detectionThreshold: 0.38,
};

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Embed text using Gemini with task-specific prompt
export async function embedText(text: string, dimensions: number): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: `Represent visual content category for classification: ${text}` }] },
      outputDimensionality: dimensions,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed text failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

// Embed image (base64) using Gemini
export async function embedImage(base64Data: string, mimeType: string, dimensions: number): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        parts: [{
          inlineData: {
            mimeType,
            data: base64Data,
          },
        }],
      },
      outputDimensionality: dimensions,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed image failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

// Capture a frame from a video element as base64 JPEG
export function captureFrame(video: HTMLVideoElement, maxWidth = 512): string {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Return base64 without the data:image/jpeg;base64, prefix
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

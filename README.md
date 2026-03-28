# [Live] Embeddings Studio

Show relevant on-stream ads in real-time using multimodal embeddings.

![Live Embeddings Studio](assets/readme/header.jpg)

Live Embeddings Studio captures your webcam feed, embeds each frame using the Gemini API, and matches it against categories you define — triggering contextually relevant ads in real-time. All similarity search is powered by Qdrant.

## Prerequisites

- **Node.js** (v18+)
- **Qdrant** running locally on port 6333 ([quickstart](https://qdrant.tech/documentation/quick-start/))
- **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)

## Quick Start

**1. Clone and install**

```bash
git clone https://github.com/anthropics/live-embeddings-studio.git
cd live-embeddings-studio
cd dashboard && npm install
```

**2. Configure environment**

Create a `.env` file in the repo root:

```
VITE_GOOGLE_API_KEY=your-gemini-api-key
VITE_QDRANT_URL=http://localhost:6333
```

**3. Start the dashboard**

```bash
cd dashboard
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## How to Use

### Step 1: Configure Embedding Settings

Go to the **Settings** tab. Adjust frame interval, embedding dimensions, ad display length, and cooldown between ad triggers.

![Embedding settings](assets/readme/embedding-settings.jpg)
![Ad timing settings](assets/readme/ad-settings.jpg)

### Step 2: Define Categories

Each category has a name and one or more text examples describing what it looks like. The system embeds these examples and compares them against live camera frames.

![Category definitions](assets/readme/category-definitions.jpg)

### Step 3: Initialize Ads and Map Categories

Click **Initialize Example Ads** to populate Qdrant with the built-in ad dataset. Then map each category to an ads collection — this controls which ads appear when a category is detected.

![Mapping categories to ad collections](assets/readme/mapping-ad-categories.jpg)

### Step 4: Preprocess and Analyze

Click **Preprocess Definitions** to embed all category examples into Qdrant. Then switch to the **Dashboard** tab, start your camera, and hit **Start Analysis**.

The system will:
- Capture frames at the configured interval
- Embed each frame via the Gemini API
- Search Qdrant for the closest matching category
- When a category score exceeds the detection threshold, search the mapped ads collection and display the best match

![Category detection scores](assets/readme/category-detection.jpg)

![Relevant ad overlay on stream](assets/readme/relevant-ad-example.jpg)

## Populating Ads via Script

You can also populate ad collections from the command line instead of the UI:

```bash
node scripts/populate-ads.mjs
```

This reads `assets/ads_dataset.csv`, embeds each ad's text via Gemini, and stores the vectors in Qdrant collections (`ads-food`, `ads-fitness`, `ads-snacks`, `ads-tech-products`).

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Embeddings**: Gemini API (`gemini-embedding-2-preview`) — supports text and image embedding
- **Vector Search**: Qdrant
- **Visualization**: Recharts (radar chart)
- **Video Processing**: Smelter (`@swmansion/smelter-*`)

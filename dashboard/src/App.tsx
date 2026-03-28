import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  embedText, embedImage, captureFrame,
  DEFAULT_CONFIG, type EmbeddingConfig,
} from './embedding';
import { ensureCollection, upsertExamples, searchSimilar, listAdsCollections, createNamedCollection, upsertToCollection, searchAdsCollection, type AdMatch } from './qdrant';
import './App.css';

interface Category {
  id: string;
  name: string;
  examples: string[];
  score: number;
  color: string;
  enabled: boolean;
  embedded: boolean;
  adsCollection?: string; // mapped ads-* Qdrant collection
}

const COLORS = ['#a78bfa', '#22d3ee', '#facc15', '#fb923c', '#34d399', '#60a5fa', '#f87171', '#c084fc'];

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Flexing', examples: ['Person showing their muscles', 'Person flexing muscles'], score: 0, color: COLORS[0], enabled: true, embedded: false, adsCollection: 'ads-fitness' },
  { id: '2', name: 'Phone Call', examples: ['Person talking on the phone', 'Holding phone to ear'], score: 0, color: COLORS[1], enabled: true, embedded: false, adsCollection: 'ads-tech-products' },
  { id: '3', name: 'Drinking', examples: ['Person drinking from a large cup', 'Sipping from a mug'], score: 0, color: COLORS[2], enabled: true, embedded: false, adsCollection: 'ads-food' },
  { id: '4', name: 'Eating - Healthy', examples: ['Person holding an apple', 'Person eating apple', 'Person holding healthy food', 'Person holding orange'], score: 0, color: COLORS[3], enabled: true, embedded: false, adsCollection: 'ads-food' },
  { id: '5', name: 'Eating - unHealthy', examples: ['Person holding cookies', 'Person holding softdrink', 'Person holding snacks'], score: 0, color: COLORS[4], enabled: true, embedded: false, adsCollection: 'ads-snacks' },
  { id: '6', name: 'Mouse in Hand', examples: ['Computer mouse held in hand', 'Gripping a mouse'], score: 0, color: COLORS[5], enabled: true, embedded: false, adsCollection: 'ads-tech-products' },
];

const ADS_DATASET: { id: string; category: string; title: string; description: string; filename: string }[] = [
  { id: '94838c7f', category: 'Tech products', title: 'Lumina Vision AR Glasses', description: 'See beyond reality with Lumina Vision. Ultra-lightweight AR glasses with real-time navigation and translation.', filename: 'tech products_1.png' },
  { id: '69499fe7', category: 'Tech products', title: 'AuraPad Haptic Tablet', description: 'Experience the texture of every brushstroke with advanced ultrasonic haptics.', filename: 'tech products_2.png' },
  { id: 'b2ff83a1', category: 'Tech products', title: 'Chronos Modular Smartwatch', description: 'Swap between OLED display and mechanical movement. Premium titanium meets biosensors.', filename: 'tech products_3.png' },
  { id: '1d21b2ed', category: 'Tech products', title: 'EchoSphere Glass Speaker', description: '360-degree wireless speaker in hand-blown glass dome with ferrofluid core.', filename: 'tech products_4.png' },
  { id: '84ada017', category: 'Tech products', title: 'Vortex VR Air Goggles', description: '8K per-eye resolution VR goggles as thin as ski goggles. Tether-free.', filename: 'tech products_5.png' },
  { id: '672a0ed4', category: 'Tech products', title: 'Flux OLED Keyboard', description: 'Individual OLED screens under every keycap for custom layouts and widgets.', filename: 'tech products_6.png' },
  { id: 'd242dff1', category: 'Tech products', title: 'SolarNode Power Hub', description: 'Portable solid-state battery with fold-out solar array and satellite Wi-Fi.', filename: 'tech products_7.png' },
  { id: 'd269a33b', category: 'Tech products', title: 'Zenith 360 Follow-Drone', description: 'Palm-sized AI drone capturing 8K 360-degree video autonomously.', filename: 'tech products_8.png' },
  { id: 'b2621dbe', category: 'Tech products', title: 'PulseRing Biometric Tracker', description: 'Heart rate, blood oxygen, stress in a ceramic ring. 10-day battery.', filename: 'tech products_9.png' },
  { id: '96c52a83', category: 'Tech products', title: 'Terra Eco-Laptop', description: 'Reclaimed ocean plastic and bamboo laptop with fully modular design.', filename: 'tech products_10.png' },
  { id: '2b424049', category: 'Food', title: 'ShroomSip Sparkling Chaga Tea', description: 'Wild Chaga mushroom with zesty lemon and natural bubbles.', filename: 'food_1.png' },
  { id: 'ee04d6e5', category: 'Food', title: 'LavaLeaf Spicy Honey Seaweed', description: 'Roasted seaweed with wildflower honey and red chili glaze.', filename: 'food_2.png' },
  { id: '2e1d91d9', category: 'Food', title: 'VelvetVine Purple Yam Spread', description: 'Vibrant purple sweet potato nut butter packed with antioxidants.', filename: 'food_3.png' },
  { id: '93480fb3', category: 'Food', title: 'EmberDragon Pitaya Fire Sauce', description: 'Fermented dragon fruit meets habanero peppers. Tropical heatwave.', filename: 'food_4.png' },
  { id: '258c5f8f', category: 'Food', title: 'WildTrail Bison & Berry Bites', description: 'High-protein bison jerky with real mountain blueberries.', filename: 'food_5.png' },
  { id: 'a90934d9', category: 'Food', title: 'NomadBrew Rose-Cardamom Cold Brew', description: 'Slow-steeped coffee with Damascus roses and green cardamom.', filename: 'food_6.png' },
  { id: 'f47c86ba', category: 'Food', title: 'GildedGrain Truffle & Gold Popcorn', description: 'Gourmet popcorn with white truffle oil and edible 24k gold.', filename: 'food_7.png' },
  { id: '26f10329', category: 'Food', title: 'FloraFeast Jackfruit Slider Kit', description: 'Shredded jackfruit in hickory smoke sauce with brioche buns.', filename: 'food_8.png' },
  { id: 'f9d612df', category: 'Food', title: 'CloudDairy Lavender Honey Yogurt', description: 'Goat milk yogurt with organic lavender-infused honey.', filename: 'food_9.png' },
  { id: '9a077270', category: 'Food', title: 'ZestZing Lime-Smoked Chickpeas', description: 'Roasted chickpeas with smoked paprika and fresh lime.', filename: 'food_10.png' },
  { id: 'f883e87e', category: 'Fitness', title: 'Zenith Core Smart Kettlebell', description: 'Smart kettlebell tracking reps, form, and power output in real-time.', filename: 'fitness_1.png' },
  { id: 'aeec96c5', category: 'Fitness', title: 'PulseFlow Pro Recovery Boots', description: 'Dynamic air pressure compression boots for muscle recovery.', filename: 'fitness_2.png' },
  { id: '744a73b7', category: 'Fitness', title: 'AeroForce Matrix Wall Gym', description: 'Wall-mounted digital cable system with electromagnetic resistance up to 200lbs.', filename: 'fitness_3.png' },
  { id: 'dff170c8', category: 'Fitness', title: 'CloudStride Nitro Running Shoes', description: 'Nitrogen-infused foam and carbon plate for maximum energy return.', filename: 'fitness_4.png' },
  { id: '2b6eaa6b', category: 'Fitness', title: 'AquaSync Smart Flask', description: 'Smart water bottle with light-pulse hydration reminders.', filename: 'fitness_5.png' },
  { id: 'be0bd1a4', category: 'Fitness', title: 'FlexiGrip 50 Adjustable Weights', description: 'Adjustable dumbbells from 5 to 50 lbs with a twist of the handle.', filename: 'fitness_6.png' },
  { id: 'c2e03165', category: 'Fitness', title: 'SonicRelief X1 Percussive Massager', description: 'Ultra-quiet deep vibration therapy for pain relief and mobility.', filename: 'fitness_7.png' },
  { id: '86748e32', category: 'Fitness', title: 'TerraGrip Sustainable Yoga Mat', description: 'Cork and natural rubber mat with unparalleled grip.', filename: 'fitness_8.png' },
  { id: '0e643709', category: 'Fitness', title: 'TitanStretch Resistance Kit', description: 'Heavy-duty anti-snap resistance bands with ergonomic handles.', filename: 'fitness_9.png' },
  { id: '993210fd', category: 'Fitness', title: 'LuminoSkip LED Jump Rope', description: 'LED jump rope displaying jump count using persistent-vision tech.', filename: 'fitness_10.png' },
  { id: 'dca02f68', category: 'Snacks', title: 'VerdeCrisp Root Medley', description: 'Real parsnip, beet, and sweet potato slices with Himalayan pink salt.', filename: 'snacks_1.png' },
  { id: 'e204fd73', category: 'Snacks', title: 'FirePuffs Magma Heat', description: 'Air-puffed corn with habanero and ghost pepper spices.', filename: 'snacks_2.png' },
  { id: '238794e2', category: 'Snacks', title: 'BeeNutri Honey-Glazed Chickpeas', description: 'High-protein chickpeas with organic wildflower honey.', filename: 'snacks_3.png' },
  { id: '83137394', category: 'Snacks', title: 'OceanGold Salted Caramel Corn', description: 'Sweet buttery caramel and sea salt on mushroom-style popcorn.', filename: 'snacks_4.png' },
  { id: '5366d25c', category: 'Snacks', title: 'NutraSphere Cocoa-Hazelnut Bites', description: 'Protein-packed energy spheres from raw cocoa, hazelnuts, and dates.', filename: 'snacks_5.png' },
  { id: '4858536b', category: 'Snacks', title: 'LentiZest Chili Lime Spirals', description: 'Crunchy lentil flour twists with fresh lime and mild chili.', filename: 'snacks_6.png' },
  { id: 'effdfd63', category: 'Snacks', title: 'SmokeNut Hickory Almonds', description: 'California almonds slow-roasted over hickory wood chips.', filename: 'snacks_7.png' },
  { id: '752676fc', category: 'Snacks', title: 'TartTangle Sour Green Apple Strips', description: 'Real fruit puree pressed into chewy, tangy sour strips.', filename: 'snacks_8.png' },
  { id: '259414cc', category: 'Snacks', title: 'UmamiThin Miso Glazed Seaweed', description: 'Roasted seaweed with savory miso glaze and toasted sesame.', filename: 'snacks_9.png' },
  { id: '6753cb5b', category: 'Snacks', title: 'CocoCrunch Toasted Clusters', description: 'Organic coconut flakes with chia seeds and sunflower kernels.', filename: 'snacks_10.png' },
];

type Tab = 'dashboard' | 'settings';

function App() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeAd, setActiveAd] = useState<string>('1');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [config, setConfig] = useState<EmbeddingConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [definitionsReady, setDefinitionsReady] = useState(false);
  const [adsStatus, setAdsStatus] = useState<string>('');
  const [adsPopulating, setAdsPopulating] = useState(false);
  const [availableAdsCollections, setAvailableAdsCollections] = useState<string[]>([]);
  const [adMatches, setAdMatches] = useState<AdMatch[]>([]);
  const [triggeredCategory, setTriggeredCategory] = useState<string | null>(null);
  const [triggeredCollection, setTriggeredCollection] = useState<string | null>(null);
  const [videoDims, setVideoDims] = useState<{ width: number; height: number } | null>(null);
  const [adDismissing, setAdDismissing] = useState(false);
  const [adTimerKey, setAdTimerKey] = useState(0);
  const [cooldownBlocked, setCooldownBlocked] = useState(false);

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);
  const analyzeIntervalRef = useRef<number | null>(null);
  const categoriesRef = useRef<Category[]>(categories);
  const lastAdTriggerRef = useRef<number>(0);
  const adExpiryTimerRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const configRef = useRef(config);

  // Keep refs in sync with state
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);


  // Fetch available ads-* collections from Qdrant
  const refreshAdsCollections = useCallback(async () => {
    const cols = await listAdsCollections();
    setAvailableAdsCollections(cols);
  }, []);

  useEffect(() => {
    refreshAdsCollections();
  }, [refreshAdsCollections]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  }, []);

  const computeVideoDims = useCallback(() => {
    const video = cameraVideoRef.current;
    const container = streamContainerRef.current;
    if (!video || !container || !video.videoWidth) return;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const vAspect = video.videoWidth / video.videoHeight;
    const cAspect = cW / cH;
    let w: number, h: number;
    if (vAspect > cAspect) {
      w = cW;
      h = cW / vAspect;
    } else {
      h = cH;
      w = cH * vAspect;
    }
    setVideoDims({ width: Math.round(w), height: Math.round(h) });
  }, []);

  const cameraRefCallback = useCallback((el: HTMLVideoElement | null) => {
    cameraVideoRef.current = el;
    if (el && cameraStream) {
      el.srcObject = cameraStream;
      el.play().catch(() => {});
      el.addEventListener('loadedmetadata', computeVideoDims);
      el.addEventListener('resize', computeVideoDims);
    }
  }, [cameraStream, computeVideoDims]);

  useEffect(() => {
    window.addEventListener('resize', computeVideoDims);
    return () => window.removeEventListener('resize', computeVideoDims);
  }, [computeVideoDims]);

  // Precompute embeddings for all category examples and store in Qdrant
  const preprocessDefinitions = useCallback(async () => {
    const cats = categoriesRef.current;
    setEmbeddingStatus('Creating Qdrant collection...');
    try {
      await ensureCollection(config.dimensions);
    } catch (err: any) {
      setEmbeddingStatus(`Qdrant error: ${err.message}`);
      return;
    }

    setEmbeddingStatus('Embedding examples...');
    const allExamples: { categoryId: string; categoryName: string; exampleText: string; embedding: number[] }[] = [];
    const embeddedIds = new Set<string>();
    let count = 0;
    const totalExamples = cats.filter(c => c.enabled).reduce((sum, c) => sum + c.examples.length, 0);

    for (const cat of cats) {
      if (!cat.enabled) continue;
      for (const example of cat.examples) {
        count++;
        try {
          setEmbeddingStatus(`Embedding "${example}" (${count}/${totalExamples})...`);
          const taskText = `Represent visual content for classification: ${example}`;
          const emb = await embedText(taskText, config.dimensions);
          allExamples.push({ categoryId: cat.id, categoryName: cat.name, exampleText: example, embedding: emb });
        } catch (err: any) {
          console.error(`Failed to embed "${example}":`, err);
          setEmbeddingStatus(`Error embedding "${example}": ${err.message}`);
          return;
        }
      }
      embeddedIds.add(cat.id);
    }

    // Store all examples in Qdrant
    try {
      setEmbeddingStatus('Storing in Qdrant...');
      await upsertExamples(config.dimensions, allExamples);
    } catch (err: any) {
      setEmbeddingStatus(`Qdrant upsert error: ${err.message}`);
      return;
    }

    setCategories(prev => prev.map(c => embeddedIds.has(c.id) ? { ...c, embedded: true } : c));
    setDefinitionsReady(true);
    setEmbeddingStatus(`${allExamples.length} examples stored in Qdrant collection live-${config.dimensions}`);
  }, [config.dimensions]);

  // Populate ads collections in Qdrant from built-in dataset
  const populateAds = useCallback(async () => {
    setAdsPopulating(true);
    setAdsStatus('Grouping ads by category...');

    const groups: Record<string, typeof ADS_DATASET> = {};
    for (const ad of ADS_DATASET) {
      const key = `ads-${ad.category.toLowerCase().replace(/\s+/g, '-')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ad);
    }

    const collNames = Object.keys(groups);
    let totalDone = 0;
    const totalAds = ADS_DATASET.length;

    for (const [collName, ads] of Object.entries(groups)) {
      try {
        setAdsStatus(`Creating collection ${collName}...`);
        await createNamedCollection(collName, config.dimensions);

        const points: { id: number; vector: number[]; payload: Record<string, string> }[] = [];
        for (let i = 0; i < ads.length; i++) {
          const ad = ads[i];
          totalDone++;
          setAdsStatus(`Embedding ${ad.title} (${totalDone}/${totalAds})...`);
          const vector = await embedText(`${ad.title}. ${ad.description}`, config.dimensions);
          points.push({
            id: i + 1,
            vector,
            payload: { adId: ad.id, title: ad.title, description: ad.description, filename: ad.filename, category: ad.category },
          });
        }

        setAdsStatus(`Upserting ${points.length} ads to ${collName}...`);
        await upsertToCollection(collName, points);
      } catch (err: any) {
        setAdsStatus(`Error on ${collName}: ${err.message}`);
        setAdsPopulating(false);
        return;
      }
    }

    setAdsStatus(`Done! ${collNames.length} collections created (${totalAds} ads total)`);
    setAdsPopulating(false);
    refreshAdsCollections();
  }, [config.dimensions, refreshAdsCollections]);

  // Analyze a single frame via Qdrant search
  const analyzeFrame = useCallback(async () => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2) return;

    const cats = categoriesRef.current;
    const totalExamples = cats.filter(c => c.enabled).reduce((sum, c) => sum + c.examples.length, 0);
    if (totalExamples === 0) return;

    try {
      const base64 = captureFrame(video);
      const frameEmbedding = await embedImage(base64, 'image/jpeg', config.dimensions);

      // Search Qdrant for all examples - return enough to cover all categories
      const results = await searchSimilar(config.dimensions, frameEmbedding, totalExamples);

      // Aggregate: take max score per category (any example can trigger it)
      const categoryScores = new Map<string, number>();
      for (const r of results) {
        const current = categoryScores.get(r.categoryId) ?? 0;
        categoryScores.set(r.categoryId, Math.max(current, r.score));
      }

      console.log('Category scores:', [...categoryScores.entries()].map(([id, s]) => `${id}:${s.toFixed(4)}`).join(', '));

      setCategories(prev =>
        prev.map(cat => {
          const score = categoryScores.get(cat.id);
          if (score === undefined) return cat;
          return { ...cat, score };
        })
      );

      // Check for ad trigger: find top scoring category >38% with a mapped collection
      const now = Date.now();
      const cooldownElapsed = now - lastAdTriggerRef.current >= configRef.current.adCooldownMs;

      // Check if any category would trigger
      let topCat: Category | null = null;
      let topScore = 0;
      for (const cat of cats) {
        if (!cat.enabled || !cat.adsCollection) continue;
        const score = categoryScores.get(cat.id) ?? 0;
        if (score > configRef.current.detectionThreshold && score > topScore) {
          topScore = score;
          topCat = cat;
        }
      }

      if (!cooldownElapsed && topCat) {
        setCooldownBlocked(true);
      } else {
        setCooldownBlocked(false);
      }

      if (cooldownElapsed) {
        if (topCat && topCat.adsCollection) {
          lastAdTriggerRef.current = now;
          const collection = topCat.adsCollection;
          const catName = topCat.name;

          // Search the ads collection with the frame embedding
          const matches = await searchAdsCollection(collection, frameEmbedding, 6);
          setAdMatches(matches);
          setTriggeredCategory(catName);
          setTriggeredCollection(collection);

          // Activate timer bars (increment key to remount and re-trigger animations)
          setAdTimerKey(k => k + 1);
          if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

          // Dismiss after adLengthMs: start slide-down, then clear after animation
          if (adExpiryTimerRef.current) clearTimeout(adExpiryTimerRef.current);
          setAdDismissing(false);
          adExpiryTimerRef.current = window.setTimeout(() => {
            setAdDismissing(true);
            setTimeout(() => {
              setAdMatches([]);
              setTriggeredCategory(null);
              setTriggeredCollection(null);
              setAdDismissing(false);
            }, 400);
          }, configRef.current.adLengthMs);
        }
      }
    } catch (err: any) {
      console.error('Frame analysis failed:', err);
    }
  }, [config.dimensions]);

  // Start/stop analysis loop
  const toggleAnalysis = useCallback(() => {
    if (isAnalyzing) {
      if (analyzeIntervalRef.current) {
        clearInterval(analyzeIntervalRef.current);
        analyzeIntervalRef.current = null;
      }
      setIsAnalyzing(false);
      setEmbeddingStatus('Analysis stopped');
    } else {
      if (!definitionsReady) {
        setEmbeddingStatus('Preprocess definitions first!');
        return;
      }
      if (!cameraStream) {
        setEmbeddingStatus('Start camera first!');
        return;
      }
      setIsAnalyzing(true);
      setEmbeddingStatus(`Analyzing every ${config.frameIntervalMs}ms...`);
      // Run immediately then on interval
      analyzeFrame();
      analyzeIntervalRef.current = window.setInterval(analyzeFrame, config.frameIntervalMs);
    }
  }, [isAnalyzing, definitionsReady, cameraStream, config.frameIntervalMs, analyzeFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current);
      if (adExpiryTimerRef.current) clearTimeout(adExpiryTimerRef.current);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const updateCategoryName = (id: string, name: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name, embedded: false } : c));
    setDefinitionsReady(false);
  };

  const updateCategoryExamples = (id: string, exampleIndex: number, value: string) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== id) return c;
      const examples = [...c.examples];
      examples[exampleIndex] = value;
      return { ...c, examples, embedded: false };
    }));
    setDefinitionsReady(false);
  };

  const addExample = (id: string) => {
    setCategories(prev => prev.map(c =>
      c.id === id ? { ...c, examples: [...c.examples, ''], embedded: false } : c
    ));
    setDefinitionsReady(false);
  };

  const removeExample = (id: string, exampleIndex: number) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== id) return c;
      const examples = c.examples.filter((_, i) => i !== exampleIndex);
      return { ...c, examples, embedded: false };
    }));
    setDefinitionsReady(false);
  };

  const updateCategoryAdsCollection = (id: string, collection: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, adsCollection: collection || undefined } : c));
  };

  const toggleCategory = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const addCategory = () => {
    const newId = String(Date.now());
    setCategories(prev => [
      ...prev,
      {
        id: newId,
        name: 'New Category',
        examples: [''],
        score: 0,
        color: COLORS[prev.length % COLORS.length],
        enabled: true,
        embedded: false,
      },
    ]);
    setDefinitionsReady(false);
  };

  const enabledCats = categories.filter(c => c.enabled);
  const topDetected = enabledCats.reduce((top, c) => c.score > (top?.score ?? 0) ? c : top, null as Category | null);
  const detectedColor = topDetected && topDetected.score > config.detectionThreshold ? topDetected.color : '#a78bfa';

  const radarData = enabledCats.map(c => {
    // Scale 25-40% range to 0-100% for sensitivity
    const scaled = Math.max(0, Math.min(100, (c.score - 0.25) / 0.15 * 100));
    return { name: c.name, value: Math.round(scaled), color: c.color, detected: c.score > config.detectionThreshold };
  });

  if (activeTab === 'settings') {
    return (
      <div className="dashboard" style={{ gridTemplateRows: 'auto 1fr' }}>
        <div className="tab-bar">
          <button className="tab-btn" onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className="tab-btn active">Settings</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 1, flex: 1, overflow: 'hidden', background: '#262626' }}>
          {/* Column 1: Config + Ads */}
          <div style={{ background: '#000', overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="settings-section" style={{ marginBottom: 0 }}>
              <h3>Embedding Configuration</h3>

              <div className="settings-row">
                <label>Frame Interval</label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    min={200}
                    max={10000}
                    step={100}
                    value={config.frameIntervalMs}
                    onChange={e => setConfig(prev => ({ ...prev, frameIntervalMs: Number(e.target.value) }))}
                    style={{ maxWidth: 120 }}
                  />
                  <span className="settings-unit">ms</span>
                </div>
                <span className="settings-hint">{(1000 / config.frameIntervalMs).toFixed(1)} fps</span>
              </div>

              <div className="settings-row">
                <label>Dimensions</label>
                <select
                  value={config.dimensions}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, dimensions: Number(e.target.value) }));
                    setDefinitionsReady(false);
                  }}
                  style={{ maxWidth: 200 }}
                >
                  <option value={128}>128</option>
                  <option value={768}>768</option>
                  <option value={1536}>1536</option>
                  <option value={3072}>3072</option>
                </select>
              </div>

              <div className="settings-row">
                <label>Model</label>
                <input type="text" value="gemini-embedding-2-preview" disabled style={{ maxWidth: '100%' }} />
              </div>

              <div className="settings-row">
                <label>Ad Length</label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    min={1000}
                    max={30000}
                    step={1000}
                    value={config.adLengthMs}
                    onChange={e => setConfig(prev => ({ ...prev, adLengthMs: Number(e.target.value) }))}
                    style={{ maxWidth: 120 }}
                  />
                  <span className="settings-unit">ms</span>
                </div>
                <span className="settings-hint">How long matched ads stay visible ({(config.adLengthMs / 1000).toFixed(0)}s)</span>
              </div>

              <div className="settings-row">
                <label>Ad Cooldown</label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    value={config.adCooldownMs}
                    onChange={e => setConfig(prev => ({ ...prev, adCooldownMs: Number(e.target.value) }))}
                    style={{ maxWidth: 120 }}
                  />
                  <span className="settings-unit">ms</span>
                </div>
                <span className="settings-hint">Minimum wait before next ad trigger ({(config.adCooldownMs / 1000).toFixed(0)}s)</span>
              </div>

              <div className="settings-row">
                <label>Detection Threshold</label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.detectionThreshold}
                    onChange={e => setConfig(prev => ({ ...prev, detectionThreshold: Number(e.target.value) }))}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                <span className="settings-hint">Score above {config.detectionThreshold} triggers detection ({Math.round(config.detectionThreshold * 100)}%)</span>
              </div>

              <div className="settings-row" style={{ marginBottom: 0 }}>
                <label>API Key</label>
                <input
                  type="password"
                  value={import.meta.env.VITE_GOOGLE_API_KEY ? '********' : 'Not set'}
                  disabled
                  style={{ maxWidth: '100%' }}
                />
              </div>
            </div>

            <div className="settings-section" style={{ marginBottom: 0 }}>
              <h3>Ad Collections</h3>
              <button
                className="action-btn"
                onClick={populateAds}
                disabled={adsPopulating}
                style={{ width: '100%' }}
              >
                {adsPopulating ? 'Populating...' : 'Initialize Example Ads'}
              </button>
              {adsStatus && (
                <p className="settings-hint" style={{ marginTop: 8 }}>{adsStatus}</p>
              )}
            </div>
          </div>

          {/* Columns 2-4: Category Definitions */}
          <div style={{ background: '#000', overflow: 'auto', padding: 12 }}>
            <div className="settings-section" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ marginBottom: 0 }}>Category Definitions</h3>
                <span style={{ fontSize: 12, fontWeight: 600, color: definitionsReady ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {definitionsReady ? 'READY' : 'NOT PREPROCESSED'}
                </span>
              </div>
              <div className="categories-list">
                {categories.map(cat => (
                  <div key={cat.id} className="category-card" style={{ opacity: cat.enabled ? 1 : 0.4, borderLeftColor: cat.color }}>
                    <div className="category-card-header">
                      <div className="category-color" style={{ backgroundColor: cat.color }} />
                      <div className="category-name">
                        <input
                          value={cat.name}
                          onChange={e => updateCategoryName(cat.id, e.target.value)}
                          placeholder="Category name"
                        />
                      </div>
                      <span className="settings-hint" style={{ fontSize: 10, minWidth: 50, textAlign: 'right' }}>
                        {cat.embedded ? `${cat.examples.length} emb` : 'not emb'}
                      </span>
                      <button
                        className="category-toggle"
                        onClick={() => toggleCategory(cat.id)}
                        title={cat.enabled ? 'Disable' : 'Enable'}
                      >
                        {cat.enabled ? '\u{25C9}' : '\u{25CB}'}
                      </button>
                      <button
                        className="category-toggle"
                        onClick={() => removeCategory(cat.id)}
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="category-examples">
                      {cat.examples.map((ex, idx) => (
                        <div key={idx} className="example-row">
                          <input
                            value={ex}
                            onChange={e => updateCategoryExamples(cat.id, idx, e.target.value)}
                            placeholder="Example description..."
                          />
                          {cat.examples.length > 1 && (
                            <button className="category-toggle" onClick={() => removeExample(cat.id, idx)}>&times;</button>
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button className="add-example-btn" style={{ flex: 1 }} onClick={() => addExample(cat.id)}>
                          + Add Example
                        </button>
                        <select
                          value={cat.adsCollection || ''}
                          onChange={e => updateCategoryAdsCollection(cat.id, e.target.value)}
                          style={{
                            background: '#0a0a0a',
                            border: '1px solid #262626',
                            color: cat.adsCollection ? '#fff' : '#525252',
                            fontSize: 11,
                            fontFamily: 'inherit',
                            padding: '3px 8px',
                            borderRadius: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          <option value="">No Ads</option>
                          {availableAdsCollections.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button className="add-category-btn" onClick={addCategory}>
                  + Add Category
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button
                  className="action-btn"
                  onClick={preprocessDefinitions}
                >
                  Preprocess Definitions
                </button>
                {embeddingStatus && (
                  <span className="settings-hint">{embeddingStatus}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Tab bar */}
      <div className="tab-bar">
        <button className="tab-btn active">Dashboard</button>
        <button className="tab-btn" onClick={() => setActiveTab('settings')}>Settings</button>
        <div style={{ flex: 1 }} />
        <span className="status-text">
          {embeddingStatus}
          {embeddingStatus === 'Preprocess definitions first!' && (
            <button className="header-btn" style={{ marginLeft: 8 }} onClick={preprocessDefinitions}>
              Preprocess Now
            </button>
          )}
        </span>
      </div>

      {/* Top Row */}
      <div className="top-row">
        {/* Ads Sidebar */}
        <div className="panel">
          <div className="panel-header">
            Ad Matches
            {triggeredCategory && (
              <span style={{ marginLeft: 8, color: '#22c55e', fontSize: 11, fontWeight: 400 }}>
                {triggeredCategory}
              </span>
            )}
          </div>
          <div className="panel-body">
            <div className="ads-list">
              {adMatches.length === 0 ? (
                <div style={{ color: '#404040', textAlign: 'center', padding: '24px 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  No ads triggered
                </div>
              ) : (
                adMatches.map((ad, idx) => (
                  <div key={idx} className="ad-card" style={{ borderLeftColor: '#22c55e', borderLeftWidth: 3 }}>
                    <div className="ad-preview">
                      <img src={`/ads/${ad.filename}`} alt={ad.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4>{ad.title}</h4>
                      <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                        {Math.round(ad.score * 100)}%
                      </span>
                    </div>
                    <p>{ad.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stream / Camera Panel */}
        <div className="panel">
          <div className="panel-header">
            Live Stream
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {!cameraStream && (
                <button className="header-btn" onClick={startCamera}>Start Camera</button>
              )}
              <button
                className={`header-btn ${isAnalyzing ? 'active' : ''}`}
                onClick={toggleAnalysis}
                disabled={!cameraStream}
              >
                {isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="stream-container" ref={streamContainerRef} style={{ flex: 1 }}>
              {cameraStream ? (
                <div className="video-wrapper" style={videoDims ? { width: videoDims.width, height: videoDims.height } : undefined}>
                  <video ref={cameraRefCallback} muted playsInline autoPlay />
                  {adMatches.length > 0 && (
                    <div className={`ad-banner ${adDismissing ? 'ad-banner-dismiss' : ''}`}>
                      <div className="ad-banner-image">
                        <img src={`/ads/${adMatches[0].filename}`} alt={adMatches[0].title} />
                      </div>
                      <div className="ad-banner-content">
                        <div className="ad-banner-label">Sponsored</div>
                        <div className="ad-banner-title">{adMatches[0].title}</div>
                        <div className="ad-banner-desc">{adMatches[0].description}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="stream-placeholder">
                  <div className="icon">&#128247;</div>
                  <p>Click "Start Camera" to begin</p>
                </div>
              )}
              {isAnalyzing && (
                <div className="stream-status">
                  <div className="status-dot live" />
                  ANALYZING
                </div>
              )}
            </div>
            <div className="timer-bars">
              <div className="timer-bar">
                <div className="timer-bar-label">AD</div>
                <div className="timer-bar-track">
                  <div
                    key={`ad-${adTimerKey}`}
                    className="timer-bar-fill ad-length-fill"
                    style={adTimerKey > 0 ? {
                      animation: `timer-drain ${config.adLengthMs}ms linear forwards`,
                    } : undefined}
                  />
                </div>
              </div>
              <div className={`timer-bar ${cooldownBlocked ? 'timer-bar-blocked' : ''}`}>
                <div className="timer-bar-label">CD</div>
                <div className="timer-bar-track">
                  <div
                    key={`cd-${adTimerKey}`}
                    className={`timer-bar-fill cooldown-fill ${cooldownBlocked ? 'cooldown-blocked' : ''}`}
                    style={adTimerKey > 0 ? {
                      animation: `timer-drain ${config.adCooldownMs}ms linear forwards`,
                    } : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="bottom-row">
        {/* Radar Chart */}
        <div className="panel">
          <div className="panel-header">Safety Radar</div>
          <div className="panel-body">
            <div className="radar-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="#262626" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={({ payload, x, y, textAnchor, ...rest }: any) => {
                      const entry = radarData.find(d => d.name === payload.value);
                      const fill = entry?.detected ? entry.color : '#a3a3a3';
                      const fontWeight = entry?.detected ? 700 : 400;
                      return (
                        <text {...rest} x={x} y={y} textAnchor={textAnchor} fill={fill} fontSize={11} fontWeight={fontWeight}>
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke={detectedColor}
                    fill={detectedColor}
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Category Definitions */}
        <div className="panel">
          <div className="panel-header">
            Category Scores
            {!definitionsReady && (
              <span style={{ color: '#737373', marginLeft: 8, fontSize: 11 }}>
                (go to Settings to preprocess)
              </span>
            )}
          </div>
          <div className="panel-body">
            <div className="categories-list">
              {(() => {
                const maxScore = Math.max(...enabledCats.map(c => c.score));
                const isAlert = maxScore > config.detectionThreshold;
                return categories.map(cat => {
                  const isTop = isAlert && cat.enabled && cat.score === maxScore;
                  return (
                    <div
                      key={cat.id}
                      className={`category-item ${isTop ? 'category-alert' : ''}`}
                      style={{ opacity: cat.enabled ? 1 : 0.4, borderLeftColor: cat.color }}
                    >
                      <div className="category-color" style={{ backgroundColor: cat.color }} />
                      <div className="category-name">
                        <span>{cat.name}</span>
                      </div>
                      <span className={`category-score ${isTop ? 'score-alert' : ''}`}>
                        {Math.round(cat.score * 100)}%
                      </span>
                      <div className="score-bar">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${cat.score * 100}%`,
                            backgroundColor: isTop ? '#22c55e' : cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Raw Frame Preview */}
        <div className="panel">
          <div className="panel-header">Analysis Info</div>
          <div className="panel-body">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Model</span>
                <span className="info-value">gemini-embedding-2-preview</span>
              </div>
              <div className="info-item">
                <span className="info-label">Dimensions</span>
                <span className="info-value">{config.dimensions}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Interval</span>
                <span className="info-value">{config.frameIntervalMs}ms</span>
              </div>
              <div className="info-item">
                <span className="info-label">Categories</span>
                <span className="info-value">{categories.filter(c => c.enabled).length} active</span>
              </div>
              <div className="info-item">
                <span className="info-label">Definitions</span>
                <span className="info-value" style={{ color: definitionsReady ? '#fff' : '#525252' }}>
                  {definitionsReady ? 'Ready' : 'Not processed'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value" style={{ color: isAnalyzing ? '#fff' : '#525252' }}>
                  {isAnalyzing ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

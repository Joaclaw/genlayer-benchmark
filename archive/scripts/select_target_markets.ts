import { writeFileSync } from 'fs';

// --- Types (matching actual Polymarket gamma API response) ---

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  endDate: string;           // ISO datetime e.g. "2026-03-31T12:00:00Z"
  endDateIso: string;        // Date only e.g. "2026-03-31"
  closed: boolean;
  active: boolean;
  volume: string;            // String in API
  volumeNum: number;         // Numeric version
  liquidity: string;
  liquidityNum: number;
  outcomePrices: string;     // JSON string e.g. "[\"0.45\", \"0.55\"]"
  slug: string;
  conditionId: string;
  events?: Array<{ slug: string; title: string }>;
}

type WhitelistedCategory =
  | 'geopolitical'
  | 'technology'
  | 'politics'
  | 'business'
  | 'science';

interface CategoryResult {
  category: WhitelistedCategory | 'excluded';
  reason: string;
  confidence: number;
}

// --- Fetch Active Markets ---

async function fetchActiveMarkets(): Promise<PolymarketMarket[]> {
  const baseUrl = 'https://gamma-api.polymarket.com';
  const markets: PolymarketMarket[] = [];

  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl}/markets?closed=false&active=true&limit=${limit}&offset=${offset}`;

    if (offset % 1000 === 0) {
      console.log(`Fetching markets (offset: ${offset})...`);
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`HTTP error ${response.status} at offset ${offset}`);
      break;
    }

    const batch = await response.json();

    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      hasMore = false;
      break;
    }

    markets.push(...batch);
    offset += limit;

    // Rate limit: wait 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Fetched ${markets.length} active markets`);
  return markets;
}

// --- SPORTS DETECTION (comprehensive) ---

function isSports(market: PolymarketMarket): boolean {
  const q = market.question.toLowerCase();
  const desc = (market.description || '').toLowerCase();
  const combined = q + ' ' + desc;

  // Sport names and leagues
  const sports = [
    'golf', 'masters', 'pga', 'tournament', 'lpga',
    'nba', 'nfl', 'nhl', 'mlb', 'mls', 'ncaa', 'march madness',
    'soccer', 'football', 'basketball', 'baseball', 'hockey',
    'premier league', 'champions league', 'world cup', 'la liga', 'serie a', 'bundesliga',
    'olympics', 'tennis', 'wimbledon', 'us open', 'australian open', 'french open',
    'formula 1', 'f1', 'nascar', 'indycar',
    'ufc', 'boxing', 'mma', 'wrestling',
    'cricket', 'rugby', 'afl',
    'world series', 'stanley cup', 'super bowl', 'grand slam',
    'batting', 'pitcher', 'quarterback', 'touchdown', 'goal scorer',
    'home run', 'strikeout', 'assists', 'rebounds', 'rushing yards',
    'ryder cup', 'birdie', 'bogey', 'par ',
    'grand prix', 'podium finish',
    'medal', 'semifinal', 'quarterfinal',
    'playoff', 'postseason', 'draft pick',
  ];

  if (sports.some(sport => combined.includes(sport))) {
    return true;
  }

  // Player/team competitive patterns
  if (q.match(/will .+ win (on|the|against|vs|at|in the)\b/i)) {
    return true;
  }

  // "X vs Y" or "X defeat Y" patterns typical of sports
  if (q.match(/\bvs\.?\s/i) && (combined.includes('game') || combined.includes('match') || combined.includes('round'))) {
    return true;
  }

  // Score patterns: "3-2", "Score over 100"
  if (combined.match(/\d+-\d+/) && (combined.includes('win') || combined.includes('score') || combined.includes('game'))) {
    return true;
  }

  return false;
}

// --- CATEGORY WHITELISTING ---

function categorizeWhitelisted(market: PolymarketMarket): CategoryResult {
  const q = market.question.toLowerCase();
  const desc = (market.description || '').toLowerCase();
  const combined = q + ' ' + desc;

  // EXCLUDE: Sports (comprehensive)
  if (isSports(market)) {
    return {
      category: 'excluded',
      reason: 'Sports market',
      confidence: 0.95,
    };
  }

  // EXCLUDE: Crypto prices
  const cryptoKeywords = [
    'price', 'btc', 'eth', 'bitcoin', 'ethereum',
    'ath', 'above $', 'below $', 'token', 'sol ',
    'solana', 'usdt', 'usdc', 'token price',
    'market cap', 'mcap', 'doge', 'dogecoin',
    'crypto', 'memecoin', 'altcoin',
  ];

  if (cryptoKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'excluded',
      reason: 'Crypto price market',
      confidence: 0.9,
    };
  }

  // EXCLUDE: Government statistics
  const statsKeywords = ['gdp', 'inflation', 'cpi', 'unemployment', 'fed funds', 'fomc', 'interest rate'];
  if (statsKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'excluded',
      reason: 'Government statistics',
      confidence: 0.9,
    };
  }

  // EXCLUDE: Entertainment / pop culture
  const entertainmentKeywords = [
    'oscars', 'grammy', 'emmy', 'golden globe', 'box office',
    'billboard', 'album', 'movie', 'reality tv', 'bachelor',
    'survivor', 'idol',
  ];
  if (entertainmentKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'excluded',
      reason: 'Entertainment/pop culture',
      confidence: 0.85,
    };
  }

  // EXCLUDE: Weather
  const weatherKeywords = ['temperature', 'hurricane', 'tornado', 'weather', 'rainfall', 'snowfall'];
  if (weatherKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'excluded',
      reason: 'Weather market',
      confidence: 0.85,
    };
  }

  // GEOPOLITICAL
  const geoKeywords = [
    'israel', 'lebanon', 'iran', 'russia', 'ukraine',
    'war', 'offensive', 'capture', 'conflict',
    'military', 'strike', 'invasion', 'ceasefire',
    'nato', 'sanctions', 'embassy', 'territorial',
    'gaza', 'hamas', 'hezbollah', 'north korea',
    'china', 'taiwan', 'south china sea',
    'syria', 'yemen', 'houthi',
  ];

  if (geoKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'geopolitical',
      reason: 'Geopolitical event',
      confidence: 0.85,
    };
  }

  // TECHNOLOGY (AI focus)
  const aiKeywords = [
    'ai model', 'anthropic', 'openai', 'deepseek',
    'gpt', 'claude', 'gemini', 'release', 'launch',
    'best ai', 'llm', 'artificial intelligence',
    'chatgpt', 'copilot', 'ai safety', 'agi',
    'machine learning', 'neural', 'transformer',
    'apple', 'google', 'microsoft', 'meta ',
    'spacex', 'starship', 'neuralink',
  ];

  if (aiKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'technology',
      reason: 'AI/technology market',
      confidence: 0.85,
    };
  }

  // POLITICS
  const politicsKeywords = [
    'election', 'president', 'senator', 'congress',
    'shutdown', 'dhs', 'supreme', 'appointed',
    'resign', 'impeach', 'governor', 'mayor',
    'legislation', 'bill', 'executive order',
    'democrat', 'republican', 'gop', 'cabinet',
    'attorney general', 'secretary', 'veto',
    'trump', 'biden', 'pelosi',
    'pardon', 'indictment', 'conviction',
  ];

  if (politicsKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'politics',
      reason: 'Political event',
      confidence: 0.8,
    };
  }

  // BUSINESS
  const businessKeywords = [
    'ipo', 'merger', 'acquisition', 'ceo',
    'stock', 'company', 'tesla', 'layoff',
    'hire', 'revenue', 'earnings', 'bankrupt',
    'startup', 'valuation', 'vc ', 'funding',
    'tariff', 'trade deal', 'import', 'export',
  ];

  if (businessKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'business',
      reason: 'Business event',
      confidence: 0.75,
    };
  }

  // SCIENCE
  const scienceKeywords = [
    'space', 'satellite', 'rocket', 'orbit',
    'discovery', 'cure', 'vaccine', 'research',
    'fda', 'clinical trial', 'pandemic', 'virus',
    'mars', 'moon', 'asteroid', 'nasa',
    'crispr', 'gene', 'quantum',
  ];

  if (scienceKeywords.some(kw => combined.includes(kw))) {
    return {
      category: 'science',
      reason: 'Science/research market',
      confidence: 0.75,
    };
  }

  // Default: excluded
  return {
    category: 'excluded',
    reason: 'Does not match whitelisted categories',
    confidence: 0.6,
  };
}

// --- Time Bucketing ---

interface TimeBucket {
  immediate: (PolymarketMarket & CategoryResult & { hours_until_close: number })[];
  soon: (PolymarketMarket & CategoryResult)[];
  later: (PolymarketMarket & CategoryResult)[];
}

function getMarketsByClosingTime(markets: (PolymarketMarket & CategoryResult)[]): TimeBucket {
  const now = new Date();

  const immediate: TimeBucket['immediate'] = [];
  const soon: TimeBucket['soon'] = [];
  const later: TimeBucket['later'] = [];

  for (const market of markets) {
    if (!market.endDate) continue;

    const endDate = new Date(market.endDate);
    if (isNaN(endDate.getTime())) continue;

    const hoursUntilClose = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysUntilClose = hoursUntilClose / 24;

    if (daysUntilClose <= 2) {
      immediate.push({ ...market, hours_until_close: Math.round(hoursUntilClose) });
    } else if (daysUntilClose <= 7) {
      soon.push(market);
    } else if (daysUntilClose <= 30) {
      later.push(market);
    }
  }

  return { immediate, soon, later };
}

// --- Main Pipeline ---

async function main() {
  console.log('=== REFINED POLYMARKET MARKET SELECTION ===\n');

  // Step 1: Fetch all active markets
  console.log('Step 1: Fetching active markets...');
  const allMarkets = await fetchActiveMarkets();
  console.log(`  ${allMarkets.length} active markets\n`);

  // Step 2: Filter by volume
  console.log('Step 2: Filtering by volume (>= $1,000)...');
  const withVolume = allMarkets.filter(m => (m.volumeNum || 0) >= 1000);
  console.log(`  ${withVolume.length} markets with volume\n`);

  // Step 3: Categorize with whitelist
  console.log('Step 3: Categorizing with whitelist...');
  const categorized = withVolume.map(market => ({
    ...market,
    ...categorizeWhitelisted(market),
  }));

  const whitelisted = categorized.filter(m => m.category !== 'excluded');
  const excluded = categorized.filter(m => m.category === 'excluded');

  // Show exclusion breakdown
  const exclusionReasons: Record<string, number> = {};
  for (const m of excluded) {
    exclusionReasons[m.reason] = (exclusionReasons[m.reason] || 0) + 1;
  }
  console.log(`  ${whitelisted.length} whitelisted, ${excluded.length} excluded`);
  console.log('  Exclusion breakdown:');
  for (const [reason, count] of Object.entries(exclusionReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log();

  // Step 4: Split by closing time
  console.log('Step 4: Splitting by closing time...');
  const { immediate, soon, later } = getMarketsByClosingTime(whitelisted);

  console.log(`  ${immediate.length} closing in 0-48 hours (TODAY/TOMORROW)`);
  console.log(`  ${soon.length} closing in 3-7 days`);
  console.log(`  ${later.length} closing in 8-30 days\n`);

  // Step 5: Save outputs

  // PRIMARY: Markets closing today/tomorrow
  const immediateOutput = {
    generated_at: new Date().toISOString(),
    count: immediate.length,
    markets: immediate.map(m => ({
      id: m.id,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.category,
      category_reason: m.reason,
      end_date: m.endDate,
      hours_until_close: m.hours_until_close,
      volume: m.volumeNum,
      slug: m.slug,
    })).sort((a, b) => a.hours_until_close - b.hours_until_close),
  };

  writeFileSync(
    'data/immediate_markets.json',
    JSON.stringify(immediateOutput, null, 2)
  );

  // SECONDARY: All whitelisted markets for reference
  const now = Date.now();
  const allOutput = {
    generated_at: new Date().toISOString(),
    summary: {
      total_active: allMarkets.length,
      with_volume: withVolume.length,
      whitelisted: whitelisted.length,
      excluded: excluded.length,
      immediate: immediate.length,
      soon: soon.length,
      later: later.length,
      by_category: {
        geopolitical: whitelisted.filter(m => m.category === 'geopolitical').length,
        technology: whitelisted.filter(m => m.category === 'technology').length,
        politics: whitelisted.filter(m => m.category === 'politics').length,
        business: whitelisted.filter(m => m.category === 'business').length,
        science: whitelisted.filter(m => m.category === 'science').length,
      },
      exclusion_reasons: exclusionReasons,
    },
    immediate: immediate.map(m => ({
      id: m.id,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.category,
      category_reason: m.reason,
      end_date: m.endDate,
      hours_until_close: m.hours_until_close,
      volume: m.volumeNum,
      slug: m.slug,
    })),
    soon: soon.map(m => ({
      id: m.id,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.category,
      category_reason: m.reason,
      end_date: m.endDate,
      days_until_close: Math.round((new Date(m.endDate).getTime() - now) / (1000 * 60 * 60 * 24)),
      volume: m.volumeNum,
      slug: m.slug,
    })),
    later: later.map(m => ({
      id: m.id,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.category,
      category_reason: m.reason,
      end_date: m.endDate,
      days_until_close: Math.round((new Date(m.endDate).getTime() - now) / (1000 * 60 * 60 * 24)),
      volume: m.volumeNum,
      slug: m.slug,
    })),
  };

  writeFileSync(
    'data/whitelisted_markets.json',
    JSON.stringify(allOutput, null, 2)
  );

  // --- SUMMARY ---
  console.log('=== SUMMARY ===\n');
  console.log(`Total active:    ${allMarkets.length}`);
  console.log(`With volume:     ${withVolume.length}`);
  console.log(`Whitelisted:     ${whitelisted.length}`);
  console.log(`Excluded:        ${excluded.length}`);
  console.log(`\nBy category:`);
  for (const [cat, count] of Object.entries(allOutput.summary.by_category).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nBy timing:`);
  console.log(`  Immediate (0-48h): ${immediate.length}`);
  console.log(`  Soon (3-7d):       ${soon.length}`);
  console.log(`  Later (8-30d):     ${later.length}`);

  console.log(`\nSaved to data/immediate_markets.json (PRIMARY)`);
  console.log(`Saved to data/whitelisted_markets.json (ALL)\n`);

  // Show immediate markets
  if (immediate.length > 0) {
    console.log('--- MARKETS CLOSING TODAY/TOMORROW ---\n');
    const sorted = immediate.sort((a, b) => a.hours_until_close - b.hours_until_close);
    sorted.forEach((m, i) => {
      console.log(`${i + 1}. ${m.question}`);
      console.log(`   Category: ${m.category} | Closes in: ${m.hours_until_close}h | Volume: $${(m.volumeNum || 0).toLocaleString()}\n`);
    });
  } else {
    console.log('No whitelisted markets closing today/tomorrow.\n');
    // Show upcoming instead
    if (soon.length > 0) {
      console.log('--- NEXT UP: CLOSING IN 3-7 DAYS ---\n');
      soon.slice(0, 10).forEach((m, i) => {
        const daysLeft = Math.round((new Date(m.endDate).getTime() - now) / (1000 * 60 * 60 * 24));
        console.log(`${i + 1}. ${m.question}`);
        console.log(`   Category: ${m.category} | Closes in: ${daysLeft}d | Volume: $${(m.volumeNum || 0).toLocaleString()}\n`);
      });
    }
  }
}

main().catch(console.error);

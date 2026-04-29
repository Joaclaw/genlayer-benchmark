/**
 * Market categorization logic
 * Copied from select_target_markets.ts for isolation
 */

import { WhitelistedCategory } from './types';

interface MarketForCategorization {
  question: string;
  description?: string;
}

interface CategoryResult {
  category: WhitelistedCategory | 'excluded';
  reason: string;
  confidence: number;
}

/**
 * Detect if a market is sports-related
 */
export function isSports(market: MarketForCategorization): boolean {
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

/**
 * Categorize a market into whitelisted categories or exclude it
 */
export function categorizeMarket(market: MarketForCategorization): CategoryResult {
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

  // Default: excluded (doesn't match whitelisted categories)
  return {
    category: 'excluded',
    reason: 'Does not match whitelisted categories',
    confidence: 0.6,
  };
}

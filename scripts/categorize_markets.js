const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'benchmark_results.json');
const outputPath = path.join(__dirname, '..', 'data', 'market_categories.json');

const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const results = raw.results;

// --- Classification patterns ---

const DETERMINISTIC_PATTERNS = [
  // Token/crypto prices
  /\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge|dogecoin|ada|cardano|bnb|avax|matic|polygon|shib|link|dot|uni|aave|mkr)\b.*\b(price|above|below|over|under|hit|reach|close|worth)\b/i,
  /\bprice\b.*\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge|ada|bnb|avax|matic|polygon|shib|link|dot|uni|token|coin|crypto)\b/i,
  /\b(token|coin|crypto)\s*(price|value)\b/i,
  /\$([\d,]+)\s*(btc|bitcoin|eth|ethereum|sol|solana)/i,
  /\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge)\b.*\$[\d,]+/i,

  // Government statistics / economic data
  /\b(gdp|inflation|unemployment|cpi|ppi|nonfarm|payroll|jobs report|interest rate|fed funds|federal reserve)\b/i,
  /\b(census|bureau of labor|bls|bea\.gov)\b/i,
  /\b(treasury yield|bond yield|10-year|2-year)\b/i,

  // Sports scores / results
  /\b(super bowl|world series|nba finals|stanley cup|world cup final)\b.*\b(win|champion|score|defeat)\b/i,
  /\bwho (won|wins)\b.*\b(game|match|series|championship|tournament|fight|bout)\b/i,
  /\b(final score|game result|match result)\b/i,

  // Elections - official vote counts
  /\b(electoral vote|popular vote|vote count|certified|election result)\b/i,

  // Official records with single authoritative source
  /\b(nasa|noaa|usgs|fda approved|sec filing)\b/i,
];

const NON_DETERMINISTIC_PATTERNS = [
  // Future predictions / speculation
  /\bwill\b.*\b(happen|occur|take place|announce|launch|release|resign|fire|hire|invade|attack|sanction|ban|legalize|pass|sign|veto|default|collapse|crash|surge|rally|moon|pump|dump)\b/i,

  // Subjective assessments
  /\b(successful|effective|popular|controversial|dominant|leading|best|worst|top|bottom|significant|major|historic)\b/i,

  // Analysis / judgment required
  /\b(impact|effect|influence|lead to|result in|cause|trigger|spark)\b/i,

  // Speculation language
  /\b(likely|expected|projected|forecast|predict|anticipate|speculate|rumor|reportedly|allegedly)\b/i,

  // Political predictions
  /\bwill\b.*\b(trump|biden|congress|senate|house|democrat|republican|gop)\b/i,

  // Policy / regulatory predictions
  /\bwill\b.*\b(tariff|sanction|ban|regulate|approve|reject|pass|veto|executive order)\b/i,

  // Market / company predictions
  /\bwill\b.*\b(ipo|merge|acquire|bankrupt|delist|layoff|recall)\b/i,
];

const HISTORICAL_SNAPSHOT_PATTERNS = [
  /\b(as of|on january|on february|on march|on april|on may|on june|on july|on august|on september|on october|on november|on december)\b/i,
  /\bby (january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i,
  /\b(by end of|at the end of|before|by close of)\b.*\b(2024|2025|2026|q[1-4])\b/i,
  /\bleaderboard\b/i,
  /\branking\b.*\b(on|as of|by)\b/i,
  /\b(end of year|year-end|eoy)\b/i,
];

// More precise deterministic detection for specific question types
function isDeterministicByContent(question, url) {
  const q = question.toLowerCase();
  const u = (url || '').toLowerCase();

  // Crypto price questions with specific numbers
  if (/\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge|bnb|ada)\b/.test(q) &&
      /\b(price|above|below|over|under|hit|reach|close at|trade at)\b/.test(q) &&
      /\$[\d,]+|\d+[kK]/.test(q)) {
    return { is: true, reason: 'Crypto price threshold question' };
  }

  // Government economic statistics
  if (/\b(gdp|inflation|cpi|unemployment|nonfarm|payrolls?|interest rate|fed fund)\b/.test(q) &&
      /\b(above|below|higher|lower|increase|decrease|growth|shrink|negative|positive)\b/.test(q)) {
    return { is: true, reason: 'Government economic statistic' };
  }

  // Sports final results - very specific
  if (/\bwho (won|wins) the\b/.test(q) && /\b(super bowl|world series|nba|stanley cup|champions league)\b/.test(q)) {
    return { is: true, reason: 'Sports championship result' };
  }

  // Election official results
  if (/\b(win the election|elected|re-elected|electoral college|certified winner)\b/.test(q)) {
    return { is: true, reason: 'Election official result' };
  }

  // URL-based detection
  if (/fred\.stlouisfed\.org/.test(u)) {
    return { is: true, reason: 'Federal Reserve economic data (FRED)' };
  }
  if (/bls\.gov|bea\.gov|census\.gov/.test(u)) {
    return { is: true, reason: 'Government statistical agency data' };
  }
  if (/espn\.com\/.*score|nfl\.com\/scores|nba\.com\/game/.test(u)) {
    return { is: true, reason: 'Official sports score source' };
  }

  return { is: false };
}

function isHistoricalSnapshot(question) {
  const q = question.toLowerCase();

  // "by [date]" patterns where date is in the past
  if (/\bby (end of |)(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(,?\s*\d{4})?/i.test(q)) {
    return { is: true, reason: 'Historical event by specific date' };
  }

  // "before [date]" patterns
  if (/\bbefore (january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(q)) {
    return { is: true, reason: 'Historical event before specific date' };
  }

  // Leaderboard / ranking at specific time
  if (/\b(leaderboard|ranking|ranked|standings)\b.*\b(on|as of|by)\b/i.test(q)) {
    return { is: true, reason: 'Ranking/leaderboard at specific point in time' };
  }

  // "in 2025" with past-tense or state-checking language for completed events
  if (/\bin (2024|2025)\b/.test(q) && /\b(total|number of|how many|count)\b/.test(q)) {
    return { is: true, reason: 'Historical count/total for past period' };
  }

  return { is: false };
}

function categorizeMarket(market) {
  const q = market.question || '';
  const url = market.resolution_url || '';

  // Step 1: Check for deterministic by content analysis
  const detCheck = isDeterministicByContent(q, url);
  if (detCheck.is) {
    return { category: 'deterministic', reason: detCheck.reason };
  }

  // Step 2: Check regex patterns for deterministic
  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (pattern.test(q)) {
      return { category: 'deterministic', reason: 'Pattern match: ' + pattern.source.substring(0, 50) };
    }
  }

  // Step 3: Check historical snapshot
  const histCheck = isHistoricalSnapshot(q);
  if (histCheck.is) {
    return { category: 'historical_snapshot', reason: histCheck.reason };
  }
  for (const pattern of HISTORICAL_SNAPSHOT_PATTERNS) {
    if (pattern.test(q)) {
      return { category: 'historical_snapshot', reason: 'Snapshot pattern: ' + pattern.source.substring(0, 50) };
    }
  }

  // Step 4: Check non-deterministic patterns
  for (const pattern of NON_DETERMINISTIC_PATTERNS) {
    if (pattern.test(q)) {
      return { category: 'non_deterministic', reason: 'Non-deterministic pattern: ' + pattern.source.substring(0, 50) };
    }
  }

  // Step 5: Heuristic - questions starting with "Will" are generally predictions
  if (/^will\b/i.test(q.trim())) {
    return { category: 'non_deterministic', reason: 'Predictive question (starts with "Will")' };
  }

  // Step 6: Questions with "?" that don't match anything else
  // If the question references future outcomes or events
  if (/\bwill\b/i.test(q)) {
    return { category: 'non_deterministic', reason: 'Contains "will" - future prediction' };
  }

  // Default: needs review
  return { category: 'needs_review', reason: 'No clear classification pattern matched' };
}

function getCurrentStatus(market) {
  if (market.resolvable && market.correct) return 'resolved_correct';
  if (market.resolvable && !market.correct) return 'resolved_incorrect';
  if (market.failure_reason) return 'failed_' + market.failure_reason;
  return 'unknown';
}

// --- Process all markets ---
const categorizedMarkets = results.map(market => {
  const { category, reason } = categorizeMarket(market);
  return {
    id: market.market_id,
    question: market.question,
    category,
    category_reason: reason,
    current_status: getCurrentStatus(market),
    resolvable: market.resolvable,
    polymarket_result: market.polymarket_result,
    genlayer_result: market.genlayer_result,
    correct: market.correct || false,
    failure_reason: market.failure_reason || ''
  };
});

// --- Compute stats ---
const counts = {
  deterministic: 0,
  non_deterministic: 0,
  historical_snapshot: 0,
  needs_review: 0
};

categorizedMarkets.forEach(m => { counts[m.category]++; });

// Compute per-category stats
function categoryStats(markets, cat) {
  const inCat = markets.filter(m => m.category === cat);
  const resolvable = inCat.filter(m => m.resolvable);
  const correct = inCat.filter(m => m.correct);
  const failed = inCat.filter(m => m.failure_reason);
  return {
    total: inCat.length,
    resolvable: resolvable.length,
    correct: correct.length,
    accuracy: resolvable.length > 0 ? Math.round((correct.length / resolvable.length) * 1000) / 10 : 0,
    failed: failed.length,
    failure_rate: inCat.length > 0 ? Math.round((failed.length / inCat.length) * 1000) / 10 : 0
  };
}

const output = {
  categorized_at: new Date().toISOString(),
  total_markets: results.length,
  categories: counts,
  category_stats: {
    deterministic: categoryStats(categorizedMarkets, 'deterministic'),
    non_deterministic: categoryStats(categorizedMarkets, 'non_deterministic'),
    historical_snapshot: categoryStats(categorizedMarkets, 'historical_snapshot'),
    needs_review: categoryStats(categorizedMarkets, 'needs_review')
  },
  markets: categorizedMarkets
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log('\n=== Market Categorization Complete ===\n');
console.log(`Total markets: ${results.length}`);
console.log(`  Deterministic:       ${counts.deterministic} (${(counts.deterministic / results.length * 100).toFixed(1)}%)`);
console.log(`  Non-Deterministic:   ${counts.non_deterministic} (${(counts.non_deterministic / results.length * 100).toFixed(1)}%)`);
console.log(`  Historical Snapshot: ${counts.historical_snapshot} (${(counts.historical_snapshot / results.length * 100).toFixed(1)}%)`);
console.log(`  Needs Review:        ${counts.needs_review} (${(counts.needs_review / results.length * 100).toFixed(1)}%)`);

console.log('\n--- Per-Category Performance ---');
for (const [cat, stats] of Object.entries(output.category_stats)) {
  console.log(`\n${cat.toUpperCase()}:`);
  console.log(`  Total: ${stats.total}, Resolvable: ${stats.resolvable}, Correct: ${stats.correct}`);
  console.log(`  Accuracy (of resolved): ${stats.accuracy}%`);
  console.log(`  Failed: ${stats.failed} (${stats.failure_rate}%)`);
}

console.log(`\nOutput written to: ${outputPath}`);

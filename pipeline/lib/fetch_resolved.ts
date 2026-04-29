/**
 * Step 1: Fetch recently-resolved markets from Polymarket CLOB API
 *
 * Usage: npx ts-node scripts/benchmark/fetch_resolved.ts
 *
 * Output: data/benchmark/resolved_markets.json
 */

import { writeFileSync } from 'fs';
import { categorizeMarket } from './categorize';
import { ResolvedMarket, ResolvedMarketsFile } from './types';

// ============================================================================
// Configuration
// ============================================================================

// Lookback window - can be overridden with LOOKBACK_DAYS env var
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '30', 10);
const CLOB_API_BASE = 'https://clob.polymarket.com';
const REQUEST_DELAY_MS = 200;

// ============================================================================
// Types for CLOB API response
// ============================================================================

interface CLOBMarket {
  condition_id: string;
  question_id?: string;
  question: string;
  description?: string;
  end_date_iso?: string;
  game_start_time?: string;
  market_slug?: string;
  outcome?: string;        // "Yes" | "No" | null
  tokens?: Array<{
    outcome: string;
    winner: boolean;
  }>;
  closed?: boolean;
  active?: boolean;
}

// ============================================================================
// Main Functions
// ============================================================================

interface CLOBResponse {
  data: CLOBMarket[];
  next_cursor?: string;
}

async function fetchClosedMarkets(): Promise<CLOBMarket[]> {
  const markets: CLOBMarket[] = [];
  let cursor: string | undefined = undefined;
  const limit = 100;

  console.log('Fetching closed markets from CLOB API...');

  while (true) {
    let url = `${CLOB_API_BASE}/markets?closed=true&limit=${limit}`;
    if (cursor) {
      url += `&next_cursor=${cursor}`;
    }

    if (markets.length % 500 === 0) {
      console.log(`  Fetched ${markets.length} markets...`);
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`HTTP error ${response.status}`);
        break;
      }

      const json: CLOBResponse = await response.json();
      const batch = json.data;

      if (!batch || batch.length === 0) {
        break;
      }

      markets.push(...batch);

      // Check for more pages
      if (json.next_cursor) {
        cursor = json.next_cursor;
      } else {
        break;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));

      // Safety limit to avoid infinite loops
      if (markets.length > 50000) {
        console.log('  Reached safety limit of 50000 markets');
        break;
      }

    } catch (error) {
      console.error(`Error fetching:`, error);
      break;
    }
  }

  console.log(`Fetched ${markets.length} total closed markets`);
  return markets;
}

function filterRecentMarkets(markets: CLOBMarket[], lookbackDays: number): CLOBMarket[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  return markets.filter(m => {
    // Must have tokens with Yes/No outcomes
    if (!m.tokens || m.tokens.length !== 2) return false;

    // Check if this is a Yes/No market (not a multi-outcome like sports)
    const outcomes = m.tokens.map(t => t.outcome);
    if (!outcomes.includes('Yes') || !outcomes.includes('No')) {
      return false;
    }

    // Must have a winner
    const winner = m.tokens.find(t => t.winner);
    if (!winner) return false;

    // Set outcome for later use
    m.outcome = winner.outcome;

    // Must have end date
    const endDate = m.end_date_iso || m.game_start_time;
    if (!endDate) return false;

    const marketEndDate = new Date(endDate);
    if (isNaN(marketEndDate.getTime())) return false;

    // Must be within lookback window
    return marketEndDate >= cutoffDate;
  });
}

function processMarkets(markets: CLOBMarket[]): ResolvedMarket[] {
  const processed: ResolvedMarket[] = [];

  for (const m of markets) {
    const categoryResult = categorizeMarket({
      question: m.question,
      description: m.description,
    });

    // Skip excluded markets
    if (categoryResult.category === 'excluded') {
      continue;
    }

    // Determine outcome
    let outcome: 'Yes' | 'No';
    if (m.outcome === 'Yes' || m.outcome === 'No') {
      outcome = m.outcome;
    } else if (m.tokens) {
      const winner = m.tokens.find(t => t.winner);
      if (winner && (winner.outcome === 'Yes' || winner.outcome === 'No')) {
        outcome = winner.outcome;
      } else {
        continue; // Skip if we can't determine outcome
      }
    } else {
      continue;
    }

    processed.push({
      id: m.condition_id || m.market_slug || `unknown-${processed.length}`,
      question: m.question,
      description: m.description || '',
      outcome,
      end_date: m.end_date_iso || m.game_start_time || '',
      resolution_url: undefined, // CLOB doesn't provide this
      category: categoryResult.category,
      category_reason: categoryResult.reason,
    });
  }

  return processed;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== FETCH RESOLVED MARKETS ===\n');
  console.log(`Lookback: ${LOOKBACK_DAYS} days\n`);

  // Step 1: Fetch all closed markets
  const allClosed = await fetchClosedMarkets();

  // Step 2: Filter to recent markets with outcomes
  console.log(`\nFiltering to last ${LOOKBACK_DAYS} days with valid outcomes...`);
  const recent = filterRecentMarkets(allClosed, LOOKBACK_DAYS);
  console.log(`Found ${recent.length} recent resolved markets`);

  // Step 3: Categorize and filter to whitelisted
  console.log('\nCategorizing markets...');
  const processed = processMarkets(recent);
  console.log(`${processed.length} markets after filtering to whitelisted categories`);

  // Count by category
  const byCategory: Record<string, number> = {};
  for (const m of processed) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  }

  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Step 4: Save output
  const output: ResolvedMarketsFile = {
    generated_at: new Date().toISOString(),
    lookback_days: LOOKBACK_DAYS,
    stats: {
      total_from_api: allClosed.length,
      after_filter: processed.length,
      by_category: byCategory,
    },
    markets: processed,
  };

  const outputPath = 'data/benchmark/resolved_markets.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  // Show sample
  if (processed.length > 0) {
    console.log('\n--- SAMPLE MARKETS ---\n');
    processed.slice(0, 5).forEach((m, i) => {
      console.log(`${i + 1}. ${m.question}`);
      console.log(`   Outcome: ${m.outcome} | Category: ${m.category}`);
      console.log();
    });
  }
}

main().catch(console.error);

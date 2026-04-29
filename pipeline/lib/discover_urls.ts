/**
 * Step 2: Discover URLs for resolved markets using Exa AI
 *
 * Usage: npx ts-node scripts/benchmark/discover_urls.ts
 *
 * Requires: EXA_API_KEY in .env
 *
 * Output: data/benchmark/discovered_urls.json
 */

import { readFileSync, writeFileSync } from 'fs';
import Exa from 'exa-js';
import * as dotenv from 'dotenv';
import {
  ResolvedMarketsFile,
  MarketURLs,
  DiscoveredURL,
  DiscoveredURLsFile,
} from './types';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const EXA_API_KEY = process.env.EXA_API_KEY;
const MAX_RESULTS_PER_SEARCH = 10;  // Get more, then diversify
const REQUEST_DELAY_MS = 500;       // Rate limiting

if (!EXA_API_KEY) {
  console.error('ERROR: EXA_API_KEY not found in environment');
  console.error('Add EXA_API_KEY=your_key to .env file');
  process.exit(1);
}

const exa = new Exa(EXA_API_KEY);

// ============================================================================
// URL Discovery
// ============================================================================

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www. prefix for consistency
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function diversifyByDomain(urls: Array<{ url: string; title: string; score: number }>): DiscoveredURL[] {
  const seenDomains = new Set<string>();
  const diversified: DiscoveredURL[] = [];

  // Sort by score descending
  const sorted = [...urls].sort((a, b) => b.score - a.score);

  for (const item of sorted) {
    const domain = extractDomain(item.url);

    // Skip if we already have this domain
    if (seenDomains.has(domain)) {
      continue;
    }

    seenDomains.add(domain);
    diversified.push({
      url: item.url,
      title: item.title,
      domain,
      relevance_score: item.score,
    });

    // Stop after we have enough diverse URLs
    if (diversified.length >= 5) {
      break;
    }
  }

  return diversified;
}

async function discoverURLsForMarket(
  marketId: string,
  question: string,
  outcome: 'Yes' | 'No'
): Promise<MarketURLs> {
  try {
    // Build search query
    // Include the outcome to find articles confirming the resolution
    const outcomeText = outcome === 'Yes' ? 'confirmed' : 'denied';
    const query = `${question} ${outcomeText} announced resolved`;

    const response = await exa.search(query, {
      numResults: MAX_RESULTS_PER_SEARCH,
      useAutoprompt: true,
      type: 'neural',
    });

    if (!response.results || response.results.length === 0) {
      return {
        market_id: marketId,
        question,
        outcome,
        discovered_urls: [],
        discovery_status: 'no_results',
      };
    }

    // Extract URLs with scores
    const urls = response.results.map(r => ({
      url: r.url,
      title: r.title || '',
      score: r.score || 0,
    }));

    // Diversify by domain (require different domains)
    const diversified = diversifyByDomain(urls);

    return {
      market_id: marketId,
      question,
      outcome,
      discovered_urls: diversified,
      discovery_status: 'success',
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  Error searching for "${question.slice(0, 50)}...": ${errorMessage}`);

    return {
      market_id: marketId,
      question,
      outcome,
      discovered_urls: [],
      discovery_status: 'api_error',
      discovery_error: errorMessage,
    };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== DISCOVER URLS ===\n');

  // Load resolved markets
  const inputPath = 'data/benchmark/resolved_markets.json';
  let input: ResolvedMarketsFile;

  try {
    input = JSON.parse(readFileSync(inputPath, 'utf-8'));
  } catch (error) {
    console.error(`ERROR: Cannot read ${inputPath}`);
    console.error('Run fetch_resolved.ts first');
    process.exit(1);
  }

  console.log(`Loaded ${input.markets.length} resolved markets\n`);

  const results: MarketURLs[] = [];
  let successCount = 0;
  let noResultsCount = 0;
  let errorCount = 0;

  for (let i = 0; i < input.markets.length; i++) {
    const market = input.markets[i];
    console.log(`[${i + 1}/${input.markets.length}] ${market.question.slice(0, 60)}...`);

    const result = await discoverURLsForMarket(
      market.id,
      market.question,
      market.outcome
    );

    results.push(result);

    if (result.discovery_status === 'success') {
      successCount++;
      console.log(`  Found ${result.discovered_urls.length} URLs from ${result.discovered_urls.length} domains`);
    } else if (result.discovery_status === 'no_results') {
      noResultsCount++;
      console.log('  No results found');
    } else {
      errorCount++;
      console.log(`  Error: ${result.discovery_error}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  // Save output
  const output: DiscoveredURLsFile = {
    generated_at: new Date().toISOString(),
    stats: {
      total_markets: input.markets.length,
      with_urls: successCount,
      no_results: noResultsCount,
      api_errors: errorCount,
    },
    markets: results,
  };

  const outputPath = 'data/benchmark/discovered_urls.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\n=== SUMMARY ===\n');
  console.log(`Total markets:   ${input.markets.length}`);
  console.log(`With URLs:       ${successCount}`);
  console.log(`No results:      ${noResultsCount}`);
  console.log(`API errors:      ${errorCount}`);
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(console.error);

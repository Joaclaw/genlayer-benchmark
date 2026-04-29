/**
 * Step 3: Validate discovered URLs for accessibility and relevance
 *
 * Usage: npx ts-node scripts/benchmark/validate_urls.ts
 *
 * Requires: OPENAI_API_KEY in .env (for relevance check)
 *
 * Output: data/benchmark/validated_urls.json
 */

import { readFileSync, writeFileSync } from 'fs';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import {
  DiscoveredURLsFile,
  MarketValidatedURLs,
  ValidatedURL,
  ValidatedURLsFile,
  ValidationError,
} from './types';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FETCH_TIMEOUT_MS = 10000;
const MIN_CONTENT_LENGTH = 500;
const REQUIRED_URLS = 3;

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in environment');
  console.error('Add OPENAI_API_KEY=your_key to .env file');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ============================================================================
// Anti-bot Detection Patterns
// ============================================================================

const ANTI_BOT_PATTERNS = [
  'access denied',
  'please verify you are human',
  'enable javascript',
  'checking your browser',
  'captcha',
  'cloudflare',
  'just a moment',
  'ray id',
  'attention required',
  'blocked',
  'forbidden',
];

const PAYWALL_PATTERNS = [
  'subscribe to continue',
  'subscription required',
  'paywall',
  'premium content',
  'sign in to read',
  'create an account to continue',
  'members only',
];

// ============================================================================
// URL Validation Functions
// ============================================================================

async function fetchContent(url: string): Promise<{ content: string; error?: ValidationError }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        return { content: '', error: 'http_403_forbidden' };
      } else if (response.status === 404) {
        return { content: '', error: 'http_404_not_found' };
      } else if (response.status >= 500) {
        return { content: '', error: 'http_5xx_server_error' };
      }
      return { content: '', error: 'http_connection_error' };
    }

    const html = await response.text();
    // Basic HTML to text extraction
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { content: text };

  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { content: '', error: 'http_timeout' };
      }
    }
    return { content: '', error: 'http_connection_error' };
  }
}

function checkContentQuality(content: string): ValidationError | null {
  const contentLower = content.toLowerCase();

  // Check length
  if (content.length < MIN_CONTENT_LENGTH) {
    return 'content_too_short';
  }

  // Check for anti-bot
  for (const pattern of ANTI_BOT_PATTERNS) {
    if (contentLower.includes(pattern)) {
      return 'content_anti_bot';
    }
  }

  // Check for paywall
  for (const pattern of PAYWALL_PATTERNS) {
    if (contentLower.includes(pattern)) {
      return 'content_paywall';
    }
  }

  return null;
}

async function checkRelevance(content: string, question: string): Promise<{ relevant: boolean; error?: ValidationError }> {
  try {
    const prompt = `You are checking if a webpage contains information relevant to answering a prediction market question.

Question: ${question}

Webpage content (first 3000 chars):
${content.slice(0, 3000)}

Does this webpage contain information that could help answer the prediction market question above?
Respond with ONLY "YES" or "NO".`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0,
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
    return { relevant: answer === 'YES' };

  } catch (error) {
    return { relevant: false, error: 'relevance_check_failed' };
  }
}

async function validateURL(
  url: string,
  title: string,
  domain: string,
  question: string
): Promise<ValidatedURL> {
  // Step 1: Fetch content
  const { content, error: fetchError } = await fetchContent(url);

  if (fetchError) {
    return {
      url,
      title,
      domain,
      accessible: false,
      relevant: false,
      validation_error: fetchError,
    };
  }

  // Step 2: Check content quality
  const qualityError = checkContentQuality(content);
  if (qualityError) {
    return {
      url,
      title,
      domain,
      accessible: false,
      relevant: false,
      validation_error: qualityError,
      content_preview: content.slice(0, 200),
    };
  }

  // Step 3: Check relevance
  const { relevant, error: relevanceError } = await checkRelevance(content, question);

  if (relevanceError) {
    return {
      url,
      title,
      domain,
      accessible: true,
      relevant: false,
      validation_error: relevanceError,
      content_preview: content.slice(0, 200),
    };
  }

  if (!relevant) {
    return {
      url,
      title,
      domain,
      accessible: true,
      relevant: false,
      validation_error: 'relevance_irrelevant',
      content_preview: content.slice(0, 200),
    };
  }

  // Success!
  return {
    url,
    title,
    domain,
    accessible: true,
    relevant: true,
    content_preview: content.slice(0, 200),
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== VALIDATE URLS ===\n');

  // Load discovered URLs
  const inputPath = 'data/benchmark/discovered_urls.json';
  let input: DiscoveredURLsFile;

  try {
    input = JSON.parse(readFileSync(inputPath, 'utf-8'));
  } catch (error) {
    console.error(`ERROR: Cannot read ${inputPath}`);
    console.error('Run discover_urls.ts first');
    process.exit(1);
  }

  console.log(`Loaded ${input.markets.length} markets with discovered URLs\n`);

  const results: MarketValidatedURLs[] = [];
  let totalUrlsChecked = 0;
  let accessibleAndRelevant = 0;
  let failedAccessibility = 0;
  let failedRelevance = 0;

  for (let i = 0; i < input.markets.length; i++) {
    const market = input.markets[i];
    console.log(`[${i + 1}/${input.markets.length}] ${market.question.slice(0, 50)}...`);

    if (market.discovered_urls.length === 0) {
      results.push({
        market_id: market.market_id,
        question: market.question,
        outcome: market.outcome,
        validated_urls: [],
        selected_urls: [],
        validation_status: 'no_sources',
      });
      console.log('  No URLs to validate');
      continue;
    }

    const validatedUrls: ValidatedURL[] = [];

    for (const discoveredUrl of market.discovered_urls) {
      totalUrlsChecked++;

      const validated = await validateURL(
        discoveredUrl.url,
        discoveredUrl.title,
        discoveredUrl.domain,
        market.question
      );

      validatedUrls.push(validated);

      if (validated.accessible && validated.relevant) {
        accessibleAndRelevant++;
        console.log(`  [OK] ${discoveredUrl.domain}`);
      } else if (!validated.accessible) {
        failedAccessibility++;
        console.log(`  [FAIL:accessibility] ${discoveredUrl.domain}: ${validated.validation_error}`);
      } else {
        failedRelevance++;
        console.log(`  [FAIL:relevance] ${discoveredUrl.domain}: ${validated.validation_error}`);
      }
    }

    // Select top URLs that passed validation
    const selectedUrls = validatedUrls
      .filter(v => v.accessible && v.relevant)
      .slice(0, REQUIRED_URLS)
      .map(v => v.url);

    let validationStatus: 'sufficient' | 'insufficient_sources' | 'no_sources';
    if (selectedUrls.length >= REQUIRED_URLS) {
      validationStatus = 'sufficient';
    } else if (selectedUrls.length > 0) {
      validationStatus = 'insufficient_sources';
    } else {
      validationStatus = 'no_sources';
    }

    results.push({
      market_id: market.market_id,
      question: market.question,
      outcome: market.outcome,
      validated_urls: validatedUrls,
      selected_urls: selectedUrls,
      validation_status: validationStatus,
    });

    console.log(`  Selected: ${selectedUrls.length}/${REQUIRED_URLS} URLs`);
  }

  // Count final stats
  const sufficientCount = results.filter(r => r.validation_status === 'sufficient').length;
  const insufficientCount = results.filter(r => r.validation_status === 'insufficient_sources').length;
  const noSourcesCount = results.filter(r => r.validation_status === 'no_sources').length;

  // Save output
  const output: ValidatedURLsFile = {
    generated_at: new Date().toISOString(),
    stats: {
      total_markets: input.markets.length,
      sufficient_sources: sufficientCount,
      insufficient_sources: insufficientCount,
      no_sources: noSourcesCount,
      total_urls_checked: totalUrlsChecked,
      accessible_and_relevant: accessibleAndRelevant,
      failed_accessibility: failedAccessibility,
      failed_relevance: failedRelevance,
    },
    markets: results,
  };

  const outputPath = 'data/benchmark/validated_urls.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\n=== SUMMARY ===\n');
  console.log(`Total markets:      ${input.markets.length}`);
  console.log(`Sufficient (3+):    ${sufficientCount}`);
  console.log(`Insufficient (<3):  ${insufficientCount}`);
  console.log(`No sources:         ${noSourcesCount}`);
  console.log();
  console.log(`URLs checked:       ${totalUrlsChecked}`);
  console.log(`Accessible+relevant: ${accessibleAndRelevant}`);
  console.log(`Failed accessibility: ${failedAccessibility}`);
  console.log(`Failed relevance:   ${failedRelevance}`);
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(console.error);

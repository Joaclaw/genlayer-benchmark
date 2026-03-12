/**
 * Multi-URL Resolution Pilot Script
 *
 * Takes 10 non-deterministic markets that previously failed due to bad URLs,
 * uses Exa AI to find 3 accessible URLs per market, then submits to GenLayer
 * for multi-URL consensus resolution.
 *
 * Usage:
 *   EXA_API_KEY=... CONTRACT_ADDRESS=... npx tsx scripts/pilot_multi_url.ts
 *
 * Optional env vars:
 *   GENLAYER_PRIVATE_KEY - Account private key (generates new if not set)
 *   PILOT_COUNT - Number of markets to test (default: 10)
 *   SKIP_GENLAYER - Set to "true" to only run URL discovery (no contract calls)
 */

import { findAccessibleURLs, URLDiscoveryResult } from '../lib/agentic-search';
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import fs from 'fs';
import path from 'path';

// ─── Load .env.local ─────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnvLocal();

// ─── Configuration ───────────────────────────────────────────────

const PILOT_COUNT = parseInt(process.env.PILOT_COUNT || '2', 10);
const SKIP_GENLAYER = process.env.SKIP_GENLAYER === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');

// Read contract address from .contract-address file or env
function getContractAddress(): `0x${string}` | undefined {
  if (process.env.CONTRACT_ADDRESS) {
    return process.env.CONTRACT_ADDRESS as `0x${string}`;
  }
  const addrPath = path.join(process.cwd(), '.contract-address');
  if (fs.existsSync(addrPath)) {
    const addr = fs.readFileSync(addrPath, 'utf-8').trim();
    if (addr) return addr as `0x${string}`;
  }
  return undefined;
}

const CONTRACT_ADDRESS = getContractAddress();

// ─── Load market data ────────────────────────────────────────────

interface CategoryMarket {
  id: string;
  question: string;
  category: string;
  category_reason: string;
  current_status: string;
  resolvable: boolean;
  polymarket_result: string;
  genlayer_result: string;
  correct: boolean;
  failure_reason: string;
}

interface PolymarketSample {
  id: string;
  question: string;
  description: string;
  end_date: string;
  outcome: string;
  resolution_url: string;
  category: string;
  polymarket_url: string;
}

function loadCategories(): CategoryMarket[] {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'market_categories.json'), 'utf-8');
  return JSON.parse(raw).markets;
}

function loadPolymarketSample(): PolymarketSample[] {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'polymarket_2000_sample.json'), 'utf-8');
  return JSON.parse(raw).markets;
}

// ─── Select pilot markets ────────────────────────────────────────

function selectPilotMarkets(count: number): Array<CategoryMarket & { end_date: string }> {
  const categories = loadCategories();
  const sample = loadPolymarketSample();
  const sampleMap = new Map(sample.map((m) => [m.id, m]));

  // Pick non-deterministic + needs_review markets that FAILED (not already resolved)
  const candidates = categories.filter(
    (m) =>
      (m.category === 'non_deterministic' || m.category === 'needs_review') &&
      !m.resolvable &&
      m.failure_reason !== '' &&
      sampleMap.has(m.id)
  );

  // Prioritize web access failures (most likely to benefit from new URLs)
  const webFailures = candidates.filter((m) => m.failure_reason.startsWith('web_'));
  const contentFailures = candidates.filter((m) => m.failure_reason.startsWith('content_'));
  const llmFailures = candidates.filter((m) => m.failure_reason.startsWith('llm_'));

  // Mix: mostly web failures, some content, some LLM
  const selected = [
    ...webFailures.slice(0, Math.ceil(count * 0.6)),
    ...contentFailures.slice(0, Math.ceil(count * 0.2)),
    ...llmFailures.slice(0, Math.ceil(count * 0.2)),
  ].slice(0, count);

  return selected.map((m) => ({
    ...m,
    end_date: sampleMap.get(m.id)?.end_date || '2026-01-31T00:00:00Z',
  }));
}

// ─── Main pilot function ─────────────────────────────────────────

async function runPilot() {
  console.log(`\n=== Multi-URL Resolution Pilot (${PILOT_COUNT} markets) ===\n`);

  // Select markets
  const markets = selectPilotMarkets(PILOT_COUNT);
  console.log(`Selected ${markets.length} markets for pilot:\n`);
  markets.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.failure_reason}] ${m.question.slice(0, 70)}`);
  });

  // ─── Phase 1: URL Discovery ──────────────────────────────────

  console.log(`\n--- Phase 1: URL Discovery (Exa AI) ---\n`);

  const discoveries: URLDiscoveryResult[] = [];

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    console.log(`  [${i + 1}/${markets.length}] Searching: ${market.question.slice(0, 60)}...`);

    try {
      const urls = await findAccessibleURLs(market.question, market.end_date);

      const discovery: URLDiscoveryResult = {
        market_id: market.id,
        question: market.question,
        expected: market.polymarket_result,
        urls: urls,
        accessible_count: urls.length,
        search_results_count: urls.length,
      };

      discoveries.push(discovery);
      console.log(
        `    -> Found ${urls.length} accessible URL(s)` +
          (urls.length > 0 ? `: ${urls.map((u) => new URL(u.url).hostname).join(', ')}` : '')
      );
    } catch (error: any) {
      console.log(`    -> ERROR: ${error.message}`);
      discoveries.push({
        market_id: market.id,
        question: market.question,
        expected: market.polymarket_result,
        urls: [],
        accessible_count: 0,
        search_results_count: 0,
        error: error.message,
      });
    }

    // Small delay to avoid rate limiting Exa
    if (i < markets.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Save URL discovery results
  const urlResultsPath = path.join(DATA_DIR, 'pilot_urls.json');
  fs.writeFileSync(
    urlResultsPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pilot_count: markets.length,
        discoveries,
        summary: {
          total: discoveries.length,
          with_3_urls: discoveries.filter((d) => d.accessible_count >= 3).length,
          with_2_urls: discoveries.filter((d) => d.accessible_count === 2).length,
          with_1_url: discoveries.filter((d) => d.accessible_count === 1).length,
          with_0_urls: discoveries.filter((d) => d.accessible_count === 0).length,
        },
      },
      null,
      2
    )
  );

  const readyCount = discoveries.filter((d) => d.accessible_count >= 3).length;
  console.log(`\n  URL Discovery complete:`);
  console.log(`    ${readyCount}/${markets.length} have 3+ accessible URLs`);
  console.log(`    Results saved to ${urlResultsPath}\n`);

  if (SKIP_GENLAYER) {
    console.log('  SKIP_GENLAYER=true, stopping after URL discovery.\n');
    printDiscoverySummary(discoveries);
    return;
  }

  // ─── Phase 2: GenLayer Submission ────────────────────────────

  if (!CONTRACT_ADDRESS) {
    console.log('  CONTRACT_ADDRESS not set. Skipping GenLayer submission.');
    console.log('  Deploy the contract first, then re-run with CONTRACT_ADDRESS=0x...\n');
    printDiscoverySummary(discoveries);
    return;
  }

  console.log(`--- Phase 2: GenLayer Submission ---\n`);

  const privateKey = process.env.GENLAYER_PRIVATE_KEY as `0x${string}` | undefined;
  const account = createAccount(privateKey);
  const client = createClient({ chain: studionet, account });

  console.log(`  Account: ${account.address}`);
  console.log(`  Contract: ${CONTRACT_ADDRESS}\n`);

  // Only submit markets with 3+ URLs
  const readyMarkets = discoveries.filter((d) => d.accessible_count >= 3);

  const submissions: Array<{
    market_id: string;
    question: string;
    tx_hash: string;
    urls: string[];
  }> = [];

  for (let i = 0; i < readyMarkets.length; i++) {
    const discovery = readyMarkets[i];
    const urls = discovery.urls.slice(0, 3).map((u) => u.url);

    console.log(`  [${i + 1}/${readyMarkets.length}] Submitting: ${discovery.question.slice(0, 55)}...`);
    console.log(`    URLs: ${urls.map((u) => new URL(u).hostname).join(', ')}`);

    try {
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'resolve_market',
        args: [
          discovery.market_id,
          discovery.question,
          urls[0],
          urls[1],
          urls[2],
          discovery.expected,
        ],
        value: 0n,
      });

      submissions.push({
        market_id: discovery.market_id,
        question: discovery.question,
        tx_hash: String(txHash),
        urls,
      });
      console.log(`    -> TX: ${String(txHash).slice(0, 20)}...`);
    } catch (error: any) {
      console.log(`    -> FAILED: ${error.message}`);
    }
  }

  console.log(`\n  Submitted ${submissions.length} markets to GenLayer.\n`);

  // ─── Phase 3: Wait for Results ───────────────────────────────

  if (submissions.length === 0) {
    console.log('  No submissions to wait for.\n');
    return;
  }

  console.log(`--- Phase 3: Waiting for Consensus ---\n`);

  const results: any[] = [];

  for (const sub of submissions) {
    console.log(`  Waiting for: ${sub.question.slice(0, 50)}...`);
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: sub.tx_hash as `0x${string}`,
        status: 'FINALIZED',
        retries: 60,
        interval: 5000,
      });

      // Read the result back from the contract
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_result',
        args: [sub.market_id],
      });

      results.push(result);
      const r = result as any;
      const icon = r.correct ? '[CORRECT]' : r.final_answer === 'UNCERTAIN' ? '[UNCERTAIN]' : '[WRONG]';
      console.log(
        `    -> ${icon} Expected: ${r.expected}, Got: ${r.final_answer}, Consensus: ${r.consensus_count}/3`
      );
    } catch (error: any) {
      console.log(`    -> TIMEOUT/ERROR: ${error.message}`);
      results.push({
        market_id: sub.market_id,
        question: sub.question,
        error: error.message,
      });
    }
  }

  // ─── Save Final Results ──────────────────────────────────────

  const pilotResultsPath = path.join(DATA_DIR, 'pilot_results.json');
  fs.writeFileSync(
    pilotResultsPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        contract_address: CONTRACT_ADDRESS,
        pilot_count: markets.length,
        submitted: submissions.length,
        results,
      },
      null,
      2
    )
  );

  console.log(`\n  Results saved to ${pilotResultsPath}\n`);

  // ─── Summary ─────────────────────────────────────────────────

  const resolved = results.filter((r) => r.final_answer && r.final_answer !== 'UNCERTAIN');
  const correct = results.filter((r) => r.correct === true);
  const uncertain = results.filter((r) => r.final_answer === 'UNCERTAIN');

  console.log(`\n=== PILOT RESULTS ===\n`);
  console.log(`  Markets tested:  ${markets.length}`);
  console.log(`  URLs found (3+): ${readyCount}`);
  console.log(`  Submitted:       ${submissions.length}`);
  console.log(`  Resolved:        ${resolved.length}`);
  console.log(`  Correct:         ${correct.length}/${resolved.length} (${resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0}%)`);
  console.log(`  Uncertain:       ${uncertain.length}`);
  console.log(`\n  Previously these ${markets.length} markets were ALL unresolvable.`);
  console.log(`  Now ${resolved.length} are resolved via multi-URL approach.\n`);
}

function printDiscoverySummary(discoveries: URLDiscoveryResult[]) {
  console.log(`\n=== URL DISCOVERY SUMMARY ===\n`);
  for (const d of discoveries) {
    const status =
      d.accessible_count >= 3
        ? '[READY]'
        : d.accessible_count > 0
          ? `[PARTIAL: ${d.accessible_count}/3]`
          : '[NO URLs]';
    console.log(`  ${status} ${d.question.slice(0, 65)}`);
    for (const url of d.urls) {
      console.log(`    - ${url.url} (conf: ${url.confidence.toFixed(2)})`);
    }
  }
  console.log('');
}

// ─── Run ─────────────────────────────────────────────────────────

runPilot().catch((error) => {
  console.error(`\nFatal error: ${error.message}\n`);
  process.exit(1);
});

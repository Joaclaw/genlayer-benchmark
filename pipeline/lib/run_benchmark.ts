/**
 * Step 4: Run the benchmark - submit markets to MultiURLResolver contract
 *
 * Usage: npx ts-node scripts/benchmark/run_benchmark.ts
 *
 * Requires:
 *   - GENLAYER_PRIVATE_KEY in .env
 *   - .contract-address file with deployed MultiURLResolver address
 *
 * Output: data/benchmark/benchmark_output.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from 'genlayer-js';
import * as dotenv from 'dotenv';
import {
  ValidatedURLsFile,
  BenchmarkResult,
  BenchmarkSkipped,
  BenchmarkOutput,
  URLResponse,
} from './types';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const GENLAYER_RPC_URL = process.env.GENLAYER_RPC_URL || 'https://studionet.genlayer.io:8443/api';

if (!GENLAYER_PRIVATE_KEY) {
  console.error('ERROR: GENLAYER_PRIVATE_KEY not found in environment');
  console.error('Add GENLAYER_PRIVATE_KEY=your_key to .env file');
  process.exit(1);
}

// Read contract address
let CONTRACT_ADDRESS: string;
try {
  CONTRACT_ADDRESS = readFileSync('.contract-address', 'utf-8').trim();
} catch (error) {
  console.error('ERROR: Cannot read .contract-address file');
  console.error('Deploy the MultiURLResolver contract first');
  process.exit(1);
}

console.log(`Contract address: ${CONTRACT_ADDRESS}`);
console.log(`RPC URL: ${GENLAYER_RPC_URL}\n`);

// ============================================================================
// GenLayer Client Setup
// ============================================================================

const client = createClient({
  endpoint: GENLAYER_RPC_URL,
  chain: 'studionet',
});

// ============================================================================
// Contract Interaction
// ============================================================================

interface ContractResult {
  market_id: string;
  question: string;
  urls_used: string[];
  url_responses: URLResponse[];
  final_answer: string;
  expected: string;
  correct: boolean;
  consensus_count: number;
  urls_fetched: number;
  urls_failed: number;
  reasoning: string;
  timestamp: string;
}

async function submitToContract(
  marketId: string,
  question: string,
  url1: string,
  url2: string,
  url3: string,
  expected: string
): Promise<ContractResult> {
  const account = client.createAccount(GENLAYER_PRIVATE_KEY as `0x${string}`);

  const hash = await client.writeContract({
    account,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'resolve_market',
    args: [marketId, question, url1, url2, url3, expected],
  });

  // Wait for transaction receipt
  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${receipt.status}`);
  }

  // The result is in the receipt
  const result = receipt.result as ContractResult;
  return result;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== RUN BENCHMARK ===\n');

  // Load validated URLs
  const inputPath = 'data/benchmark/validated_urls.json';
  let input: ValidatedURLsFile;

  try {
    input = JSON.parse(readFileSync(inputPath, 'utf-8'));
  } catch (error) {
    console.error(`ERROR: Cannot read ${inputPath}`);
    console.error('Run validate_urls.ts first');
    process.exit(1);
  }

  // Filter to markets with sufficient URLs
  const marketsToSubmit = input.markets.filter(m => m.validation_status === 'sufficient');
  const marketsToSkip = input.markets.filter(m => m.validation_status !== 'sufficient');

  console.log(`Total markets:     ${input.markets.length}`);
  console.log(`To submit (3+ URLs): ${marketsToSubmit.length}`);
  console.log(`To skip:           ${marketsToSkip.length}\n`);

  const results: BenchmarkResult[] = [];
  const skipped: BenchmarkSkipped[] = [];

  // Record skipped markets
  for (const market of marketsToSkip) {
    skipped.push({
      market_id: market.market_id,
      question: market.question,
      expected: market.outcome,
      skip_reason: market.validation_status === 'no_sources' ? 'no_sources' : 'insufficient_sources',
    });
  }

  // Submit markets
  let correctCount = 0;
  let incorrectCount = 0;
  let uncertainCount = 0;
  let totalUrlsFetched = 0;
  let totalConsensusCount = 0;

  for (let i = 0; i < marketsToSubmit.length; i++) {
    const market = marketsToSubmit[i];
    const urls = market.selected_urls;

    console.log(`[${i + 1}/${marketsToSubmit.length}] ${market.question.slice(0, 50)}...`);
    console.log(`  URLs: ${urls.map(u => new URL(u).hostname).join(', ')}`);

    try {
      const result = await submitToContract(
        market.market_id,
        market.question,
        urls[0],
        urls[1],
        urls[2],
        market.outcome
      );

      // Parse result
      const benchmarkResult: BenchmarkResult = {
        market_id: result.market_id,
        question: result.question,
        expected: market.outcome,
        urls_used: result.urls_used || urls,
        url_responses: result.url_responses || [],
        final_answer: result.final_answer as 'YES' | 'NO' | 'UNCERTAIN',
        correct: result.correct,
        consensus_count: result.consensus_count,
        urls_fetched: result.urls_fetched,
        urls_failed: result.urls_failed,
        reasoning: result.reasoning,
        timestamp: result.timestamp || new Date().toISOString(),
      };

      results.push(benchmarkResult);

      // Update counters
      if (benchmarkResult.final_answer === 'UNCERTAIN') {
        uncertainCount++;
        console.log('  Result: UNCERTAIN (no consensus)');
      } else if (benchmarkResult.correct) {
        correctCount++;
        console.log(`  Result: ${benchmarkResult.final_answer} (CORRECT)`);
      } else {
        incorrectCount++;
        console.log(`  Result: ${benchmarkResult.final_answer} vs ${market.outcome} (INCORRECT)`);
      }

      totalUrlsFetched += benchmarkResult.urls_fetched;
      totalConsensusCount += benchmarkResult.consensus_count;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${errorMessage}`);

      skipped.push({
        market_id: market.market_id,
        question: market.question,
        expected: market.outcome,
        skip_reason: 'submission_error',
        error: errorMessage,
      });
    }

    console.log();
  }

  // Calculate metrics
  const consensusReached = correctCount + incorrectCount;
  const accuracyPercent = consensusReached > 0 ? (correctCount / consensusReached) * 100 : 0;
  const resolutionRatePercent = results.length > 0 ? (consensusReached / results.length) * 100 : 0;

  // Build output
  const output: BenchmarkOutput = {
    generated_at: new Date().toISOString(),
    contract_address: CONTRACT_ADDRESS,
    summary: {
      total_resolved_markets: input.markets.length,
      markets_with_3_urls: marketsToSubmit.length,
      markets_submitted: results.length,
      markets_skipped: skipped.length,

      consensus_reached: consensusReached,
      correct: correctCount,
      incorrect: incorrectCount,
      uncertain: uncertainCount,
      accuracy_percent: Math.round(accuracyPercent * 10) / 10,
      resolution_rate_percent: Math.round(resolutionRatePercent * 10) / 10,

      avg_urls_fetched: results.length > 0 ? Math.round((totalUrlsFetched / results.length) * 10) / 10 : 0,
      avg_consensus_count: results.length > 0 ? Math.round((totalConsensusCount / results.length) * 10) / 10 : 0,
    },
    results,
    skipped,
  };

  // Save output
  const outputPath = 'data/benchmark/benchmark_output.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  // Print summary
  console.log('=== BENCHMARK COMPLETE ===\n');
  console.log(`Total resolved markets:  ${output.summary.total_resolved_markets}`);
  console.log(`Markets with 3+ URLs:    ${output.summary.markets_with_3_urls}`);
  console.log(`Markets submitted:       ${output.summary.markets_submitted}`);
  console.log(`Markets skipped:         ${output.summary.markets_skipped}`);
  console.log();
  console.log(`Consensus reached:       ${output.summary.consensus_reached}`);
  console.log(`  Correct:               ${output.summary.correct}`);
  console.log(`  Incorrect:             ${output.summary.incorrect}`);
  console.log(`  Uncertain:             ${output.summary.uncertain}`);
  console.log();
  console.log(`ACCURACY:                ${output.summary.accuracy_percent}%`);
  console.log(`Resolution rate:         ${output.summary.resolution_rate_percent}%`);
  console.log(`Avg URLs fetched:        ${output.summary.avg_urls_fetched}`);
  console.log(`Avg consensus count:     ${output.summary.avg_consensus_count}`);
  console.log();
  console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);

import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// ============================================================================
// TYPES
// ============================================================================

interface RealMarket {
  slug: string;
  question: string;
  description: string;
  resolution_url: string;  // Extracted from description
  outcome: string;
}

interface MarketResult {
  market_id: string;
  question: string;
  resolution_url: string;
  polymarket_result: string;
  resolvable: boolean;
  genlayer_result: string;
  correct: boolean;
  failure_reason: string;
  failure_category: 'none' | 'web_access' | 'content_quality' | 'llm_extraction' | 'consensus' | 'tx_error';
  status_code: number;
  error_detail: string;
  reasoning: string;
  tx_hash: string;
  consensus_status: 'MAJORITY_AGREE' | 'MAJORITY_DISAGREE' | 'PENDING' | 'ERROR';
  timestamp: string;
}

interface BenchmarkOutput {
  benchmark_id: string;
  started_at: string;
  completed_at: string | null;
  contract_address: string | null;
  network: string;
  total_markets: number;
  results: MarketResult[];
  summary: {
    total: number;
    consensus_achieved: number;
    consensus_failed: number;
    resolvable: number;
    correct: number;
    failure_breakdown: Record<string, number>;
  };
}

// ============================================================================
// FETCH REAL POLYMARKET DATA
// ============================================================================

async function fetchRealMarkets(limit: number = 20): Promise<RealMarket[]> {
  console.log(`📊 Fetching REAL resolved markets from Polymarket...`);
  
  const response = await fetch('https://clob.polymarket.com/markets?closed=true');
  const json = await response.json() as any;
  const allMarkets = json.data || [];
  
  const markets: RealMarket[] = [];
  
  for (const m of allMarkets) {
    if (markets.length >= limit) break;
    
    // Skip if no clear winner
    const winner = m.tokens?.find((t: any) => t.winner === true)?.outcome;
    if (!winner) continue;
    
    // Skip if no description
    if (!m.description || m.description.length < 50) continue;
    
    // Skip pure sports games (less interesting for benchmarking)
    if (m.market_slug?.match(/^(nba-|nfl-|nhl-|mlb-|ncaab-|ufc-)/)) continue;
    
    // Extract URL from description
    const urlMatch = m.description.match(/https?:\/\/[^\s\)\"]+/);
    const resolutionUrl = urlMatch ? urlMatch[0].replace(/[,.]$/, '') : '';
    
    // Include market even if no URL (to track that failure mode)
    markets.push({
      slug: m.market_slug || 'unknown',
      question: m.question,
      description: m.description.slice(0, 500),
      resolution_url: resolutionUrl,
      outcome: winner.toUpperCase()
    });
  }
  
  console.log(`   Found ${markets.length} real resolved markets\n`);
  
  // Stats on URL availability
  const withUrl = markets.filter(m => m.resolution_url).length;
  const withoutUrl = markets.length - withUrl;
  console.log(`   With resolution URL: ${withUrl}`);
  console.log(`   Without resolution URL: ${withoutUrl}\n`);
  
  // Show sample
  markets.slice(0, 5).forEach((m, i) => {
    console.log(`   ${i+1}. ${m.question.slice(0, 55)}...`);
    console.log(`      URL: ${m.resolution_url ? m.resolution_url.slice(0, 50) + '...' : '(none)'}`);
    console.log(`      Outcome: ${m.outcome}`);
  });
  console.log('');
  
  return markets;
}

// ============================================================================
// GENLAYER INTERACTION
// ============================================================================

async function deployResolver(client: any, contractCode: string): Promise<string> {
  console.log('📜 Deploying PolymarketResolver contract...');
  
  const deployTxHash = await client.deployContract({
    code: contractCode,
    args: [],
    leaderOnly: false,
  });
  
  console.log(`   TX: ${deployTxHash}`);
  
  const receipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  
  const receiptData = receipt as any;
  const contractAddress = receiptData?.data?.contract_address;
  
  if (!contractAddress) {
    throw new Error(`Deploy failed: ${receiptData?.result_name || 'unknown error'}`);
  }
  
  console.log(`   Contract: ${contractAddress}\n`);
  return contractAddress;
}

function categorizeFailure(result: MarketResult): 'none' | 'web_access' | 'content_quality' | 'llm_extraction' | 'consensus' | 'tx_error' {
  if (result.consensus_status === 'MAJORITY_DISAGREE') return 'consensus';
  if (result.consensus_status === 'ERROR') return 'tx_error';
  
  const reason = result.failure_reason.toLowerCase();
  if (reason.includes('web_') || reason.includes('forbidden') || reason.includes('timeout') || reason.includes('not_found')) {
    return 'web_access';
  }
  if (reason.includes('content_') || reason.includes('empty') || reason.includes('insufficient') || reason.includes('anti_bot') || reason.includes('paywall')) {
    return 'content_quality';
  }
  if (reason.includes('llm_') || reason.includes('unresolvable')) {
    return 'llm_extraction';
  }
  if (result.resolvable) return 'none';
  return 'llm_extraction';
}

async function resolveMarket(
  client: any,
  contractAddress: string,
  market: RealMarket
): Promise<MarketResult> {
  const result: MarketResult = {
    market_id: market.slug,
    question: market.question,
    resolution_url: market.resolution_url || '(none)',
    polymarket_result: market.outcome,
    resolvable: false,
    genlayer_result: 'PENDING',
    correct: false,
    failure_reason: '',
    failure_category: 'none',
    status_code: 0,
    error_detail: '',
    reasoning: '',
    tx_hash: '',
    consensus_status: 'PENDING',
    timestamp: new Date().toISOString(),
  };
  
  // If no URL, mark as unresolvable immediately
  if (!market.resolution_url) {
    result.resolvable = false;
    result.genlayer_result = 'NO_URL';
    result.failure_reason = 'no_resolution_url';
    result.failure_category = 'web_access';
    result.error_detail = 'Market description contains no resolution URL';
    result.consensus_status = 'MAJORITY_AGREE';  // We agree it can't be resolved
    return result;
  }
  
  try {
    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: 'resolve_market',
      args: [market.slug, market.question, market.resolution_url, market.outcome],
      leaderOnly: false,
    });
    
    result.tx_hash = txHash;
    console.log(`   TX: ${txHash}`);
    
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 120,
      interval: 5000,
    });
    
    const receiptData = receipt as any;
    const consensusResult = receiptData?.result_name || 'UNKNOWN';
    
    if (consensusResult === 'MAJORITY_AGREE' || consensusResult === 'AGREE') {
      result.consensus_status = 'MAJORITY_AGREE';
      
      // Extract contract result
      let contractResult = null;
      const leaderReceipt = receiptData?.consensus_data?.leader_receipt;
      if (leaderReceipt) {
        const receipts = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
        for (const lr of receipts) {
          if (lr?.result?.payload) {
            let payload = lr.result.payload;
            if (payload.readable) payload = payload.readable;
            if (typeof payload === 'string') {
              try {
                // Handle double-encoded JSON
                let parsed = payload;
                if (parsed.startsWith('"')) parsed = JSON.parse(parsed);
                contractResult = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
              } catch {
                contractResult = { genlayer_result: payload };
              }
            } else {
              contractResult = payload;
            }
            break;
          }
        }
      }
      
      if (contractResult) {
        result.resolvable = contractResult.resolvable ?? false;
        result.genlayer_result = contractResult.genlayer_result || 'UNKNOWN';
        result.failure_reason = contractResult.failure_reason || '';
        result.status_code = contractResult.status_code || 0;
        result.error_detail = contractResult.error_detail || '';
        result.reasoning = contractResult.reasoning || '';
        
        if (result.resolvable && result.polymarket_result !== 'UNKNOWN') {
          result.correct = (result.genlayer_result === result.polymarket_result);
        }
      }
      
    } else if (consensusResult === 'MAJORITY_DISAGREE' || consensusResult === 'DISAGREE') {
      result.consensus_status = 'MAJORITY_DISAGREE';
      result.genlayer_result = 'CONSENSUS_FAILED';
      result.failure_reason = 'consensus_disagree';
      result.error_detail = 'Validators could not reach consensus (web content likely varies)';
    } else {
      result.consensus_status = 'ERROR';
      result.genlayer_result = 'TX_ERROR';
      result.failure_reason = 'tx_error';
      result.error_detail = consensusResult;
    }
    
  } catch (error: any) {
    result.consensus_status = 'ERROR';
    result.genlayer_result = 'EXCEPTION';
    result.failure_reason = 'exception';
    result.error_detail = error.message || String(error);
  }
  
  result.failure_category = categorizeFailure(result);
  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function runBenchmark() {
  console.log('═'.repeat(60));
  console.log('  GenLayer ↔ Polymarket REAL Benchmark');
  console.log('  (No cherry-picking - actual market resolution sources)');
  console.log('═'.repeat(60) + '\n');
  
  const output: BenchmarkOutput = {
    benchmark_id: `bench_real_${Date.now()}`,
    started_at: new Date().toISOString(),
    completed_at: null,
    contract_address: null,
    network: 'studionet',
    total_markets: 0,
    results: [],
    summary: {
      total: 0,
      consensus_achieved: 0,
      consensus_failed: 0,
      resolvable: 0,
      correct: 0,
      failure_breakdown: {}
    }
  };
  
  // Ensure directories
  ['data', 'results', 'logs'].forEach(dir => {
    const path = join(ROOT_DIR, dir);
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
  });
  
  // 1. Fetch REAL markets
  const markets = await fetchRealMarkets(15);
  output.total_markets = markets.length;
  
  if (markets.length === 0) {
    console.log('❌ No valid markets found');
    return;
  }
  
  // Save markets for reference
  writeFileSync(
    join(ROOT_DIR, 'data/real_markets.json'),
    JSON.stringify(markets, null, 2)
  );
  
  // 2. Initialize GenLayer
  console.log('🔗 Connecting to GenLayer studionet...');
  const account = createAccount();
  console.log(`   Account: ${account.address}\n`);
  
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  await client.initializeConsensusSmartContract();
  
  // 3. Deploy contract
  const contractCode = readFileSync(
    join(ROOT_DIR, 'contracts/polymarket_resolver.py'),
    'utf-8'
  );
  
  const contractAddress = await deployResolver(client, contractCode);
  output.contract_address = contractAddress;
  
  // 4. Process markets
  console.log('🔍 Processing REAL markets...\n');
  
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    
    console.log(`[${i + 1}/${markets.length}] ${market.question.slice(0, 55)}...`);
    console.log(`   URL: ${market.resolution_url ? market.resolution_url.slice(0, 55) + '...' : '(none)'}`);
    console.log(`   Polymarket: ${market.outcome}`);
    
    const result = await resolveMarket(client, contractAddress, market);
    output.results.push(result);
    
    // Log outcome
    if (result.failure_category === 'none' && result.resolvable) {
      const icon = result.correct ? '✅' : '❌';
      console.log(`   GenLayer: ${result.genlayer_result} ${icon}`);
    } else {
      console.log(`   ⚠️ ${result.failure_category}: ${result.failure_reason}`);
      if (result.error_detail) {
        console.log(`   Detail: ${result.error_detail.slice(0, 60)}`);
      }
    }
    console.log('');
    
    // Save intermediate
    writeFileSync(
      join(ROOT_DIR, 'results/benchmark_real_results.json'),
      JSON.stringify(output, null, 2)
    );
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // 5. Calculate summary
  output.completed_at = new Date().toISOString();
  output.summary.total = output.results.length;
  output.summary.consensus_achieved = output.results.filter(r => r.consensus_status === 'MAJORITY_AGREE').length;
  output.summary.consensus_failed = output.results.filter(r => r.consensus_status === 'MAJORITY_DISAGREE').length;
  output.summary.resolvable = output.results.filter(r => r.resolvable).length;
  output.summary.correct = output.results.filter(r => r.correct).length;
  
  // Failure breakdown by category
  output.results.forEach(r => {
    const cat = r.failure_category;
    output.summary.failure_breakdown[cat] = (output.summary.failure_breakdown[cat] || 0) + 1;
  });
  
  // Print summary
  console.log('═'.repeat(60));
  console.log('  BENCHMARK RESULTS (REAL Polymarket Markets)');
  console.log('═'.repeat(60));
  console.log(`\n  Total Markets:         ${output.summary.total}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Consensus Achieved:    ${output.summary.consensus_achieved} (${pct(output.summary.consensus_achieved, output.summary.total)})`);
  console.log(`  Consensus Failed:      ${output.summary.consensus_failed} (${pct(output.summary.consensus_failed, output.summary.total)})`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Resolvable:            ${output.summary.resolvable} (${pct(output.summary.resolvable, output.summary.total)})`);
  console.log(`  Correct:               ${output.summary.correct} (${pct(output.summary.correct, output.summary.resolvable || 1)})`);
  
  console.log(`\n  Failure Breakdown:`);
  Object.entries(output.summary.failure_breakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count} (${pct(count, output.summary.total)})`);
    });
  
  writeFileSync(
    join(ROOT_DIR, 'results/benchmark_real_results.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log(`\n  Results: results/benchmark_real_results.json`);
  console.log('═'.repeat(60) + '\n');
}

function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`;
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

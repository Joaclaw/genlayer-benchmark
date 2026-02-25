import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

interface PolymarketMarket {
  id: string;
  question: string;
  resolutionSource: string;
  createdAt: string;
  endDate: string;
  volume: string;
  outcomes: string;
  outcomePrices: string;
}

interface BenchmarkResult {
  market_id: string;
  question: string;
  resolution_url: string;
  created_at: string;
  end_date: string;
  volume: number;
  polymarket_result: string;
  genlayer_result: string | null;
  genlayer_tx_hash: string | null;
  match: boolean | null;
  error: string | null;
  timestamp: string;
}

// Ensure directories exist
['data', 'results', 'logs'].forEach(dir => {
  const path = join(ROOT_DIR, dir);
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
});

async function fetchPolymarketData(): Promise<PolymarketMarket[]> {
  console.log('📊 Fetching resolved markets from Polymarket...');
  
  const response = await fetch('https://gamma-api.polymarket.com/markets?closed=true&limit=100');
  const markets = await response.json() as PolymarketMarket[];
  
  // Filter markets with resolution sources
  const validMarkets = markets
    .filter(m => m.resolutionSource && m.resolutionSource.startsWith('http'))
    .slice(0, 10);
  
  console.log(`   Found ${validMarkets.length} markets with resolution URLs`);
  
  // Save to data file
  writeFileSync(
    join(ROOT_DIR, 'data/markets.json'),
    JSON.stringify(validMarkets, null, 2)
  );
  
  return validMarkets;
}

function getPolymarketOutcome(market: PolymarketMarket): string {
  try {
    const outcomes = JSON.parse(market.outcomes || '[]');
    const prices = JSON.parse(market.outcomePrices || '[]');
    
    // Find the winning outcome (price = 1 or close to it)
    for (let i = 0; i < prices.length; i++) {
      const price = parseFloat(prices[i]);
      if (price > 0.99) {
        return outcomes[i]?.toUpperCase() || 'UNKNOWN';
      }
    }
    
    // If no clear winner, return the highest priced outcome
    let maxIdx = 0;
    let maxPrice = 0;
    for (let i = 0; i < prices.length; i++) {
      const price = parseFloat(prices[i]);
      if (price > maxPrice) {
        maxPrice = price;
        maxIdx = i;
      }
    }
    return outcomes[maxIdx]?.toUpperCase() || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

async function runBenchmark() {
  console.log('🚀 GenLayer Benchmark v2 - Polymarket Resolution\n');
  
  // 1. Fetch market data
  let markets: PolymarketMarket[];
  const marketsPath = join(ROOT_DIR, 'data/markets.json');
  
  if (existsSync(marketsPath) && process.argv.includes('--cached')) {
    console.log('📂 Loading cached markets...');
    markets = JSON.parse(readFileSync(marketsPath, 'utf-8'));
  } else {
    markets = await fetchPolymarketData();
  }
  
  console.log(`\n📋 Processing ${markets.length} markets\n`);
  
  // 2. Initialize GenLayer client
  console.log('🔗 Connecting to GenLayer studionet...');
  const account = createAccount();
  console.log(`   Account: ${account.address}`);
  
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  // Initialize consensus
  console.log('⚙️  Initializing consensus smart contract...');
  await client.initializeConsensusSmartContract();
  
  // 3. Validate and deploy contract
  console.log('📜 Loading MarketResolver contract...');
  const contractCode = readFileSync(join(ROOT_DIR, 'contracts/market_resolver.py'), 'utf-8');
  
  // Try to validate contract schema (only works on localnet)
  try {
    const schema = await client.getContractSchemaForCode({
      code: contractCode,
    });
    console.log('   ✓ Contract schema valid');
    console.log(`   Methods: ${Object.keys(schema.methods || {}).join(', ')}`);
  } catch (err: any) {
    // Schema validation not supported on studionet - skip
    if (err.message?.includes('not supported')) {
      console.log('   ⚠️ Schema validation not available on studionet');
    } else {
      console.log('   ⚠️ Schema check skipped:', err.message);
    }
  }
  
  console.log('📜 Deploying MarketResolver contract...');
  const deployTxHash = await client.deployContract({
    code: contractCode,
    args: [],
    leaderOnly: false,
  });
  
  console.log(`   Deploy TX: ${deployTxHash}`);
  
  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    status: TransactionStatus.ACCEPTED,
    retries: 50,
    interval: 5000,
  });
  
  const contractAddress = (deployReceipt as any).data?.contract_address;
  console.log(`   Contract Address: ${contractAddress}\n`);
  
  if (!contractAddress) {
    console.error('Deploy receipt:', JSON.stringify(deployReceipt, null, 2));
    throw new Error('Failed to deploy contract - no address returned');
  }
  
  // 4. Run benchmark for each market
  const results: BenchmarkResult[] = [];
  
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    const polyResult = getPolymarketOutcome(market);
    
    console.log(`\n[${i + 1}/${markets.length}] ${market.question.slice(0, 60)}...`);
    console.log(`   Resolution URL: ${market.resolutionSource}`);
    console.log(`   Polymarket: ${polyResult}`);
    
    const result: BenchmarkResult = {
      market_id: market.id,
      question: market.question,
      resolution_url: market.resolutionSource,
      created_at: market.createdAt,
      end_date: market.endDate,
      volume: parseFloat(market.volume || '0'),
      polymarket_result: polyResult,
      genlayer_result: null,
      genlayer_tx_hash: null,
      match: null,
      error: null,
      timestamp: new Date().toISOString(),
    };
    
    try {
      // Call resolve method
      const callHash = await client.writeContract({
        address: contractAddress,
        functionName: 'resolve',
        args: [market.id, market.question, market.resolutionSource],
        value: 0n,
      });
      
      result.genlayer_tx_hash = callHash;
      console.log(`   TX Hash: ${callHash}`);
      
      // Wait for finalization
      const callReceipt = await client.waitForTransactionReceipt({
        hash: callHash,
        status: TransactionStatus.FINALIZED,
        retries: 100,
        interval: 5000,
      });
      
      // Also try to read the stored resolution
      try {
        const storedResolution = await client.readContract({
          address: contractAddress,
          functionName: 'get_resolution',
          args: [market.id],
        });
        console.log(`   Stored: ${storedResolution}`);
      } catch (readErr) {
        // Read may fail on studionet - that's ok
      }
      
      // Extract result from consensus_data.leader_receipt.result
      const receiptData = callReceipt as any;
      let resolutionData = null;
      
      // Check if the transaction was successful
      if (receiptData.result_name === 'MAJORITY_AGREE' || receiptData.result_name === 'AGREE') {
        // The result is in consensus_data.leader_receipt.result
        const leaderReceipt = receiptData?.consensus_data?.leader_receipt;
        if (leaderReceipt) {
          const receipts = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
          for (const receipt of receipts) {
            if (receipt?.result?.payload) {
              let payload = receipt.result.payload;
              // Handle nested readable structure
              if (payload.readable) {
                payload = payload.readable;
              }
              // Parse escaped JSON string
              if (typeof payload === 'string') {
                try {
                  // Remove outer quotes if present
                  if (payload.startsWith('"') && payload.endsWith('"')) {
                    payload = JSON.parse(payload);
                  }
                  resolutionData = typeof payload === 'string' ? JSON.parse(payload) : payload;
                } catch {
                  resolutionData = payload;
                }
              } else {
                resolutionData = payload;
              }
              break;
            }
          }
        }
      } else {
        console.log(`   ⚠️ Transaction result: ${receiptData.result_name}`);
      }
      
      if (resolutionData && typeof resolutionData === 'object') {
        result.genlayer_result = resolutionData.resolution || 'UNKNOWN';
        result.match = result.genlayer_result === polyResult;
        console.log(`   GenLayer: ${result.genlayer_result} ${result.match ? '✅' : '❌'}`);
      } else if (resolutionData) {
        result.genlayer_result = String(resolutionData);
        console.log(`   GenLayer: ${result.genlayer_result}`);
      } else {
        result.genlayer_result = receiptData.result_name || 'ERROR';
        console.log(`   GenLayer: ${result.genlayer_result} (tx failed or no result)`);
      }
      
    } catch (error: any) {
      result.error = error.message || String(error);
      console.log(`   ❌ Error: ${result.error}`);
    }
    
    results.push(result);
    
    // Save intermediate results
    writeFileSync(
      join(ROOT_DIR, 'results/benchmark_results.json'),
      JSON.stringify(results, null, 2)
    );
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BENCHMARK SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.genlayer_result !== null && !r.error);
  const matches = results.filter(r => r.match === true);
  const mismatches = results.filter(r => r.match === false);
  const errors = results.filter(r => r.error !== null);
  
  console.log(`Total Markets:     ${results.length}`);
  console.log(`Successful:        ${successful.length}`);
  console.log(`Matches:           ${matches.length} (${successful.length > 0 ? ((matches.length / successful.length) * 100).toFixed(1) : 0}%)`);
  console.log(`Mismatches:        ${mismatches.length}`);
  console.log(`Errors:            ${errors.length}`);
  console.log(`Contract Address:  ${contractAddress}`);
  
  console.log('\n✅ Results saved to results/benchmark_results.json');
  console.log('🌐 Run `npm run dashboard` to view the dashboard');
}

runBenchmark().catch(console.error);

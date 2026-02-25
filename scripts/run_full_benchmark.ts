import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

interface Market {
  id: string;
  question: string;
  description: string;
  resolution_url: string;
  outcome: string;
  category: string;
}

interface Result {
  market_id: string;
  question: string;
  resolution_url: string;
  polymarket_result: string;
  genlayer_result: string;
  correct: boolean;
  resolvable: boolean;
  failure_reason: string;
  failure_category: 'none' | 'web_access' | 'content_quality' | 'llm_extraction' | 'consensus' | 'tx_error';
  consensus_status: string;
  tx_hash: string;
  reasoning: string;
  timestamp: string;
  category: string;
}

function categorizeFailure(result: Result): typeof result.failure_category {
  if (result.consensus_status === 'MAJORITY_DISAGREE') return 'consensus';
  if (result.consensus_status === 'ERROR') return 'tx_error';
  
  const reason = result.failure_reason.toLowerCase();
  if (reason.includes('web_') || reason.includes('forbidden') || reason.includes('timeout')) {
    return 'web_access';
  }
  if (reason.includes('content_') || reason.includes('empty') || reason.includes('anti_bot')) {
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
  market: Market,
  index: number,
  total: number
): Promise<Result> {
  console.log(`\n[${index + 1}/${total}] ${market.question.slice(0, 55)}...`);
  console.log(`   URL: ${market.resolution_url.slice(0, 60)}...`);
  console.log(`   Expected: ${market.outcome}`);
  
  const result: Result = {
    market_id: market.id,
    question: market.question,
    resolution_url: market.resolution_url,
    polymarket_result: market.outcome,
    genlayer_result: 'PENDING',
    correct: false,
    resolvable: false,
    failure_reason: '',
    failure_category: 'none',
    consensus_status: 'PENDING',
    tx_hash: '',
    reasoning: '',
    timestamp: new Date().toISOString(),
    category: market.category
  };
  
  try {
    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: 'resolve_market',
      args: [market.id, market.question, market.resolution_url, market.outcome],
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
    result.consensus_status = consensusResult;
    
    if (consensusResult === 'MAJORITY_AGREE' || consensusResult === 'AGREE') {
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
        result.reasoning = contractResult.reasoning || '';
        
        if (result.resolvable && result.polymarket_result !== 'UNKNOWN') {
          result.correct = (result.genlayer_result === result.polymarket_result);
        }
      }
      
    } else if (consensusResult === 'MAJORITY_DISAGREE') {
      result.genlayer_result = 'CONSENSUS_FAILED';
      result.failure_reason = 'consensus_disagree';
    } else {
      result.genlayer_result = 'TX_ERROR';
      result.failure_reason = 'tx_error';
    }
    
  } catch (error: any) {
    result.consensus_status = 'ERROR';
    result.genlayer_result = 'EXCEPTION';
    result.failure_reason = 'exception';
  }
  
  result.failure_category = categorizeFailure(result);
  
  // Log outcome
  if (result.resolvable) {
    const icon = result.correct ? '✅' : '❌';
    console.log(`   GenLayer: ${result.genlayer_result} ${icon}`);
  } else {
    console.log(`   ⚠️ ${result.failure_category}: ${result.failure_reason}`);
  }
  
  return result;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  GenLayer Polymarket Benchmark - FULL RUN');
  console.log('═'.repeat(70) + '\n');
  
  // Load markets
  const marketsData = JSON.parse(
    readFileSync(join(ROOT_DIR, 'data/polymarket_2000_sample.json'), 'utf-8')
  );
  
  const markets: Market[] = marketsData.markets;
  console.log(`📊 Loaded ${markets.length} markets\n`);
  
  // Initialize GenLayer client
  console.log('🔗 Connecting to GenLayer studionet...');
  const account = createAccount();
  console.log(`   Account: ${account.address}\n`);
  
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  await client.initializeConsensusSmartContract();
  
  // Deploy contract
  console.log('📜 Deploying PolymarketResolver contract...');
  const contractCode = readFileSync(
    join(ROOT_DIR, 'contracts/polymarket_resolver.py'),
    'utf-8'
  );
  
  const deployTxHash = await client.deployContract({
    code: contractCode,
    args: [],
    leaderOnly: false,
  });
  
  console.log(`   TX: ${deployTxHash}`);
  
  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  
  const contractAddress = (deployReceipt as any)?.data?.contract_address;
  if (!contractAddress) throw new Error('Deploy failed');
  
  console.log(`   Contract: ${contractAddress}\n`);
  
  // Process markets
  console.log('🔍 Processing markets...');
  
  const results: Result[] = [];
  const resultsFile = join(ROOT_DIR, 'results/full_benchmark_results.json');
  
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    
    try {
      const result = await resolveMarket(client, contractAddress, market, i, markets.length);
      results.push(result);
      
      // Save intermediate results every 10 markets
      if ((i + 1) % 10 === 0) {
        const output = {
          benchmark_id: `full_bench_${Date.now()}`,
          started_at: new Date().toISOString(),
          contract_address: contractAddress,
          total_markets: markets.length,
          processed: results.length,
          results
        };
        
        writeFileSync(resultsFile, JSON.stringify(output, null, 2));
        console.log(`\n💾 Saved ${results.length} results`);
        
        // Print current stats
        const resolvable = results.filter(r => r.resolvable).length;
        const correct = results.filter(r => r.correct).length;
        console.log(`   Resolvable: ${resolvable}/${results.length} (${Math.round(resolvable/results.length*100)}%)`);
        console.log(`   Correct: ${correct}/${resolvable || 1} (${Math.round(correct/(resolvable||1)*100)}%)\n`);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error) {
      console.error(`   Error processing market: ${error}`);
      continue;
    }
  }
  
  // Final summary
  const summary = {
    total: results.length,
    consensus_achieved: results.filter(r => r.consensus_status === 'MAJORITY_AGREE').length,
    consensus_failed: results.filter(r => r.consensus_status === 'MAJORITY_DISAGREE').length,
    resolvable: results.filter(r => r.resolvable).length,
    correct: results.filter(r => r.correct).length,
    by_category: {} as Record<string, number>,
    by_failure: {} as Record<string, number>
  };
  
  results.forEach(r => {
    summary.by_failure[r.failure_category] = (summary.by_failure[r.failure_category] || 0) + 1;
    summary.by_category[r.category] = (summary.by_category[r.category] || 0) + 1;
  });
  
  const finalOutput = {
    benchmark_id: `full_bench_${Date.now()}`,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    contract_address: contractAddress,
    total_markets: markets.length,
    summary,
    results
  };
  
  writeFileSync(resultsFile, JSON.stringify(finalOutput, null, 2));
  
  console.log('\n═'.repeat(70));
  console.log('  FINAL RESULTS');
  console.log('═'.repeat(70));
  console.log(`\n  Total: ${summary.total}`);
  console.log(`  Consensus Achieved: ${summary.consensus_achieved}`);
  console.log(`  Resolvable: ${summary.resolvable} (${Math.round(summary.resolvable/summary.total*100)}%)`);
  console.log(`  Correct: ${summary.correct} (${Math.round(summary.correct/(summary.resolvable||1)*100)}%)`);
  console.log(`\n  By Failure Category:`);
  Object.entries(summary.by_failure).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`    ${cat}: ${count}`);
  });
  console.log('\n═'.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

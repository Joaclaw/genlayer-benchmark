import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseGenLayerResult } from './parse_result.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

async function main() {
  console.log('═'.repeat(60));
  console.log('  GenLayer Test Run - 10 Markets');
  console.log('═'.repeat(60) + '\n');
  
  // Load first 10 markets
  const data = JSON.parse(
    readFileSync(join(ROOT_DIR, 'data/polymarket_2000_sample.json'), 'utf-8')
  );
  const markets = data.markets.slice(0, 10);
  
  console.log(`📊 Testing with ${markets.length} markets\n`);
  
  // Initialize client
  const account = createAccount();
  console.log(`🔗 Account: ${account.address}\n`);
  
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  await client.initializeConsensusSmartContract();
  
  // Deploy contract
  console.log('📜 Deploying contract...');
  const contractCode = readFileSync(
    join(ROOT_DIR, 'contracts/polymarket_resolver.py'),
    'utf-8'
  );
  
  const deployTx = await client.deployContract({
    code: contractCode,
    args: [],
    leaderOnly: false,
  });
  
  console.log(`   Deploy TX: ${deployTx}`);
  
  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTx,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  
  const contractAddress = (deployReceipt as any)?.data?.contract_address;
  if (!contractAddress) throw new Error('Deploy failed');
  
  console.log(`   Contract: ${contractAddress}\n`);
  
  // Process markets
  const results = [];
  
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    
    console.log(`\n[${i + 1}/${markets.length}] ${m.question.slice(0, 60)}...`);
    console.log(`   URL: ${m.resolution_url.slice(0, 60)}...`);
    console.log(`   Expected: ${m.outcome}`);
    
    const result = {
      market_id: m.id,
      question: m.question,
      resolution_url: m.resolution_url,
      polymarket_result: m.outcome,
      genlayer_result: 'PENDING',
      correct: false,
      resolvable: false,
      failure_reason: '',
      error_detail: '',
      reasoning: '',
      status_code: 0,
      consensus_status: 'PENDING',
      tx_hash: '',
      timestamp: new Date().toISOString(),
      category: m.category
    };
    
    try {
      const txHash = await client.writeContract({
        address: contractAddress,
        functionName: 'resolve_market',
        args: [m.id, m.question, m.resolution_url, m.outcome],
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
      result.consensus_status = receiptData?.result_name || 'UNKNOWN';
      
      if (result.consensus_status === 'MAJORITY_AGREE') {
        // Extract result
        const leaderReceipt = receiptData?.consensus_data?.leader_receipt;
        if (leaderReceipt) {
          const receipts = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
          for (const lr of receipts) {
            if (lr?.result?.payload) {
              let payload = lr.result.payload;
              if (payload.readable) payload = payload.readable;
              
              try {
                const parsed = parseGenLayerResult(payload);
                
                result.resolvable = parsed.resolvable ?? false;
                result.genlayer_result = parsed.genlayer_result || 'UNKNOWN';
                result.failure_reason = parsed.failure_reason || '';
                result.reasoning = parsed.reasoning || '';
                result.error_detail = parsed.error_detail || '';
                result.status_code = parsed.status_code || 0;
                
                if (result.resolvable) {
                  result.correct = (result.genlayer_result === result.polymarket_result);
                }
                
                console.log(`   Status: ${parsed.status_code || 'N/A'}`);
                if (parsed.error_detail) {
                  console.log(`   Error: ${parsed.error_detail.slice(0, 60)}...`);
                }
                if (parsed.reasoning) {
                  console.log(`   Reasoning: ${parsed.reasoning.slice(0, 80)}...`);
                }
              } catch (e) {
                console.log(`   Parse error: ${e}`);
                result.failure_reason = 'parse_error';
                result.error_detail = String(e);
              }
              break;
            }
          }
        }
      } else if (result.consensus_status === 'MAJORITY_DISAGREE') {
        result.genlayer_result = 'CONSENSUS_FAILED';
        result.failure_reason = 'consensus_disagree';
      }
      
      // Log result
      if (result.resolvable) {
        const icon = result.correct ? '✅' : '❌';
        console.log(`   Result: ${result.genlayer_result} ${icon}`);
      } else {
        console.log(`   ⚠️ ${result.consensus_status}: ${result.failure_reason}`);
      }
      
    } catch (error: any) {
      result.consensus_status = 'ERROR';
      result.genlayer_result = 'EXCEPTION';
      result.failure_reason = error.message;
      console.log(`   Error: ${error.message}`);
    }
    
    results.push(result);
    
    // Save after each market (in case of interruption)
    const output = {
      test_id: `test_10_${Date.now()}`,
      started_at: new Date().toISOString(),
      contract_address: contractAddress,
      processed: results.length,
      total: markets.length,
      results
    };
    
    writeFileSync(
      join(ROOT_DIR, 'results/test_10_results.json'),
      JSON.stringify(output, null, 2)
    );
    
    writeFileSync(
      join(ROOT_DIR, 'public/test_results.json'),
      JSON.stringify(output, null, 2)
    );
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  const summary = {
    total: results.length,
    resolvable: results.filter(r => r.resolvable).length,
    correct: results.filter(r => r.correct).length,
    consensus_achieved: results.filter(r => r.consensus_status === 'MAJORITY_AGREE').length,
    consensus_failed: results.filter(r => r.consensus_status === 'MAJORITY_DISAGREE').length,
  };
  
  const output = {
    test_id: `test_10_${Date.now()}`,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    contract_address: contractAddress,
    summary,
    results
  };
  
  writeFileSync(
    join(ROOT_DIR, 'results/test_10_results.json'),
    JSON.stringify(output, null, 2)
  );
  
  writeFileSync(
    join(ROOT_DIR, 'public/test_results.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('\n═'.repeat(60));
  console.log('  TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`\n  Total: ${summary.total}`);
  console.log(`  Consensus Achieved: ${summary.consensus_achieved}`);
  console.log(`  Consensus Failed: ${summary.consensus_failed}`);
  console.log(`  Resolvable: ${summary.resolvable}`);
  console.log(`  Correct: ${summary.correct} / ${summary.resolvable}`);
  console.log(`\n  Results saved to: results/test_10_results.json`);
  console.log('═'.repeat(60) + '\n');
  
  // Push results to git so Vercel can deploy them
  console.log('📤 Pushing results to GitHub for Vercel deployment...');
  const { execSync } = require('child_process');
  try {
    execSync('git add public/test_results.json', { cwd: ROOT_DIR });
    execSync(`git commit -m "Test results: ${summary.correct}/${summary.resolvable} correct"`, { cwd: ROOT_DIR });
    execSync('git push origin main', { cwd: ROOT_DIR });
    console.log('✅ Results pushed! Vercel will auto-deploy in ~30 seconds.');
    console.log('🌐 View at: https://genlayer-benchmark.vercel.app/test.html');
  } catch (e) {
    console.log('⚠️  Push failed (may need manual push):', e.message);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

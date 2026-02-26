import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { parseGenLayerResult } from './parse_result.js';

async function main() {
  const contractAddress = '0xEAC1CAa1bABA3bD73506C910B224eE6A8ce916A4';
  
  console.log('🔗 Connecting to studionet...');
  const account = createAccount();
  console.log(`   Account: ${account.address}\n`);
  
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  await client.initializeConsensusSmartContract();
  
  // Test market
  const market = {
    id: 'will-doge-balance-the-budget-in-2025',
    question: 'Will DOGE balance the budget in 2025?',
    url: 'https://fred.stlouisfed.org/series/FYFSD',
    outcome: 'No'
  };
  
  console.log('📋 Testing market:');
  console.log(`   Question: ${market.question}`);
  console.log(`   URL: ${market.url}`);
  console.log(`   Expected: ${market.outcome}\n`);
  
  console.log('📤 Calling resolve_market()...');
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'resolve_market',
    args: [market.id, market.question, market.url, market.outcome],
    leaderOnly: false,
  });
  
  console.log(`   TX Hash: ${txHash}\n`);
  
  console.log('⏳ Waiting for transaction receipt (with consensus)...');
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5000,
  });
  
  const receiptData = receipt as any;
  console.log('\n📊 RESULT:');
  console.log(`   Consensus: ${receiptData?.result_name || 'UNKNOWN'}\n`);
  
  if (receiptData?.result_name === 'MAJORITY_AGREE') {
    // Extract the result
    const leaderReceipt = receiptData?.consensus_data?.leader_receipt;
    if (leaderReceipt) {
      const receipts = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
      
      for (const lr of receipts) {
        if (lr?.result?.payload) {
          let payload = lr.result.payload;
          if (payload.readable) payload = payload.readable;
          
          console.log('📦 Raw Payload:');
          console.log(JSON.stringify(payload, null, 2));
          console.log();
          
          try {
            const parsed = parseGenLayerResult(payload);
            
            console.log('✅ Parsed Result:');
            console.log(`   Resolvable: ${parsed.resolvable}`);
            console.log(`   GenLayer Result: ${parsed.genlayer_result}`);
            console.log(`   Expected: ${market.outcome}`);
            console.log(`   Match: ${parsed.genlayer_result === market.outcome ? '✓' : '✗'}`);
            console.log();
            
            if (parsed.status_code) {
              console.log(`   HTTP Status: ${parsed.status_code}`);
            }
            
            if (parsed.failure_reason) {
              console.log(`   Failure Type: ${parsed.failure_reason}`);
            }
            
            if (parsed.error_detail) {
              console.log(`   Error Detail: ${parsed.error_detail}`);
            }
            
            if (parsed.reasoning) {
              console.log(`\n💭 LLM Reasoning:`);
              console.log(`   ${parsed.reasoning}`);
            }
            
          } catch (e) {
            console.error('Parse error:', e);
          }
          
          break;
        }
      }
    }
  } else {
    console.log('❌ Consensus failed or other status');
    console.log(JSON.stringify(receiptData, null, 2));
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

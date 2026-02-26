import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync } from 'fs';

async function main() {
  console.log('🚀 Deploying fresh contract...\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  await client.initializeConsensusSmartContract();
  
  const code = readFileSync('contracts/polymarket_resolver.py', 'utf-8');
  
  const deployTx = await client.deployContract({
    code,
    args: [],
    leaderOnly: false,
  });
  
  console.log(`Deploy TX: ${deployTx}`);
  
  const receipt = await client.waitForTransactionReceipt({
    hash: deployTx,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  
  const address = (receipt as any)?.data?.contract_address;
  console.log(`\n✅ Contract deployed: ${address}`);
  
  // Now test it
  console.log('\n📋 Testing with single market...\n');
  
  const txHash = await client.writeContract({
    address,
    functionName: 'resolve_market',
    args: [
      'test-market-1',
      'Will DOGE balance the budget in 2025?',
      'https://fred.stlouisfed.org/series/FYFSD',
      'No'
    ],
    leaderOnly: false,
  });
  
  console.log(`TX: ${txHash}`);
  console.log('Waiting for consensus...\n');
  
  const testReceipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5000,
  });
  
  const data = testReceipt as any;
  console.log(`Consensus: ${data?.result_name}\n`);
  
  if (data?.result_name === 'MAJORITY_AGREE') {
    const lr = data?.consensus_data?.leader_receipt;
    const receipts = Array.isArray(lr) ? lr : [lr];
    
    for (const r of receipts) {
      if (r?.result?.payload) {
        console.log('Raw payload:');
        console.log(JSON.stringify(r.result.payload, null, 2));
        console.log();
      }
    }
  }
}

main().catch(console.error);

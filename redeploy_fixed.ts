import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync } from 'fs';

async function main() {
  console.log('🚀 Deploying fixed contract with JSON string return...\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  await client.initializeConsensusSmartContract();
  
  const code = readFileSync('contracts/polymarket_resolver.py', 'utf-8');
  
  const deployTx = await client.deployContract({ code, args: [], leaderOnly: false });
  console.log(`Deploy TX: ${deployTx}`);
  
  const receipt = await client.waitForTransactionReceipt({
    hash: deployTx,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  
  const address = (receipt as any)?.data?.contract_address;
  console.log(`\n✅ Contract: ${address}`);
  console.log(`\n🌐 Live page: https://genlayer-benchmark.vercel.app/live.html?contract=${address}`);
}

main().catch(console.error);

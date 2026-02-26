import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || '0xaE54474B48200Ad11893e357d1677dcFB29Bd27F';
  
  console.log('🚀 Submitting 10 markets in parallel...\n');
  console.log(`Contract: ${contractAddress}\n`);
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  await client.initializeConsensusSmartContract();
  
  // Load markets
  const data = JSON.parse(readFileSync(join(ROOT_DIR, 'data/polymarket_2000_sample.json'), 'utf-8'));
  const markets = data.markets.slice(0, 10);
  
  const txHashes = [];
  
  // Fire all transactions without waiting
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    console.log(`[${i+1}/10] ${m.question.slice(0, 60)}...`);
    
    try {
      const txHash = await client.writeContract({
        address: contractAddress,
        functionName: 'resolve_market',
        args: [m.id, m.question, m.resolution_url, m.outcome],
        leaderOnly: false,
      });
      
      console.log(`   TX: ${txHash}`);
      txHashes.push({ market_id: m.id, question: m.question, tx_hash: txHash });
      
      // Small delay to avoid overwhelming the network
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`   Error: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Submitted ${txHashes.length} transactions!`);
  console.log(`\n🌐 View live results at:`);
  console.log(`   https://genlayer-benchmark.vercel.app/live.html?contract=${contractAddress}`);
  console.log(`\nTransactions will process in parallel. Results appear as consensus completes.`);
}

main().catch(console.error);

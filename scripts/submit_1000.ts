import { createClient, createAccount, chains } from 'genlayer-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function main() {
  console.log('🚀 Submitting 1000 latest markets\n');
  
  // Load markets data
  const data = JSON.parse(
    readFileSync(join(process.cwd(), 'data/polymarket_2000_sample.json'), 'utf-8')
  );
  
  // Take first 1000 (already sorted by date descending)
  const markets = data.markets.slice(0, 1000);
  
  console.log(`📊 Loaded ${markets.length} markets`);
  console.log(`   Date range: ${markets[markets.length-1].end_date} to ${markets[0].end_date}\n`);
  
  // Create client
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  console.log(`🔗 Account: ${account.address}`);
  console.log(`📜 Contract: ${CONTRACT_ADDRESS}\n`);
  
  console.log('⏳ Submitting transactions (no waiting)...\n');
  
  const submitted = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    
    try {
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'resolve_market',
        args: [m.id, m.question, m.resolution_url, m.outcome],
        leaderOnly: false,
      });
      
      successCount++;
      submitted.push({ market_id: m.id, tx_hash: txHash, question: m.question.slice(0, 50) });
      
      if ((i + 1) % 50 === 0) {
        console.log(`✓ Submitted ${i + 1}/${markets.length} (${successCount} success, ${failCount} fail)`);
      }
      
      // Small delay to avoid overwhelming network
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error: any) {
      failCount++;
      console.error(`✗ [${i + 1}] Failed: ${m.question.slice(0, 40)}... - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('  SUBMISSION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n  Total: ${markets.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`\n  Contract: ${CONTRACT_ADDRESS}`);
  console.log(`  View results: https://genlayer-benchmark.vercel.app/results`);
  console.log('\n' + '='.repeat(70) + '\n');
  
  console.log('💡 Results will populate over the next ~30-60 minutes as consensus completes.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

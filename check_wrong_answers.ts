import { createClient, createAccount, chains } from 'genlayer-js';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function main() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  // Find wrong answers
  const wrong = results.filter((r: any) => r.resolvable && !r.correct);
  
  console.log(`\n❌ WRONG ANSWERS: ${wrong.length} markets\n`);
  console.log('═'.repeat(80));
  
  wrong.forEach((r: any, i: number) => {
    console.log(`\n[${i + 1}] ${r.question}`);
    console.log(`Expected: ${r.polymarket_result}`);
    console.log(`GenLayer: ${r.genlayer_result}`);
    console.log(`URL: ${r.resolution_url}`);
    console.log(`\nReasoning: ${r.reasoning}`);
    console.log('\n' + '─'.repeat(80));
  });
}

main().catch(console.error);

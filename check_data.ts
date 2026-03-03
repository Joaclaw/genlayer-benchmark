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
  
  console.log(`Total results: ${results.length}`);
  
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log(`Ambiguous (HTTP 200, unresolvable): ${ambiguous.length}`);
  
  // Sample a few
  console.log('\nSample ambiguous cases:');
  ambiguous.slice(0, 5).forEach((r: any, i: number) => {
    console.log(`\n${i+1}. ${r.question}`);
    console.log(`   URL: ${r.resolution_url}`);
    console.log(`   Reasoning: ${r.reasoning.slice(0, 100)}...`);
  });
}

main().catch(console.error);

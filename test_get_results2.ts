import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';

async function main() {
  const contractAddress = '0xaE54474B48200Ad11893e357d1677dcFB29Bd27F';
  
  console.log('Testing get_results()...\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const results = await client.readContract({
    address: contractAddress,
    functionName: 'get_results',
    args: []
  });
  
  console.log('Raw results:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);

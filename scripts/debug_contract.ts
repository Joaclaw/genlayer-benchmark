import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { join } from 'path';

async function debug() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  // Initialize before reading
  console.log('Initializing consensus smart contract...');
  try {
    await client.initializeConsensusSmartContract();
    console.log('Initialized successfully');
  } catch (e: any) {
    console.log('Init error (may be ok if already initialized):', e?.message || e);
  }

  const contractAddress = readFileSync(join(process.cwd(), '.contract-address'), 'utf-8').trim();
  console.log('\nContract address:', contractAddress);

  // Get stored results
  try {
    const results = await client.readContract({
      address: contractAddress,
      functionName: 'get_results',
      args: [],
    });
    console.log('\nStored results:');
    console.log(JSON.stringify(results, null, 2));
  } catch (e: any) {
    console.error('Error reading results:', e?.message || e);
  }

  // Get result count
  try {
    const count = await client.readContract({
      address: contractAddress,
      functionName: 'get_result_count',
      args: [],
    });
    console.log('\nResult count:', count);
  } catch (e: any) {
    console.error('Error reading count:', e?.message || e);
  }
}

debug();

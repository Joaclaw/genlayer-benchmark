import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function deploy() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  const contractPath = join(process.cwd(), 'pipeline', 'multi_url_resolver.py');
  const contractCode = readFileSync(contractPath, 'utf-8');

  console.log('Deploying contract to studionet...');
  console.log('Account:', account.address);

  try {
    const txHash = await client.deployContract({
      code: contractCode,
      args: [false], // has_resolved = false
    });

    console.log('Deploy tx hash:', txHash);

    // Use proper waitForTransactionReceipt
    console.log('Waiting for transaction receipt (FINALIZED)...');

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: 'FINALIZED' as any,
      retries: 100,
      interval: 3000,
    });

    console.log('Receipt received!');
    console.log('Status:', receipt.statusName);
    console.log('Result name:', receipt.result_name);

    // Extract contract address
    const contractAddress = receipt.data?.contract_address || receipt.to_address;

    if (contractAddress) {
      console.log('\nContract deployed successfully!');
      console.log('Contract address:', contractAddress);

      // Write to .contract-address file
      const addrPath = join(process.cwd(), '.contract-address');
      writeFileSync(addrPath, contractAddress);
      console.log('Written to .contract-address');

      // Wait a bit for state to propagate
      console.log('\nWaiting 10s for state propagation...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Try to read from the contract
      console.log('Testing contract read...');
      try {
        const hasResolved = await client.readContract({
          address: contractAddress,
          functionName: 'get_has_resolved',
          args: [],
        });
        console.log('Has resolved:', hasResolved);
      } catch (e: any) {
        console.error('Read error:', e?.message || e);
      }

    } else {
      console.error('Could not find contract address');
      console.log('Receipt data:', JSON.stringify(receipt.data, null, 2));
    }

  } catch (error) {
    console.error('Deployment error:', error);
    process.exit(1);
  }
}

deploy();

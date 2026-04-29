import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { join } from 'path';

async function deploy() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  const contractPath = join(process.cwd(), 'pipeline', 'wizard_test.py');
  const contractCode = readFileSync(contractPath, 'utf-8');

  console.log('Deploying wizard contract to studionet...');
  console.log('Account:', account.address);

  try {
    const txHash = await client.deployContract({
      code: contractCode,
      args: [true], // have_coin = true
    });

    console.log('Deploy tx hash:', txHash);

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: 'FINALIZED' as any,
      retries: 100,
      interval: 3000,
    });

    console.log('Receipt status:', receipt.statusName);
    console.log('Result name:', receipt.result_name);

    const contractAddress = receipt.data?.contract_address || receipt.to_address;
    console.log('Contract address:', contractAddress);

    // Wait for state propagation
    console.log('\nWaiting 15s for state propagation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Try to read from the contract
    console.log('Testing contract read...');
    try {
      const hasCoin = await client.readContract({
        address: contractAddress,
        functionName: 'get_have_coin',
        args: [],
      });
      console.log('Has coin:', hasCoin);
    } catch (e: any) {
      console.error('Read error:', e?.message || e);
    }

  } catch (error) {
    console.error('Deployment error:', error);
    process.exit(1);
  }
}

deploy();

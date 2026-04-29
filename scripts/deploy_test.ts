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

  const contractPath = join(process.cwd(), 'pipeline', 'test_contract.py');
  const contractCode = readFileSync(contractPath, 'utf-8');

  console.log('Deploying test contract to studionet...');
  console.log('Account:', account.address);

  try {
    const txHash = await client.deployContract({
      code: contractCode,
      args: [],
    });

    console.log('Deploy tx hash:', txHash);

    let tx: any = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      try {
        tx = await client.getTransaction({ hash: txHash });
        console.log(`Attempt ${attempts + 1}, statusName: ${tx?.statusName}, result_name: ${tx?.result_name}`);

        if (tx?.statusName === 'FINALIZED') {
          console.log('Transaction finalized');
          break;
        }

        if (tx?.result_name === 'FAILURE' || tx?.statusName === 'FAILED') {
          console.error('Deployment failed');
          break;
        }
      } catch (e: any) {
        console.log(`Attempt ${attempts + 1} error:`, e?.message || e);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!tx) {
      console.error('Failed to get transaction status');
      process.exit(1);
    }

    const contractAddress = tx?.data?.contract_address || tx?.to_address;
    console.log('Contract address:', contractAddress);

    // Test reading from it
    console.log('\nTrying to read from contract...');
    try {
      const value = await client.readContract({
        address: contractAddress,
        functionName: 'get_value',
        args: [],
      });
      console.log('Read value:', value);
    } catch (e: any) {
      console.error('Read error:', e?.message || e);
    }

  } catch (error) {
    console.error('Deployment error:', error);
    process.exit(1);
  }
}

deploy();

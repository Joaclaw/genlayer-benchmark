import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testResolve() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  const contractAddress = readFileSync(join(process.cwd(), '.contract-address'), 'utf-8').trim();
  console.log('Contract address:', contractAddress);
  console.log('Account:', account.address);

  // Use static Wikipedia URLs
  const testUrls = [
    'https://en.wikipedia.org/wiki/Moon',
    'https://en.wikipedia.org/wiki/Earth',
    'https://en.wikipedia.org/wiki/Sun'
  ];

  console.log('\nCalling resolve_market...');

  try {
    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: 'resolve_market',
      args: [
        'test-market-1',
        'Is the Moon a natural satellite of Earth?',
        testUrls[0],
        testUrls[1],
        testUrls[2],
        'Yes',
      ],
    });

    console.log('Transaction hash:', txHash);

    // Poll for result
    let tx: any = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      try {
        tx = await client.getTransaction({ hash: txHash });
        console.log(`Attempt ${attempts + 1}, statusName: ${tx?.statusName}, result_name: ${tx?.result_name}`);

        if (tx?.statusName === 'FINALIZED' || tx?.statusName === 'ACCEPTED') {
          console.log('Transaction:', tx.statusName);
          break;
        }

        if (tx?.result_name === 'FAILURE' || tx?.statusName === 'FAILED') {
          console.error('Transaction failed');
          break;
        }
      } catch (e: any) {
        console.log(`Attempt ${attempts + 1} error:`, e?.message || e);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (tx) {
      console.log('\nTransaction result:');
      const leaderReceipt = tx?.consensus_data?.leader_receipt?.[0];
      console.log('Leader receipt:', JSON.stringify(leaderReceipt, null, 2));
      console.log('\nValidator votes:', tx?.last_round?.validator_votes_name);
      console.log('Result name:', tx?.result_name);
      console.log('Status:', tx?.statusName);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testResolve();

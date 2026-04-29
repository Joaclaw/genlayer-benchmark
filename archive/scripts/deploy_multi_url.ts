/**
 * Deploy the MultiURLResolver contract to GenLayer studionet.
 *
 * Usage:
 *   npx tsx scripts/deploy_multi_url.ts
 */

import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import fs from 'fs';

async function deploy() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });

  const contractCode = fs.readFileSync('contracts/multi_url_resolver.py', 'utf-8');

  console.log('Deploying MultiURLResolver contract to studionet...');
  console.log(`Account: ${account.address}`);

  // deployContract returns a transaction hash
  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
  });

  console.log(`TX Hash: ${txHash}`);
  console.log('Waiting for finalization...');

  // Wait for the transaction to be finalized
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: 'FINALIZED',
    retries: 60,
    interval: 5000,
  });

  // Extract contract address from the deploy receipt
  const decoded = receipt.txDataDecoded as any;
  const contractAddress = decoded?.contractAddress || receipt.to_address || receipt.recipient;

  if (!contractAddress) {
    console.error('Could not extract contract address from receipt.');
    console.error('Full receipt:', JSON.stringify(receipt, null, 2));
    process.exit(1);
  }

  console.log(`\nContract deployed successfully!`);
  console.log(`Address: ${contractAddress}`);

  // Save address for the pilot script
  fs.writeFileSync('.contract-address', contractAddress);
  console.log(`Address saved to .contract-address`);

  return contractAddress;
}

deploy().catch((error) => {
  console.error(`Deploy failed: ${error.message}`);
  process.exit(1);
});

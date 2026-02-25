/**
 * Test the complete GenLayer SDK flow
 * Demonstrates: createAccount -> createClient -> deploy -> write -> read
 */

import { createClient } from 'genlayer-js';
import { studionet, localnet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Use localnet if --local flag, otherwise studionet
const useLocalnet = process.argv.includes('--local');
const chain = useLocalnet ? localnet : studionet;

async function testFlow() {
  console.log('🧪 GenLayer SDK Complete Flow Test\n');
  console.log(`Chain: ${useLocalnet ? 'localnet' : 'studionet'}\n`);
  
  // 1. Create account (auto-generates private key)
  console.log('1️⃣  Creating account...');
  const account = createAccount();
  console.log(`   Address: ${account.address}\n`);
  
  // 2. Create client
  console.log('2️⃣  Creating client...');
  const client = createClient({
    chain: chain,
    account: account,
  });
  console.log('   ✓ Client created\n');
  
  // 3. Initialize consensus smart contract
  console.log('3️⃣  Initializing consensus...');
  await client.initializeConsensusSmartContract();
  console.log('   ✓ Consensus initialized\n');
  
  // 4. Deploy contract
  console.log('4️⃣  Deploying contract...');
  const contractCode = readFileSync(join(ROOT_DIR, 'contracts/market_resolver.py'), 'utf-8');
  
  const deployHash = await client.deployContract({
    code: contractCode,
    args: [],
    leaderOnly: false,
  });
  console.log(`   TX: ${deployHash}`);
  
  // 5. Wait for deployment receipt
  console.log('5️⃣  Waiting for deployment...');
  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployHash,
    status: TransactionStatus.ACCEPTED,
    retries: 100,
    interval: 5000,
  });
  
  const contractAddress = (deployReceipt as any).data?.contract_address;
  console.log(`   Contract: ${contractAddress}\n`);
  
  if (!contractAddress) {
    console.error('   ✗ Failed to get contract address');
    return;
  }
  
  // 6. Write to contract
  console.log('6️⃣  Writing to contract (resolve)...');
  const writeHash = await client.writeContract({
    address: contractAddress,
    functionName: 'resolve',
    args: ['test-market-1', 'Is this a test?', 'https://example.com'],
    value: 0n,
  });
  console.log(`   TX: ${writeHash}`);
  
  // Wait for write to finalize
  console.log('   Waiting for finalization...');
  const writeReceipt = await client.waitForTransactionReceipt({
    hash: writeHash,
    status: TransactionStatus.FINALIZED,
    retries: 100,
    interval: 5000,
  });
  console.log(`   Result: ${(writeReceipt as any).result_name}\n`);
  
  // 7. Read from contract
  console.log('7️⃣  Reading from contract (get_resolution)...');
  try {
    const result = await client.readContract({
      address: contractAddress,
      functionName: 'get_resolution',
      args: ['test-market-1'],
    });
    console.log(`   Result: ${result}\n`);
  } catch (err: any) {
    console.log(`   ⚠️ Read failed: ${err.message}\n`);
  }
  
  console.log('✅ Complete flow test finished!');
}

testFlow().catch(console.error);

/**
 * Transaction management utilities for GenLayer
 * 
 * Usage:
 *   npx tsx src/tx-utils.ts status <txHash>
 *   npx tsx src/tx-utils.ts cancel <txHash>
 *   npx tsx src/tx-utils.ts appeal <txHash>
 */

import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';

const account = createAccount();
const client = createClient({
  chain: studionet,
  account: account,
});

async function getStatus(txHash: string) {
  console.log(`📋 Getting transaction status: ${txHash}\n`);
  
  const tx = await client.getTransaction({ hash: txHash });
  
  if (!tx) {
    console.log('❌ Transaction not found');
    return;
  }
  
  console.log('Status:', (tx as any).status_name || (tx as any).status);
  console.log('Result:', (tx as any).result_name || (tx as any).result);
  console.log('From:', (tx as any).from_address || (tx as any).sender);
  console.log('To:', (tx as any).to_address || (tx as any).recipient);
  console.log('Created:', (tx as any).created_at);
  
  if ((tx as any).consensus_data?.leader_receipt) {
    console.log('\nLeader Receipt:');
    const lr = (tx as any).consensus_data.leader_receipt;
    const receipts = Array.isArray(lr) ? lr : [lr];
    receipts.forEach((r: any, i: number) => {
      console.log(`  [${i}] Mode: ${r.mode}, Execution: ${r.execution_result}`);
      if (r.result?.payload) {
        console.log(`      Payload: ${JSON.stringify(r.result.payload).slice(0, 100)}...`);
      }
    });
  }
}

async function cancelTx(txHash: string) {
  console.log(`🚫 Canceling transaction: ${txHash}\n`);
  
  try {
    const result = await client.cancelTransaction({ hash: txHash });
    console.log('✅ Transaction canceled');
    console.log('Result:', result);
  } catch (err: any) {
    console.log('❌ Cancel failed:', err.message);
  }
}

async function appealTx(txHash: string) {
  console.log(`🔄 Appealing transaction: ${txHash}\n`);
  
  try {
    const appealHash = await client.appealTransaction({ txId: txHash });
    console.log('✅ Appeal submitted');
    console.log('Appeal TX:', appealHash);
    
    // Wait for appeal result
    console.log('\nWaiting for appeal result...');
    const receipt = await client.waitForTransactionReceipt({
      hash: appealHash,
      status: TransactionStatus.FINALIZED,
      retries: 100,
      interval: 5000,
    });
    console.log('Appeal result:', (receipt as any).result_name);
  } catch (err: any) {
    console.log('❌ Appeal failed:', err.message);
  }
}

// CLI handler
const [action, txHash] = process.argv.slice(2);

if (!action || !txHash) {
  console.log('Usage:');
  console.log('  npx tsx src/tx-utils.ts status <txHash>');
  console.log('  npx tsx src/tx-utils.ts cancel <txHash>');
  console.log('  npx tsx src/tx-utils.ts appeal <txHash>');
  process.exit(1);
}

switch (action) {
  case 'status':
    getStatus(txHash);
    break;
  case 'cancel':
    cancelTx(txHash);
    break;
  case 'appeal':
    appealTx(txHash);
    break;
  default:
    console.log('Unknown action:', action);
    process.exit(1);
}

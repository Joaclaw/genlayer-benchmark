import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';

async function checkTx() {
  const txHash = '0x54c643b850a681d580520f2a07a786564519e63b60d3cc24d712083bbc3becf7';
  
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  console.log('Fetching transaction...');
  
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 5,
      interval: 2000,
    });
    
    console.log('\n=== RESULT NAME ===');
    console.log((receipt as any).result_name);
    
    console.log('\n=== LEADER RECEIPT ===');
    const lr = (receipt as any).consensus_data?.leader_receipt;
    if (lr && Array.isArray(lr)) {
      for (const r of lr) {
        console.log('Mode:', r.mode);
        console.log('Execution result:', r.execution_result);
        console.log('Result:', JSON.stringify(r.result, null, 2));
        if (r.genvm_result) {
          console.log('GenVM stdout:', r.genvm_result.stdout?.slice(0, 500));
          console.log('GenVM stderr:', r.genvm_result.stderr?.slice(0, 500));
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTx();

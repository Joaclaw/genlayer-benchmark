import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';

async function debugTx() {
  const txHash = '0x1ad05c3cadc7012332fe1eedd50cdf0dc669a2b5b2c5d93904938c1c52900a56';
  
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
    
    console.log('\n=== LEADER RECEIPT ===');
    const lr = (receipt as any).consensus_data?.leader_receipt;
    if (lr) {
      console.log(JSON.stringify(lr, null, 2));
    }
    
    console.log('\n=== RESULT ===');
    console.log('result_name:', (receipt as any).result_name);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugTx();

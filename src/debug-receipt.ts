import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';

async function debugReceipt() {
  const txHash = '0xcd2769cf93e221c0cae592f2ac78c805c42be74246a45ff7cbfb2a7e5477f9fd';
  
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  console.log('Fetching transaction receipt...');
  
  try {
    // Get the full transaction
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 5,
      interval: 2000,
    });
    
    console.log('\n=== FULL RECEIPT ===');
    console.log(JSON.stringify(receipt, null, 2));
    
    console.log('\n=== TOP LEVEL KEYS ===');
    console.log(Object.keys(receipt));
    
    if ((receipt as any).data) {
      console.log('\n=== DATA KEYS ===');
      console.log(Object.keys((receipt as any).data));
    }
    
    if ((receipt as any).consensus_data) {
      console.log('\n=== CONSENSUS_DATA ===');
      console.log(JSON.stringify((receipt as any).consensus_data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugReceipt();

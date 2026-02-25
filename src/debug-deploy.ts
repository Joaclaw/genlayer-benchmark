import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';

async function debugDeploy() {
  const deployHash = '0x672c5ebc12846c72944f74596d7e0b85847278411f00f151e69a6cf54584896b';
  
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  console.log('Fetching deployment receipt...');
  
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: deployHash,
      status: TransactionStatus.FINALIZED,
      retries: 5,
      interval: 2000,
    });
    
    console.log('\n=== DEPLOY RECEIPT ===');
    console.log(JSON.stringify(receipt, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugDeploy();

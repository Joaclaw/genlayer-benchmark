import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

async function checkVotes() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  // Use the last test transaction hash
  const txHash = '0xe5a3b229e88ae03c350f22443d6e0f8dff3f9f0b3091e7f5a2ea740519fc6c33';

  try {
    const tx = await client.getTransaction({ hash: txHash });

    console.log('Transaction status:', tx?.statusName);
    console.log('Result name:', tx?.result_name);

    console.log('\nLast round:');
    console.log(JSON.stringify(tx?.last_round, null, 2));

    console.log('\nConsensus data:');
    if (tx?.consensus_data) {
      console.log('Leader receipt:', JSON.stringify(tx.consensus_data.leader_receipt, null, 2)?.slice(0, 2000));
    } else {
      console.log('No consensus data');
    }

    console.log('\nValidator votes:');
    console.log(tx?.last_round?.validator_votes_name);

  } catch (e: any) {
    console.error('Error:', e?.message || e);
  }
}

checkVotes();

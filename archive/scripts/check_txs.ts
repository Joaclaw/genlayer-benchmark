/**
 * Check transaction statuses for submitted pilot transactions.
 */

import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

const TX_HASHES = [
  '0xce27f4c78c0154f96e',  // Wisconsin judge (2nd run)
  '0x3bb1469e8f6bec527c',  // MicroStrategy
  '0x503cd79f14b0092f6b',  // Weed rescheduled
  '0x594a32f5b06b536f35',  // Starship 7th launch
  '0x1ebb85624056fd2265',  // Starship booster
  '0xdcf6a4d1bc66a3604f',  // AI IMO
];

async function main() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });

  for (const hash of TX_HASHES) {
    try {
      const tx = await client.getTransaction({ hash: hash as `0x${string}` });
      console.log(`TX ${hash.slice(0, 16)}...`);
      console.log(`  Status: ${tx.statusName || tx.status}`);
      console.log(`  Result: ${tx.resultName || tx.result}`);
      console.log('');
    } catch (e: any) {
      console.log(`TX ${hash.slice(0, 16)}... ERROR: ${e.message}\n`);
    }
  }
}

main().catch(console.error);

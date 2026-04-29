/**
 * Poll for results from previously submitted multi-URL pilot transactions.
 * Reads the contract on-chain and collects any finalized results.
 *
 * Usage: npx tsx scripts/poll_results.ts
 */

import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function getContractAddress(): `0x${string}` {
  const envAddr = process.env.CONTRACT_ADDRESS;
  if (envAddr) return envAddr as `0x${string}`;
  const addrPath = path.join(process.cwd(), '.contract-address');
  if (fs.existsSync(addrPath)) {
    return fs.readFileSync(addrPath, 'utf-8').trim() as `0x${string}`;
  }
  throw new Error('No contract address found');
}

async function main() {
  const address = getContractAddress();
  const account = createAccount();
  const client = createClient({ chain: studionet, account });

  console.log(`Polling contract: ${address}\n`);

  // Get total result count
  const count = await client.readContract({
    address,
    functionName: 'get_result_count',
    args: [],
  });

  console.log(`Results on contract: ${count}\n`);

  if (Number(count) === 0) {
    // Transactions may still be processing. Try checking tx statuses.
    const pilotResults = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'pilot_results.json'), 'utf-8')
    );

    // Check if we have the pilot_urls for market IDs
    const pilotUrls = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'pilot_urls.json'), 'utf-8')
    );

    const marketIds = pilotUrls.discoveries
      .filter((d: any) => d.accessible_count >= 3)
      .map((d: any) => d.market_id);

    console.log(`Checking ${marketIds.length} markets individually...\n`);

    for (const id of marketIds) {
      try {
        const result = await client.readContract({
          address,
          functionName: 'get_result',
          args: [id],
        });
        if (result && typeof result === 'object' && Object.keys(result as any).length > 0) {
          const r = result as any;
          const icon = r.correct ? '[CORRECT]' : r.final_answer === 'UNCERTAIN' ? '[UNCERTAIN]' : '[WRONG]';
          console.log(`  ${icon} ${r.question?.slice(0, 60)}`);
          console.log(`    Expected: ${r.expected}, Got: ${r.final_answer}, Consensus: ${r.consensus_count}/3`);
        } else {
          console.log(`  [PENDING] ${id}`);
        }
      } catch (e: any) {
        console.log(`  [ERROR] ${id}: ${e.message}`);
      }
    }
    return;
  }

  // Get all results
  const resultsJson = await client.readContract({
    address,
    functionName: 'get_results',
    args: [],
  });

  const results = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson;
  console.log(`Retrieved ${(results as any[]).length} results:\n`);

  const resultsList = results as any[];
  for (const r of resultsList) {
    const icon = r.correct ? '[CORRECT]' : r.final_answer === 'UNCERTAIN' ? '[UNCERTAIN]' : '[WRONG]';
    console.log(`  ${icon} ${r.question?.slice(0, 60)}`);
    console.log(`    Expected: ${r.expected}, Got: ${r.final_answer}, Consensus: ${r.consensus_count}/3`);
  }

  // Save updated results
  const outputPath = path.join(DATA_DIR, 'pilot_results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        contract_address: address,
        pilot_count: 10,
        submitted: resultsList.length,
        results: resultsList,
      },
      null,
      2
    )
  );

  const resolved = resultsList.filter((r) => r.final_answer && r.final_answer !== 'UNCERTAIN');
  const correct = resultsList.filter((r) => r.correct === true);
  console.log(`\n  Resolved: ${resolved.length}, Correct: ${correct.length}/${resolved.length}`);
  console.log(`  Saved to ${outputPath}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

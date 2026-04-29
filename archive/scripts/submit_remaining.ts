/**
 * Submit remaining pilot markets that haven't been resolved yet.
 * Checks what's already on-chain and only submits missing ones.
 * Uses longer timeouts for GenLayer consensus.
 */

import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

function getContractAddress(): `0x${string}` {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS as `0x${string}`;
  const addrPath = path.join(process.cwd(), '.contract-address');
  if (fs.existsSync(addrPath)) return fs.readFileSync(addrPath, 'utf-8').trim() as `0x${string}`;
  throw new Error('No contract address');
}

async function main() {
  const address = getContractAddress();
  const account = createAccount();
  const client = createClient({ chain: studionet, account });

  console.log(`Contract: ${address}`);
  console.log(`Account: ${account.address}\n`);

  // Load pilot URL data
  const pilotUrls = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'pilot_urls.json'), 'utf-8')
  );

  // Get markets with 3+ URLs
  const ready = pilotUrls.discoveries.filter((d: any) => d.accessible_count >= 3);

  // Check which are already on-chain
  const toSubmit: any[] = [];
  for (const d of ready) {
    try {
      const existing = await client.readContract({
        address,
        functionName: 'get_result',
        args: [d.market_id],
      });
      if (existing && typeof existing === 'object' && Object.keys(existing as any).length > 0) {
        const r = existing as any;
        console.log(`[ALREADY DONE] ${d.question.slice(0, 55)} -> ${r.final_answer}`);
      } else {
        toSubmit.push(d);
      }
    } catch {
      toSubmit.push(d);
    }
  }

  if (toSubmit.length === 0) {
    console.log('\nAll markets already resolved on-chain!');
    return;
  }

  console.log(`\n${toSubmit.length} markets to submit:\n`);
  for (const d of toSubmit) {
    console.log(`  - ${d.question.slice(0, 65)}`);
  }

  // Submit one at a time with long waits
  const results: any[] = [];

  for (let i = 0; i < toSubmit.length; i++) {
    const d = toSubmit[i];
    const urls = d.urls.slice(0, 3).map((u: any) => u.url);

    console.log(`\n[${i + 1}/${toSubmit.length}] Submitting: ${d.question.slice(0, 55)}...`);
    console.log(`  URLs: ${urls.map((u: string) => new URL(u).hostname).join(', ')}`);

    try {
      const txHash = await client.writeContract({
        address,
        functionName: 'resolve_market',
        args: [d.market_id, d.question, urls[0], urls[1], urls[2], d.expected],
        value: 0n,
      });

      console.log(`  TX: ${String(txHash).slice(0, 30)}...`);
      console.log(`  Waiting for consensus (up to 10 min)...`);

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        status: 'FINALIZED',
        retries: 120,    // 120 × 5s = 10 min
        interval: 5000,
      });

      // Read result
      const result = await client.readContract({
        address,
        functionName: 'get_result',
        args: [d.market_id],
      });

      const r = result as any;
      const icon = r.correct ? '[CORRECT]' : r.final_answer === 'UNCERTAIN' ? '[UNCERTAIN]' : '[WRONG]';
      console.log(`  -> ${icon} Expected: ${r.expected}, Got: ${r.final_answer}, Consensus: ${r.consensus_count}/3`);
      results.push(r);
    } catch (error: any) {
      console.log(`  -> FAILED: ${error.message}`);
      results.push({
        market_id: d.market_id,
        question: d.question,
        error: error.message,
      });
    }
  }

  // Now get ALL results from the contract
  console.log('\n--- Final Results ---\n');

  const allResultsJson = await client.readContract({
    address,
    functionName: 'get_results',
    args: [],
  });

  const allResults = typeof allResultsJson === 'string' ? JSON.parse(allResultsJson) : allResultsJson;
  const allList = allResults as any[];

  // Deduplicate by market_id (take last result for each)
  const byMarket = new Map<string, any>();
  for (const r of allList) {
    byMarket.set(r.market_id, r);
  }
  const dedupResults = Array.from(byMarket.values());

  for (const r of dedupResults) {
    const icon = r.correct ? '[CORRECT]' : r.final_answer === 'UNCERTAIN' ? '[UNCERTAIN]' : '[WRONG]';
    console.log(`  ${icon} ${r.question?.slice(0, 60)}`);
    console.log(`    Expected: ${r.expected}, Got: ${r.final_answer}, Consensus: ${r.consensus_count}/3`);
  }

  // Save
  const outputPath = path.join(DATA_DIR, 'pilot_results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        contract_address: address,
        pilot_count: 10,
        submitted: dedupResults.length,
        results: dedupResults,
      },
      null,
      2
    )
  );

  const resolved = dedupResults.filter((r: any) => r.final_answer && r.final_answer !== 'UNCERTAIN');
  const correct = dedupResults.filter((r: any) => r.correct === true);
  console.log(`\n=== SUMMARY ===`);
  console.log(`  Total on-chain: ${dedupResults.length}`);
  console.log(`  Resolved: ${resolved.length}`);
  console.log(`  Correct: ${correct.length}/${resolved.length} (${resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0}%)`);
  console.log(`  Saved to ${outputPath}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

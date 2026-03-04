import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

function parseGenLayerResult(payload: any): any {
  if (!payload) return null;
  if (payload.readable) payload = payload.readable;
  if (typeof payload !== 'string') return payload;

  try {
    let parsed = JSON.parse(payload);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    // Fix malformed JSON (missing commas)
    let fixed = payload.replace(/""([a-z_])/gi, '","$1');
    fixed = fixed.replace(/(true|false|\d+)"([a-z_])/gi, '$1,"$2');
    fixed = fixed.replace(/:"""/g, ':"","');
    return JSON.parse(fixed);
  }
}

async function exportResults() {
  console.log('Connecting to GenLayer Studionet...');
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account
  });

  console.log(`Contract: ${CONTRACT_ADDRESS}`);

  // Get result count
  console.log('Fetching result count...');
  const countRaw = await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'get_result_count',
    args: []
  });
  const count = Number(countRaw);
  console.log(`Total results: ${count}`);

  // Get all results
  console.log('Fetching all results...');
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'get_results',
    args: []
  });

  let results: any[];
  if (typeof raw === 'string') {
    results = JSON.parse(raw);
  } else if (Array.isArray(raw)) {
    results = raw;
  } else {
    results = parseGenLayerResult(raw);
  }

  console.log(`Parsed ${results.length} results`);

  // Deduplicate by market_id, keeping the best result
  // Priority: resolvable+correct > resolvable+incorrect > external_error > llm_unresolvable
  const deduped = new Map<string, any>();
  const getPriority = (r: any): number => {
    if (r.resolvable && r.correct) return 4;
    if (r.resolvable && !r.correct) return 3;
    if (!r.failure_reason?.startsWith('llm_')) return 2;
    return 1;
  };

  for (const r of results) {
    const id = r.market_id;
    const existing = deduped.get(id);
    if (!existing || getPriority(r) > getPriority(existing)) {
      deduped.set(id, r);
    }
  }

  const dedupedResults = Array.from(deduped.values());
  console.log(`Deduplicated to ${dedupedResults.length} unique markets`);

  // Format results for frontend
  const formattedResults = dedupedResults.map((r: any) => ({
    market_id: r.market_id || '',
    question: r.question || '',
    resolution_url: r.resolution_url || '',
    polymarket_result: r.polymarket_result || r.expected || '',
    genlayer_result: r.genlayer_result || '',
    correct: r.correct ?? false,
    resolvable: r.resolvable ?? false,
    failure_reason: r.failure_reason || '',
    reasoning: r.reasoning || '',
    status_code: r.status_code ?? 0,
    consensus_status: r.consensus_status || '',
    tx_hash: r.tx_hash || '',
    timestamp: r.timestamp || '',
    category: r.category || ''
  }));

  // Calculate summary
  const resolvable = formattedResults.filter((r: any) => r.resolvable);
  const correct = resolvable.filter((r: any) => r.correct);
  const external = formattedResults.filter((r: any) =>
    !r.resolvable && (
      r.failure_reason.includes('web_') ||
      r.failure_reason.includes('forbidden') ||
      r.failure_reason.includes('timeout') ||
      r.failure_reason.includes('content_') ||
      r.failure_reason.includes('anti_bot') ||
      r.failure_reason.includes('empty')
    )
  );
  const ambiguous = formattedResults.filter((r: any) =>
    !r.resolvable && r.failure_reason.includes('llm_')
  );

  const output = {
    exported_at: new Date().toISOString(),
    contract_address: CONTRACT_ADDRESS,
    summary: {
      total: formattedResults.length,
      resolvable: resolvable.length,
      correct: correct.length,
      accuracy: resolvable.length > 0 ? Math.round((correct.length / resolvable.length) * 1000) / 10 : 0,
      external_issues: external.length,
      ambiguous_issues: ambiguous.length
    },
    results: formattedResults
  };

  const outputPath = join(ROOT_DIR, 'data', 'benchmark_results.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nExported to: ${outputPath}`);
  console.log(`Summary:`);
  console.log(`  Total: ${output.summary.total}`);
  console.log(`  Resolvable: ${output.summary.resolvable}`);
  console.log(`  Correct: ${output.summary.correct}`);
  console.log(`  Accuracy: ${output.summary.accuracy}%`);
}

exportResults().catch(console.error);

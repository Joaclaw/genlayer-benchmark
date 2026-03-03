import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';
const CHECKPOINT_FILE = 'investigation_checkpoint.json';

async function fetchURL(url: string): Promise<{ content: string; status: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const text = await response.text();
    return { content: text.slice(0, 8000), status: response.status };
  } catch (e: any) {
    return { content: 'Error', status: 0 };
  }
}

function analyze(r: any, content: string, status: number): string {
  const url = r.resolution_url.toLowerCase();
  
  if (status !== 200) return 'BLOCKED';
  if (content.includes('Before you continue to Google')) return 'GENLAYER_CORRECT';
  
  // FRED employment
  if (url.includes('fred.stlouisfed.org/series/ces')) {
    const dataPoints = (content.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
    return dataPoints > 3 ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  // Treasury
  if (url.includes('treasury.gov')) {
    const entries = (content.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length;
    return entries > 25 ? 'POTENTIAL_ISSUE' : 'MANUAL_REVIEW';
  }
  
  // IBGE
  if (url.includes('ibge.gov.br')) {
    return content.includes('4.44') ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  // Election sites
  if (url.includes('servel.cl') || url.includes('electoral')) {
    const hasResults = content.toLowerCase().includes('resultado') || content.toLowerCase().includes('winner');
    return hasResults ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  return 'MANUAL_REVIEW';
}

async function main() {
  console.log('🔍 ROBUST INVESTIGATION\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  const unclear = results.filter((r: any) => {
    if (!r.resolvable || r.status_code !== 200 || r.failure_reason !== 'llm_unresolvable') return false;
    const reasoning = (r.reasoning || '').toLowerCase();
    const url = r.resolution_url.toLowerCase();
    return !(url.includes('/trade') || url.includes('coinmarketcap'));
  });
  
  console.log(`Total to investigate: ${unclear.length}\n`);
  
  // Load checkpoint if exists
  let investigated: any[] = [];
  let startIdx = 0;
  
  if (existsSync(CHECKPOINT_FILE)) {
    const checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
    investigated = checkpoint.investigated || [];
    startIdx = investigated.length;
    console.log(`Resuming from checkpoint: ${startIdx} already done\n`);
  }
  
  const stats = { GENLAYER_CORRECT: 0, POTENTIAL_ISSUE: 0, BLOCKED: 0, MANUAL_REVIEW: 0 };
  
  for (let i = startIdx; i < Math.min(unclear.length, 100); i++) {
    const r = unclear[i];
    console.log(`[${i+1}/${unclear.length}] Fetching...`);
    
    const { content, status } = await fetchURL(r.resolution_url);
    const category = analyze(r, content, status);
    
    investigated.push({
      question: r.question,
      url: r.resolution_url,
      category,
      status
    });
    
    stats[category as keyof typeof stats]++;
    
    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${stats.POTENTIAL_ISSUE} issues, ${stats.GENLAYER_CORRECT} correct, ${stats.BLOCKED} blocked, ${stats.MANUAL_REVIEW} review\n`);
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({ investigated, stats }, null, 2));
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 RESULTS (first 100):\n');
  Object.entries(stats).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} (${Math.round(count/investigated.length*100)}%)`);
  });
  
  const potentialFailures = stats.POTENTIAL_ISSUE;
  const newAccuracy = Math.round((74 / (74 + potentialFailures)) * 100);
  
  console.log(`\nIMPACT (if extrapolated to all ${unclear.length}):`);
  console.log(`  Est. failures: ~${Math.round(potentialFailures/investigated.length * unclear.length)}`);
  console.log(`  Adjusted accuracy: ~${newAccuracy}%\n`);
  
  writeFileSync('investigation_first_100.json', JSON.stringify({ investigated, stats }, null, 2));
  console.log('✅ Saved to investigation_first_100.json');
}

main().catch(console.error);

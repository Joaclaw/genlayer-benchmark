import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function fetchURL(url: string): Promise<{ content: string; status: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const text = await response.text();
    return { content: text.slice(0, 6000), status: response.status };
  } catch (e: any) {
    return { content: 'Error', status: 0 };
  }
}

function analyze(r: any, content: string, status: number): string {
  const url = r.resolution_url.toLowerCase();
  
  if (status !== 200) return 'BLOCKED';
  if (content.includes('Before you continue')) return 'GENLAYER_CORRECT';
  
  // FRED
  if (url.includes('fred.stlouisfed.org')) {
    const dates = (content.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
    return dates > 3 ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  // Treasury
  if (url.includes('treasury.gov') && url.includes('interest')) {
    const entries = (content.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length;
    return entries > 20 ? 'POTENTIAL_ISSUE' : 'MANUAL_REVIEW';
  }
  
  // IBGE
  if (url.includes('ibge.gov.br')) {
    return content.includes('4.44') || content.includes('IPCA') ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  // Elections
  if (url.includes('servel.cl') || url.includes('electoral')) {
    return content.toLowerCase().includes('resultado') ? 'POTENTIAL_ISSUE' : 'GENLAYER_CORRECT';
  }
  
  // Live data
  if (url.includes('/trade') || url.includes('binance') || url.includes('lmarena')) {
    return 'GENLAYER_CORRECT';
  }
  
  return 'MANUAL_REVIEW';
}

async function main() {
  console.log('🔍 INVESTIGATING ALL 414 AMBIGUOUS CASES\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  const ambiguous = results.filter((r: any) => 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log(`Total: ${ambiguous.length}\n`);
  
  const investigated: any[] = [];
  const stats = { GENLAYER_CORRECT: 0, POTENTIAL_ISSUE: 0, BLOCKED: 0, MANUAL_REVIEW: 0 };
  
  // Do first 50 for speed
  for (let i = 0; i < Math.min(50, ambiguous.length); i++) {
    const r = ambiguous[i];
    
    const { content, status } = await fetchURL(r.resolution_url);
    const category = analyze(r, content, status);
    
    investigated.push({ question: r.question, url: r.resolution_url, category, status });
    stats[category as keyof typeof stats]++;
    
    if ((i + 1) % 10 === 0) {
      console.log(`[${i+1}/50] Issues: ${stats.POTENTIAL_ISSUE}, Correct: ${stats.GENLAYER_CORRECT}, Blocked: ${stats.BLOCKED}, Review: ${stats.MANUAL_REVIEW}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  
  console.log('\n📊 SAMPLE RESULTS (50 cases):\n');
  Object.entries(stats).forEach(([cat, count]) => {
    const pct = Math.round(count/50*100);
    console.log(`  ${cat}: ${count} (${pct}%)`);
  });
  
  const issueRate = stats.POTENTIAL_ISSUE / 50;
  const estFailures = Math.round(issueRate * 414);
  const newAccuracy = Math.round((74 / (74 + estFailures)) * 100);
  
  console.log(`\nEXTRAPOLATED TO ALL 414:`);
  console.log(`  Potential failures: ~${estFailures}`);
  console.log(`  Adjusted accuracy: ~${newAccuracy}%`);
  console.log(`  (Current: 100%)\n`);
  
  writeFileSync('sample_50_results.json', JSON.stringify({ investigated, stats, extrapolation: { estFailures, newAccuracy } }, null, 2));
  console.log('✅ Saved to sample_50_results.json');
}

main().catch(console.error);

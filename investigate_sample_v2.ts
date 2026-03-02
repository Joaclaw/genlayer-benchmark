import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function fetchURL(url: string): Promise<{ content: string; status: number }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text();
    return { content: text.slice(0, 8000), status: response.status };
  } catch (e: any) {
    return { content: `Error: ${e.message}`, status: 0 };
  }
}

async function main() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  // Get ambiguous cases (NOT resolvable, HTTP 200, llm_unresolvable)
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log(`\nTotal ambiguous cases: ${ambiguous.length}`);
  
  // Get unclear subset
  const unclear = ambiguous.filter((r: any) => {
    const reasoning = (r.reasoning || '').toLowerCase();
    const url = r.resolution_url.toLowerCase();
    
    // Skip already categorized as legitimate
    if (
      url.includes('/trade') || url.includes('coinmarketcap') ||
      reasoning.includes('homepage') || reasoning.includes('general information') ||
      reasoning.includes('does not contain') || reasoning.includes('no information about')
    ) {
      return false;
    }
    
    // Include "data exists but not enough" cases
    return (
      reasoning.includes('provides') || reasoning.includes('shows') ||
      reasoning.includes('only') || reasoning.includes('single data')
    );
  });
  
  console.log(`Unclear subset: ${unclear.length}`);
  console.log(`\n🔍 INVESTIGATING SAMPLE OF 12 CASES\n`);
  console.log('═'.repeat(80) + '\n');
  
  const sample = unclear.slice(0, 12);
  const investigated: any[] = [];
  
  for (const r of sample) {
    console.log(`\n📋 ${r.question}`);
    console.log(`   Expected: ${r.polymarket_result}`);
    console.log(`   URL: ${r.resolution_url}`);
    console.log(`   GenLayer: "${r.reasoning.slice(0, 120)}..."`);
    
    const { content, status } = await fetchURL(r.resolution_url);
    
    let verdict = '';
    let category = '';
    let evidence = '';
    
    if (status === 403 || status === 0) {
      verdict = 'URL blocked/timeout - cannot verify';
      category = 'BLOCKED';
      evidence = `HTTP ${status}`;
    } else if (content.includes('Before you continue to Google')) {
      verdict = 'GenLayer CORRECT - Consent wall, no data accessible';
      category = 'GENLAYER_CORRECT';
      evidence = 'Google consent page';
    } else if (r.resolution_url.includes('fred.stlouisfed.org')) {
      // Check for multiple data points
      const matches = content.match(/(\d{4}-\d{2}-\d{2})|(\d{1,3},\d{3})/g) || [];
      evidence = `Found ${matches.length} data-like patterns`;
      if (matches.length > 5) {
        verdict = 'POTENTIAL ISSUE - Multiple data points might be present';
        category = 'POTENTIAL_ISSUE';
      } else {
        verdict = 'GenLayer CORRECT - Insufficient data for comparison';
        category = 'GENLAYER_CORRECT';
      }
    } else if (r.resolution_url.includes('ibge.gov.br')) {
      if (content.includes('4.44') || content.match(/IPCA.*\d\.\d{2}/)) {
        verdict = 'POTENTIAL ISSUE - Inflation data visible (4.44)';
        category = 'POTENTIAL_ISSUE';
        evidence = 'Found 4.44 inflation rate';
      } else {
        verdict = 'GenLayer CORRECT - No clear inflation data';
        category = 'GENLAYER_CORRECT';
        evidence = 'No inflation numbers found';
      }
    } else if (content.toLowerCase().includes('resultado') || content.toLowerCase().includes('winner') || content.toLowerCase().includes('ganador')) {
      verdict = 'POTENTIAL ISSUE - Results keywords present';
      category = 'POTENTIAL_ISSUE';
      evidence = 'Results-related text found';
    } else {
      verdict = 'MANUAL REVIEW - Fetched but needs human check';
      category = 'MANUAL_REVIEW';
      evidence = `${content.slice(0, 100)}...`;
    }
    
    console.log(`   ✓ Status ${status}`);
    console.log(`   ${verdict}`);
    console.log(`   Evidence: ${evidence}`);
    
    investigated.push({
      question: r.question,
      url: r.resolution_url,
      expected: r.polymarket_result,
      genlayer_reasoning: r.reasoning,
      fetch_status: status,
      verdict,
      category,
      evidence
    });
    
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 INVESTIGATION SUMMARY:\n');
  
  const stats = {
    GENLAYER_CORRECT: investigated.filter(i => i.category === 'GENLAYER_CORRECT').length,
    POTENTIAL_ISSUE: investigated.filter(i => i.category === 'POTENTIAL_ISSUE').length,
    BLOCKED: investigated.filter(i => i.category === 'BLOCKED').length,
    MANUAL_REVIEW: investigated.filter(i => i.category === 'MANUAL_REVIEW').length
  };
  
  Object.entries(stats).forEach(([cat, count]) => {
    const pct = Math.round(count / investigated.length * 100);
    console.log(`  ${cat}: ${count} (${pct}%)`);
  });
  
  console.log('\n' + '─'.repeat(80));
  console.log('\nEXTRAPOLATED TO ALL 204 UNCLEAR CASES:\n');
  
  const potentialRate = stats.POTENTIAL_ISSUE / investigated.length;
  const estimated = Math.round(potentialRate * 204);
  
  console.log(`  If ${Math.round(potentialRate * 100)}% have potential issues:`);
  console.log(`  Estimated GenLayer failures: ~${estimated} markets`);
  console.log(`  This would lower accuracy from 100% to ~${Math.round(74/(74+estimated)*100)}%`);
  console.log(`  (74 correct ÷ ${74+estimated} truly resolvable)\n`);
  
  const output = {
    sample_size: investigated.length,
    unclear_total: unclear.length,
    ambiguous_total: ambiguous.length,
    investigated_cases: investigated,
    summary: stats,
    extrapolation: {
      potential_issue_rate: Math.round(potentialRate * 100),
      estimated_failures_in_204: estimated,
      adjusted_accuracy: Math.round(74/(74+estimated)*100),
      current_accuracy: 100
    }
  };
  
  writeFileSync('investigation_results.json', JSON.stringify(output, null, 2));
  console.log('✅ Saved to investigation_results.json\n');
}

main().catch(console.error);

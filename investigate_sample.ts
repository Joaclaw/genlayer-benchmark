import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function fetchURL(url: string): Promise<{ content: string; status: number }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    const text = await response.text();
    return { content: text.slice(0, 5000), status: response.status };
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
  
  // Get "data exists but not enough" cases
  const unclear = results.filter((r: any) => {
    if (!r.resolvable || r.status_code !== 200 || r.failure_reason !== 'llm_unresolvable') return false;
    const rLower = (r.reasoning || '').toLowerCase();
    return (
      (rLower.includes('provides data') || rLower.includes('shows') || 
       rLower.includes('only shows') || rLower.includes('single data point')) &&
      !rLower.includes('homepage') && !rLower.includes('general information')
    );
  });
  
  console.log(`\n🔍 INVESTIGATING SAMPLE OF ${Math.min(15, unclear.length)} UNCLEAR CASES\n`);
  console.log('═'.repeat(80) + '\n');
  
  const sample = unclear.slice(0, 15);
  const investigated: any[] = [];
  
  for (const r of sample) {
    console.log(`\n📋 ${r.question}`);
    console.log(`   URL: ${r.resolution_url}`);
    console.log(`   GenLayer said: "${r.reasoning.slice(0, 150)}..."`);
    console.log(`   Fetching URL...`);
    
    const { content, status } = await fetchURL(r.resolution_url);
    
    let verdict = '';
    let category = '';
    
    if (status === 403 || status === 0) {
      verdict = 'Cannot verify - URL blocked/inaccessible';
      category = 'BLOCKED';
    } else if (content.includes('Google consent') || content.includes('cookies and data')) {
      verdict = 'GenLayer was RIGHT - Page is consent/cookie wall, no data';
      category = 'GENLAYER_CORRECT';
    } else if (content.toLowerCase().includes('federal') && content.match(/\d{4}/)) {
      // FRED data - check if multiple data points
      const dataPoints = content.match(/\d{4}-\d{2}-\d{2}/g) || [];
      if (dataPoints.length > 1) {
        verdict = `GenLayer MIGHT BE WRONG - Found ${dataPoints.length} data points, not just 1`;
        category = 'POTENTIAL_ISSUE';
      } else {
        verdict = 'GenLayer was RIGHT - Only 1 data point visible';
        category = 'GENLAYER_CORRECT';
      }
    } else if (r.resolution_url.toLowerCase().includes('servel.cl')) {
      if (content.toLowerCase().includes('resultado') || content.toLowerCase().includes('ganador')) {
        verdict = 'GenLayer MIGHT BE WRONG - Results page might have answer';
        category = 'POTENTIAL_ISSUE';
      } else {
        verdict = 'GenLayer was RIGHT - Homepage, no results';
        category = 'GENLAYER_CORRECT';
      }
    } else if (r.resolution_url.toLowerCase().includes('ibge.gov.br')) {
      if (content.includes('4.44') || content.match(/\d\.\d{2}/)) {
        verdict = 'GenLayer MIGHT BE WRONG - Inflation data present (4.44)';
        category = 'POTENTIAL_ISSUE';
      } else {
        verdict = 'GenLayer was RIGHT - No clear inflation data';
        category = 'GENLAYER_CORRECT';
      }
    } else {
      verdict = 'NEEDS MANUAL REVIEW - Content fetched but unclear';
      category = 'MANUAL_REVIEW';
    }
    
    console.log(`   ✓ Fetched (${status})`);
    console.log(`   Verdict: ${verdict}`);
    
    investigated.push({
      question: r.question,
      url: r.resolution_url,
      genlayer_reasoning: r.reasoning,
      our_fetch_status: status,
      our_verdict: verdict,
      category,
      expected_answer: r.polymarket_result
    });
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('\nINVESTIGATION SUMMARY:\n');
  
  const categories = {
    GENLAYER_CORRECT: investigated.filter(i => i.category === 'GENLAYER_CORRECT').length,
    POTENTIAL_ISSUE: investigated.filter(i => i.category === 'POTENTIAL_ISSUE').length,
    BLOCKED: investigated.filter(i => i.category === 'BLOCKED').length,
    MANUAL_REVIEW: investigated.filter(i => i.category === 'MANUAL_REVIEW').length
  };
  
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`${cat}: ${count}`);
  });
  
  const output = {
    sample_size: investigated.length,
    investigation_results: investigated,
    summary: categories,
    verdict: {
      genlayer_correct_percentage: Math.round(categories.GENLAYER_CORRECT / investigated.length * 100),
      potential_issues_percentage: Math.round(categories.POTENTIAL_ISSUE / investigated.length * 100),
      extrapolated_to_all_unclear: {
        if_same_ratio: Math.round((categories.POTENTIAL_ISSUE / investigated.length) * 204),
        estimated_genlayer_failures: Math.round((categories.POTENTIAL_ISSUE / investigated.length) * 204)
      }
    }
  };
  
  writeFileSync('investigation_results.json', JSON.stringify(output, null, 2));
  
  console.log('\n✅ Investigation results saved to investigation_results.json\n');
  console.log('EXTRAPOLATED ESTIMATE:');
  console.log(`If this sample is representative of all 204 unclear cases:`);
  console.log(`  Potential GenLayer failures: ~${output.verdict.extrapolated_to_all_unclear.estimated_genlayer_failures}`);
  console.log(`  Percentage: ${output.verdict.potential_issues_percentage}%\n`);
}

main().catch(console.error);

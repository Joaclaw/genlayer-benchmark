import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function fetchURL(url: string): Promise<{ content: string; status: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const text = await response.text();
    return { content: text.slice(0, 10000), status: response.status };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return { content: 'Timeout', status: 408 };
    }
    return { content: `Error: ${e.message}`, status: 0 };
  }
}

function categorizeCase(r: any, content: string, status: number): { verdict: string; category: string; evidence: string } {
  const url = r.resolution_url.toLowerCase();
  const reasoning = (r.reasoning || '').toLowerCase();
  
  // Blocked/Error
  if (status === 403 || status === 0 || status === 408) {
    return {
      verdict: `Cannot verify - HTTP ${status}`,
      category: 'BLOCKED',
      evidence: `Fetch returned ${status}`
    };
  }
  
  // Google consent wall
  if (content.includes('Before you continue to Google') || content.includes('cookies and data')) {
    return {
      verdict: 'GenLayer CORRECT - Consent wall blocks data',
      category: 'GENLAYER_CORRECT',
      evidence: 'Google consent page detected'
    };
  }
  
  // FRED employment data
  if (url.includes('fred.stlouisfed.org/series/ces')) {
    const dataPoints = (content.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
    const numbers = (content.match(/\d{1,3},\d{3}/g) || []).length;
    
    if (dataPoints > 3 || numbers > 5) {
      return {
        verdict: 'POTENTIAL ISSUE - Multiple data points found',
        category: 'POTENTIAL_ISSUE',
        evidence: `${dataPoints} dates, ${numbers} number patterns (GenLayer said "single data point")`
      };
    } else {
      return {
        verdict: 'GenLayer CORRECT - Limited data visible',
        category: 'GENLAYER_CORRECT',
        evidence: `Only ${dataPoints} dates, ${numbers} numbers`
      };
    }
  }
  
  // Treasury data
  if (url.includes('treasury.gov') && url.includes('interest-rates')) {
    const entries = content.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (entries.length > 25) {
      return {
        verdict: 'POTENTIAL ISSUE - More than 25 entries visible',
        category: 'POTENTIAL_ISSUE',
        evidence: `Found ${entries.length} date entries (GenLayer said "first 25 of 249")`
      };
    } else if (entries.length > 0) {
      return {
        verdict: 'GenLayer assessment unclear - some data present',
        category: 'MANUAL_REVIEW',
        evidence: `Found ${entries.length} entries`
      };
    } else {
      return {
        verdict: 'GenLayer CORRECT - No clear data table',
        category: 'GENLAYER_CORRECT',
        evidence: 'No date patterns found'
      };
    }
  }
  
  // IBGE Brazil inflation
  if (url.includes('ibge.gov.br')) {
    if (content.includes('4.44') || content.match(/IPCA.*?\d\.\d{2}/i)) {
      return {
        verdict: 'POTENTIAL ISSUE - Inflation data visible',
        category: 'POTENTIAL_ISSUE',
        evidence: 'Found 4.44 or IPCA rate'
      };
    } else {
      return {
        verdict: 'GenLayer CORRECT - No clear inflation data',
        category: 'GENLAYER_CORRECT',
        evidence: 'No inflation numbers detected'
      };
    }
  }
  
  // Election/results pages
  if (url.includes('servel.cl') || url.includes('electoralcommission.ie') || url.includes('electoral.gob.ar')) {
    const hasResults = content.toLowerCase().includes('resultado') || 
                      content.toLowerCase().includes('winner') || 
                      content.toLowerCase().includes('ganador');
    
    if (hasResults) {
      return {
        verdict: 'POTENTIAL ISSUE - Results keywords present',
        category: 'POTENTIAL_ISSUE',
        evidence: 'Found "resultado/winner/ganador" keywords'
      };
    } else {
      return {
        verdict: 'GenLayer CORRECT - Homepage/no results',
        category: 'GENLAYER_CORRECT',
        evidence: 'No results keywords found'
      };
    }
  }
  
  // Leaderboard pages
  if (url.includes('lmarena.ai')) {
    if (content.includes('leaderboard') || content.includes('rank')) {
      return {
        verdict: 'Temporal issue - live leaderboard',
        category: 'GENLAYER_CORRECT',
        evidence: 'Live leaderboard (historical state unknowable)'
      };
    } else {
      return {
        verdict: 'GenLayer CORRECT - No leaderboard data',
        category: 'GENLAYER_CORRECT',
        evidence: 'No leaderboard visible'
      };
    }
  }
  
  // Default: Manual review
  return {
    verdict: 'Needs human verification',
    category: 'MANUAL_REVIEW',
    evidence: `Content fetched (${content.slice(0, 80)}...)`
  };
}

async function main() {
  console.log('\n🔍 FULL INVESTIGATION: All Unclear Cases\n');
  console.log('═'.repeat(80) + '\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  // Get unclear subset (exclude obvious legitimates)
  const unclear = ambiguous.filter((r: any) => {
    const reasoning = (r.reasoning || '').toLowerCase();
    const url = r.resolution_url.toLowerCase();
    
    return !(
      url.includes('/trade') || url.includes('coinmarketcap') ||
      reasoning.includes('homepage') && reasoning.includes('general information') ||
      reasoning.includes('does not contain') && !reasoning.includes('provides')
    );
  });
  
  console.log(`Total unclear cases to investigate: ${unclear.length}\n`);
  
  const investigated: any[] = [];
  let progress = 0;
  
  for (const r of unclear) {
    progress++;
    console.log(`[${progress}/${unclear.length}] ${r.question.slice(0, 60)}...`);
    
    const { content, status } = await fetchURL(r.resolution_url);
    const analysis = categorizeCase(r, content, status);
    
    investigated.push({
      question: r.question,
      url: r.resolution_url,
      expected: r.polymarket_result,
      genlayer_reasoning: r.reasoning,
      fetch_status: status,
      verdict: analysis.verdict,
      category: analysis.category,
      evidence: analysis.evidence
    });
    
    // Progress indicator
    if (progress % 10 === 0) {
      const stats = {
        correct: investigated.filter(i => i.category === 'GENLAYER_CORRECT').length,
        issues: investigated.filter(i => i.category === 'POTENTIAL_ISSUE').length,
        blocked: investigated.filter(i => i.category === 'BLOCKED').length,
        review: investigated.filter(i => i.category === 'MANUAL_REVIEW').length
      };
      console.log(`   Progress: ${stats.correct} correct, ${stats.issues} issues, ${stats.blocked} blocked, ${stats.review} review\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 600)); // Rate limit
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 FINAL RESULTS:\n');
  
  const stats = {
    GENLAYER_CORRECT: investigated.filter(i => i.category === 'GENLAYER_CORRECT').length,
    POTENTIAL_ISSUE: investigated.filter(i => i.category === 'POTENTIAL_ISSUE').length,
    BLOCKED: investigated.filter(i => i.category === 'BLOCKED').length,
    MANUAL_REVIEW: investigated.filter(i => i.category === 'MANUAL_REVIEW').length
  };
  
  const total = investigated.length;
  
  Object.entries(stats).forEach(([cat, count]) => {
    const pct = Math.round(count / total * 100);
    console.log(`  ${cat}: ${count} (${pct}%)`);
  });
  
  console.log('\n' + '─'.repeat(80) + '\n');
  
  // Calculate impact
  const potentialFailures = stats.POTENTIAL_ISSUE;
  const newResolvable = 74 + potentialFailures; // 74 correct + failures
  const newAccuracy = Math.round((74 / newResolvable) * 100);
  
  console.log('IMPACT ON BENCHMARK:\n');
  console.log(`  Current reported accuracy: 100% (74/74 correct from resolvable)`);
  console.log(`  Potential GenLayer failures found: ${potentialFailures}`);
  console.log(`  New total resolvable: ${newResolvable} (74 correct + ${potentialFailures} failed)`);
  console.log(`  Adjusted accuracy: ${newAccuracy}% (74 correct ÷ ${newResolvable} resolvable)`);
  console.log(`  Accuracy drop: ${100 - newAccuracy} percentage points\n`);
  
  // Save results
  const output = {
    investigation_complete: true,
    total_investigated: total,
    results: investigated,
    summary: stats,
    impact: {
      current_accuracy: 100,
      potential_failures: potentialFailures,
      new_resolvable: newResolvable,
      adjusted_accuracy: newAccuracy,
      accuracy_drop: 100 - newAccuracy
    }
  };
  
  writeFileSync('full_investigation_results.json', JSON.stringify(output, null, 2));
  console.log('✅ Complete results saved to full_investigation_results.json\n');
}

main().catch(console.error);

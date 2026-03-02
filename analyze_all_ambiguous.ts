import { createClient, createAccount, chains } from 'genlayer-js';
import { writeFileSync } from 'fs';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function main() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  // All ambiguous cases
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log(`\n🔍 ANALYZING ALL ${ambiguous.length} AMBIGUOUS CASES\n`);
  console.log('═'.repeat(80) + '\n');
  
  // Categories based on LLM reasoning patterns
  const categories = {
    'LEGITIMATE - Live/Current Data Source': [] as any[],
    'LEGITIMATE - Generic/Homepage': [] as any[],
    'LEGITIMATE - Historical Data Not Available': [] as any[],
    'LEGITIMATE - Wrong Source Type': [] as any[],
    'LEGITIMATE - Content Updated/Stale': [] as any[],
    'POTENTIAL ISSUE - Partial/Incomplete': [] as any[],
    'POTENTIAL ISSUE - Could Not Find': [] as any[],
    'POTENTIAL ISSUE - Extraction Failure': [] as any[],
    'NEEDS INVESTIGATION - Unclear': [] as any[]
  };
  
  ambiguous.forEach((r: any) => {
    const reasoning = (r.reasoning || '').toLowerCase();
    const url = r.resolution_url.toLowerCase();
    
    // Live data sources
    if (
      url.includes('/trade') || 
      url.includes('coinmarketcap') ||
      url.includes('binance.com/en/trade') ||
      reasoning.includes('current') && reasoning.includes('price') ||
      reasoning.includes('live') ||
      reasoning.includes('real-time')
    ) {
      categories['LEGITIMATE - Live/Current Data Source'].push(r);
    }
    // Generic homepages
    else if (
      reasoning.includes('homepage') ||
      reasoning.includes('general information') ||
      reasoning.includes('does not provide specific') ||
      reasoning.includes('main page') ||
      reasoning.includes('landing page')
    ) {
      categories['LEGITIMATE - Generic/Homepage'].push(r);
    }
    // Historical data not available
    else if (
      reasoning.includes('historical') && reasoning.includes('not') ||
      reasoning.includes('past') && reasoning.includes('not available') ||
      reasoning.includes('no historical data') ||
      reasoning.includes('future') && reasoning.includes('not yet')
    ) {
      categories['LEGITIMATE - Historical Data Not Available'].push(r);
    }
    // Content updated or outdated
    else if (
      reasoning.includes('outdated') ||
      reasoning.includes('updated') && reasoning.includes('after') ||
      reasoning.includes('stale') ||
      reasoning.includes('no longer')
    ) {
      categories['LEGITIMATE - Content Updated/Stale'].push(r);
    }
    // Wrong source type
    else if (
      reasoning.includes('does not contain') ||
      reasoning.includes('no information about') ||
      reasoning.includes('not mentioned') ||
      reasoning.includes('not found on') && !reasoning.includes('could not')
    ) {
      categories['LEGITIMATE - Wrong Source Type'].push(r);
    }
    // Partial/incomplete (potential truncation)
    else if (
      reasoning.includes('only') && (reasoning.includes('first') || reasoning.includes('entries')) ||
      reasoning.includes('partial') ||
      reasoning.includes('incomplete') ||
      reasoning.includes('truncated') ||
      reasoning.includes('limited to')
    ) {
      categories['POTENTIAL ISSUE - Partial/Incomplete'].push(r);
    }
    // Could not find (might be extraction issue)
    else if (
      reasoning.includes('could not find') ||
      reasoning.includes('unable to locate') ||
      reasoning.includes('cannot find') ||
      reasoning.includes('failed to find')
    ) {
      categories['POTENTIAL ISSUE - Could Not Find'].push(r);
    }
    // Possible extraction failure
    else if (
      reasoning.includes('cannot determine') && !reasoning.includes('does not') ||
      reasoning.includes('unclear') && !reasoning.includes('question') ||
      reasoning.includes('ambiguous') && !reasoning.includes('question') ||
      reasoning.includes('not explicitly stated') && reasoning.includes('data')
    ) {
      categories['POTENTIAL ISSUE - Extraction Failure'].push(r);
    }
    // Unclear
    else {
      categories['NEEDS INVESTIGATION - Unclear'].push(r);
    }
  });
  
  console.log('CATEGORIZATION RESULTS:\n');
  
  let legitimateTotal = 0;
  let potentialIssues = 0;
  let needsInvestigation = 0;
  
  Object.entries(categories).forEach(([cat, items]) => {
    console.log(`${cat}: ${items.length}`);
    
    if (cat.startsWith('LEGITIMATE')) {
      legitimateTotal += items.length;
    } else if (cat.startsWith('POTENTIAL ISSUE')) {
      potentialIssues += items.length;
    } else {
      needsInvestigation += items.length;
    }
  });
  
  console.log('\n' + '─'.repeat(80));
  console.log(`\nSUMMARY:`);
  console.log(`  Legitimate: ${legitimateTotal} (${Math.round(legitimateTotal/ambiguous.length*100)}%)`);
  console.log(`  Potential GenLayer Issues: ${potentialIssues} (${Math.round(potentialIssues/ambiguous.length*100)}%)`);
  console.log(`  Needs Investigation: ${needsInvestigation} (${Math.round(needsInvestigation/ambiguous.length*100)}%)`);
  
  console.log('\n═'.repeat(80));
  console.log('\n📋 SAMPLE CASES FROM EACH CATEGORY:\n');
  
  Object.entries(categories).forEach(([cat, items]) => {
    if (items.length > 0) {
      console.log(`\n${cat} (showing first 3):\n`);
      
      items.slice(0, 3).forEach((r: any, i: number) => {
        console.log(`${i + 1}. ${r.question}`);
        console.log(`   URL: ${r.resolution_url}`);
        console.log(`   Reasoning: "${r.reasoning.slice(0, 150)}..."`);
        console.log();
      });
    }
  });
  
  // Export detailed breakdown
  const output = {
    total: ambiguous.length,
    categories: Object.fromEntries(
      Object.entries(categories).map(([cat, items]) => [
        cat,
        {
          count: items.length,
          percentage: Math.round(items.length / ambiguous.length * 100),
          samples: items.slice(0, 5).map((r: any) => ({
            question: r.question,
            url: r.resolution_url,
            reasoning: r.reasoning
          }))
        }
      ])
    ),
    summary: {
      legitimate: legitimateTotal,
      potential_issues: potentialIssues,
      needs_investigation: needsInvestigation,
      legitimate_percentage: Math.round(legitimateTotal/ambiguous.length*100),
      potential_issues_percentage: Math.round(potentialIssues/ambiguous.length*100),
      needs_investigation_percentage: Math.round(needsInvestigation/ambiguous.length*100)
    }
  };
  
  writeFileSync('ambiguous_detailed_analysis.json', JSON.stringify(output, null, 2));
  
  console.log('\n═'.repeat(80));
  console.log('\n✅ Detailed analysis saved to ambiguous_detailed_analysis.json\n');
  
  console.log('VERDICT:\n');
  console.log(`If we treat "POTENTIAL ISSUE" cases as GenLayer failures:`);
  console.log(`  - Total resolvable markets would be: 80 + ${potentialIssues} = ${80 + potentialIssues}`);
  console.log(`  - GenLayer would have failed on: ${potentialIssues} markets`);
  console.log(`  - New accuracy: ${Math.round(74/(80+potentialIssues)*100)}% (74 correct out of ${80+potentialIssues})`);
  console.log(`  - Error rate: ${Math.round((6+potentialIssues)/(80+potentialIssues)*100)}% (${6+potentialIssues} wrong/failed out of ${80+potentialIssues})\n`);
}

main().catch(console.error);

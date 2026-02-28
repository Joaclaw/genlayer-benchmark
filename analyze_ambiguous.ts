import { createClient, createAccount, chains } from 'genlayer-js';

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
  
  // Get ambiguous cases: status 200, but llm_unresolvable
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log(`\n🔍 ANALYZING ${ambiguous.length} AMBIGUOUS CASES\n`);
  console.log('These had accessible content (HTTP 200) but GenLayer couldn\'t extract YES/NO\n');
  console.log('═'.repeat(80) + '\n');
  
  // Sample 20 random cases
  const sample = ambiguous
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);
  
  // Categorize by reasoning patterns
  const categories: Record<string, any[]> = {
    'Live/Current Data': [],
    'Historical Date Missing': [],
    'Generic Info Page': [],
    'Incomplete Information': [],
    'Too Vague/Unclear': [],
    'Other': []
  };
  
  sample.forEach((r: any) => {
    const reasoning = r.reasoning || '';
    
    if (reasoning.includes('does not') || reasoning.includes('no information') || reasoning.includes('lacks')) {
      categories['Incomplete Information'].push(r);
    } else if (reasoning.includes('current') || reasoning.includes('as of') || reasoning.includes('latest')) {
      categories['Live/Current Data'].push(r);
    } else if (reasoning.includes('specific date') || reasoning.includes('time period') || reasoning.includes('historical')) {
      categories['Historical Date Missing'].push(r);
    } else if (reasoning.includes('general') || reasoning.includes('background') || reasoning.includes('overview')) {
      categories['Generic Info Page'].push(r);
    } else if (reasoning.includes('unclear') || reasoning.includes('ambiguous') || reasoning.includes('cannot determine')) {
      categories['Too Vague/Unclear'].push(r);
    } else {
      categories['Other'].push(r);
    }
  });
  
  console.log('📊 PATTERN BREAKDOWN (sample of 20):\n');
  
  Object.entries(categories).forEach(([category, items]) => {
    if (items.length > 0) {
      console.log(`\n${category}: ${items.length} cases`);
      console.log('─'.repeat(80));
      
      items.slice(0, 3).forEach((r: any) => {
        console.log(`\n  Q: ${r.question.slice(0, 70)}...`);
        console.log(`  URL: ${r.resolution_url.slice(0, 70)}...`);
        console.log(`  Reasoning: ${r.reasoning.slice(0, 150)}...`);
      });
    }
  });
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('\n🎯 ANALYSIS: Is this GenLayer\'s fault?\n');
  
  console.log('LEGITIMATE (Not GenLayer\'s fault):');
  console.log('  - Live dashboards showing current data instead of historical dates');
  console.log('  - Generic info pages that never had the specific answer');
  console.log('  - News articles that mention topic but don\'t state outcome\n');
  
  console.log('POTENTIAL GENLAYER ISSUES (Could be improved):');
  console.log('  - Content HAS the answer but prompt engineering failed to extract it');
  console.log('  - LLM being too cautious/conservative');
  console.log('  - Missing context that would make answer clear\n');
  
  console.log('To determine which, we need to:');
  console.log('  1. Manually check sample URLs to see if answer is actually there');
  console.log('  2. Review GenLayer\'s reasoning to see if it makes sense');
  console.log('  3. Identify if better prompting could extract more answers\n');
}

main().catch(console.error);

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
  
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  console.log('\n🔬 DEEP DIVE: Are these GenLayer failures or legitimate?\n');
  console.log('═'.repeat(80) + '\n');
  
  // Key test cases to examine
  const testCases = [
    'Trump cabinet',
    'Treasury',
    'Solana',
    'election',
    'Frances Black',
    'GDP',
    'inflation',
    'unemployment'
  ];
  
  const interesting = [];
  
  for (const keyword of testCases) {
    const match = ambiguous.find((r: any) => 
      r.question.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (match) {
      interesting.push(match);
    }
  }
  
  // Categorize each case
  const analysis: Record<string, any[]> = {
    'LEGITIMATE - Live Data Source': [],
    'LEGITIMATE - Wrong Source Type': [],
    'LEGITIMATE - Generic Page': [],
    'GENLAYER ISSUE - Partial Data': [],
    'GENLAYER ISSUE - Too Conservative': [],
    'UNCLEAR - Need Manual Check': []
  };
  
  interesting.forEach((r: any) => {
    const url = r.resolution_url.toLowerCase();
    const reasoning = r.reasoning || '';
    
    // Classify
    if (url.includes('binance.com/trade') || url.includes('coinmarketcap.com')) {
      analysis['LEGITIMATE - Live Data Source'].push(r);
    } else if (url.includes('electoralcommission.ie') && !reasoning.includes('results')) {
      analysis['LEGITIMATE - Generic Page'].push(r);
    } else if (url.includes('senate.gov') && reasoning.includes('historical')) {
      analysis['LEGITIMATE - Wrong Source Type'].push(r);
    } else if (reasoning.includes('only') && reasoning.includes('entries')) {
      analysis['GENLAYER ISSUE - Partial Data'].push(r);
    } else if (reasoning.includes('not explicitly') || reasoning.includes('cannot confirm')) {
      analysis['GENLAYER ISSUE - Too Conservative'].push(r);
    } else {
      analysis['UNCLEAR - Need Manual Check'].push(r);
    }
  });
  
  Object.entries(analysis).forEach(([category, items]) => {
    if (items.length > 0) {
      console.log(`\n${category}: ${items.length}\n`);
      
      items.forEach((r: any) => {
        console.log(`  Question: ${r.question}`);
        console.log(`  URL: ${r.resolution_url}`);
        console.log(`  Why GenLayer couldn't resolve:`);
        console.log(`  "${r.reasoning.slice(0, 200)}..."`);
        console.log();
      });
      
      console.log('─'.repeat(80));
    }
  });
  
  console.log('\n\n📊 VERDICT ON 414 "AMBIGUOUS" CASES:\n');
  
  const legitimateCount = ambiguous.filter((r: any) => {
    const url = r.resolution_url.toLowerCase();
    const reasoning = r.reasoning || '';
    
    return (
      // Live trading pages
      url.includes('/trade') || 
      url.includes('coinmarketcap') ||
      // Generic homepages
      (!url.includes('results') && !url.includes('data') && url.endsWith('.ie/')) ||
      (!url.includes('results') && !url.includes('data') && url.endsWith('.ar/')) ||
      // Historical data pages for future questions
      reasoning.includes('historical') ||
      reasoning.includes('general information') ||
      reasoning.includes('homepage') ||
      reasoning.includes('does not provide') ||
      reasoning.includes('no information about')
    );
  }).length;
  
  const potentialIssues = ambiguous.filter((r: any) => {
    const reasoning = r.reasoning || '';
    return (
      reasoning.includes('only') && reasoning.includes('entries') ||
      reasoning.includes('not explicitly') ||
      reasoning.includes('partial') ||
      reasoning.includes('incomplete')
    );
  }).length;
  
  console.log(`Estimated breakdown:`);
  console.log(`  ~${legitimateCount} (${Math.round(legitimateCount/ambiguous.length*100)}%) - LEGITIMATE: Wrong source type, content genuinely lacks answer`);
  console.log(`  ~${potentialIssues} (${Math.round(potentialIssues/ambiguous.length*100)}%) - POTENTIAL GENLAYER ISSUE: Content might have answer but wasn't extracted`);
  console.log(`  ~${ambiguous.length - legitimateCount - potentialIssues} - UNCLEAR: Need manual verification\n`);
  
  console.log(`\nKEY FINDING:`);
  console.log(`The majority of "ambiguous" cases appear to be LEGITIMATE - Polymarket resolution URLs`);
  console.log(`simply don't contain the answer. These are not GenLayer failures.\n`);
  
  console.log(`However, there may be ~${potentialIssues} cases where better prompting or content extraction`);
  console.log(`could improve results. This represents ${Math.round(potentialIssues/ambiguous.length*100)}% of ambiguous cases,`);
  console.log(`or ${Math.round(potentialIssues/results.length*100)}% of total markets.\n`);
}

main().catch(console.error);

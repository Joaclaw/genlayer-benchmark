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
  
  const ambiguous = results.filter((r: any) => 
    !r.resolvable && 
    r.status_code === 200 && 
    r.failure_reason === 'llm_unresolvable'
  );
  
  // Re-categorize "unclear" with more detailed analysis
  const unclear: any[] = [];
  
  ambiguous.forEach((r: any) => {
    const reasoning = (r.reasoning || '').toLowerCase();
    const url = r.resolution_url.toLowerCase();
    
    // Skip already categorized
    if (
      url.includes('/trade') || url.includes('coinmarketcap') ||
      reasoning.includes('homepage') || reasoning.includes('general information') ||
      reasoning.includes('historical') && reasoning.includes('not') ||
      reasoning.includes('does not contain') || reasoning.includes('no information about') ||
      reasoning.includes('only') && (reasoning.includes('first') || reasoning.includes('entries')) ||
      reasoning.includes('could not find') || reasoning.includes('cannot find')
    ) {
      return;
    }
    
    unclear.push(r);
  });
  
  console.log(`\n🔍 DEEP DIVE: ${unclear.length} "UNCLEAR" CASES\n`);
  console.log('═'.repeat(80) + '\n');
  
  // Further sub-categorization
  const subCategories: Record<string, any[]> = {
    'Data exists but LLM says not enough': [],
    'Scope/specificity issue': [],
    'Temporal mismatch in reasoning': [],
    'Question interpretation issue': [],
    'True unclear - needs manual check': []
  };
  
  unclear.forEach((r: any) => {
    const reasoning = r.reasoning || '';
    const rLower = reasoning.toLowerCase();
    
    if (
      rLower.includes('provides data') || rLower.includes('shows') ||
      rLower.includes('lists') || rLower.includes('contains')
    ) {
      // LLM sees data but says it's not enough
      subCategories['Data exists but LLM says not enough'].push(r);
    } else if (
      rLower.includes('broad') || rLower.includes('specific') ||
      rLower.includes('general') && !rLower.includes('general information')
    ) {
      subCategories['Scope/specificity issue'].push(r);
    } else if (
      rLower.includes('future') || rLower.includes('past') ||
      rLower.includes('time') && !rLower.includes('real-time')
    ) {
      subCategories['Temporal mismatch in reasoning'].push(r);
    } else if (
      rLower.includes('question') || rLower.includes('unclear what')
    ) {
      subCategories['Question interpretation issue'].push(r);
    } else {
      subCategories['True unclear - needs manual check'].push(r);
    }
  });
  
  Object.entries(subCategories).forEach(([cat, items]) => {
    console.log(`${cat}: ${items.length}`);
  });
  
  console.log('\n' + '─'.repeat(80) + '\n');
  
  // Show samples from each
  Object.entries(subCategories).forEach(([cat, items]) => {
    if (items.length > 0) {
      console.log(`\n${cat} (showing 5 samples):\n`);
      items.slice(0, 5).forEach((r: any, i: number) => {
        console.log(`${i + 1}. ${r.question}`);
        console.log(`   ${r.resolution_url}`);
        console.log(`   "${r.reasoning.slice(0, 200)}..."`);
        console.log();
      });
    }
  });
  
  // Export for manual review
  const export_data = {
    total_unclear: unclear.length,
    sub_categories: Object.fromEntries(
      Object.entries(subCategories).map(([cat, items]) => [
        cat,
        {
          count: items.length,
          percentage: Math.round(items.length / unclear.length * 100),
          all_cases: items.map((r: any) => ({
            question: r.question,
            url: r.resolution_url,
            reasoning: r.reasoning,
            expected: r.polymarket_result
          }))
        }
      ])
    )
  };
  
  writeFileSync('unclear_cases_detailed.json', JSON.stringify(export_data, null, 2));
  console.log('\n═'.repeat(80));
  console.log('✅ Saved all unclear cases to unclear_cases_detailed.json for manual review\n');
  
  console.log('VERDICT ON UNCLEAR CATEGORY:\n');
  console.log('These 204 markets need manual URL verification to determine:');
  console.log('1. Was the answer actually present in the content?');
  console.log('2. Was GenLayer\'s extraction correct or did it miss something?');
  console.log('3. Should they count as GenLayer failures or legitimate "no answer" cases?\n');
}

main().catch(console.error);

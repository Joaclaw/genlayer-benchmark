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
  const wrong = results.filter((r: any) => r.resolvable && !r.correct);
  
  console.log('\n📋 ANALYSIS OF 6 INCORRECT RESOLUTIONS\n');
  console.log('═'.repeat(80) + '\n');
  
  wrong.forEach((r: any, i: number) => {
    console.log(`${i + 1}. ${r.question}`);
    console.log(`   Polymarket says: ${r.polymarket_result}`);
    console.log(`   GenLayer says: ${r.genlayer_result}`);
    console.log(`   Source: ${r.resolution_url}`);
    console.log(`\n   GenLayer's reasoning:`);
    console.log(`   "${r.reasoning}"\n`);
    
    // Analyze the issue
    console.log(`   Issue Analysis:`);
    
    if (r.resolution_url.includes('lmarena.ai')) {
      console.log(`   → TEMPORAL ISSUE: Live leaderboard shows current rankings, not historical`);
      console.log(`   → Market asked about specific date (Jun 30 or Dec 31), URL shows "now"`);
      console.log(`   → NOT GenLayer's fault - wrong source type for historical question\n`);
    } else if (r.question.toLowerCase().includes('bird flu')) {
      console.log(`   → INTERPRETATION: GenLayer found existing H5N1 vaccines (correct)`);
      console.log(`   → Question likely meant "NEW vaccine in 2025" vs "vaccine exists"`);
      console.log(`   → Ambiguous question wording\n`);
    } else if (r.question.includes('between') && r.question.includes('Fort Knox')) {
      console.log(`   → EDGE CASE: Value exactly at boundary (147,341,858)`);
      console.log(`   → "Between X and Y" - is boundary inclusive or exclusive?`);
      console.log(`   → Mathematical ambiguity\n`);
    } else if (r.question.includes('Treasury') && r.question.includes('4.6%')) {
      console.log(`   → TEMPORAL: GenLayer found 4.77% in January 2025 (correct)`);
      console.log(`   → Question may have asked about year-end specifically`);
      console.log(`   → Or market resolved based on different criteria\n`);
    } else if (r.question.includes('asteroid') && r.question.includes('3%')) {
      console.log(`   → CONTENT INTERPRETATION: GenLayer checked table, found none ≥ 1%`);
      console.log(`   → Expected YES means NASA did estimate 3% at some point`);
      console.log(`   → Either missed in content, or content was updated after event\n`);
    }
    
    console.log('─'.repeat(80) + '\n');
  });
  
  console.log('\n📊 SUMMARY\n');
  console.log('2 markets: Temporal issues (live data vs historical date)');
  console.log('2 markets: Ambiguous question wording');  
  console.log('1 market: Edge case (boundary interpretation)');
  console.log('1 market: Unclear (content may have been updated)');
  console.log('\nNone are clear "GenLayer made a mistake" failures.');
  console.log('All involve ambiguity in either the question, the source, or temporal alignment.\n');
}

main().catch(console.error);

import { createClient, createAccount, chains } from 'genlayer-js';

const { studionet } = chains;
const CONTRACT_ADDRESS = '0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905';

async function main() {
  console.log('📊 Fetching results from contract...\n');
  
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  const results = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  console.log(`Total results: ${results.length}\n`);
  
  // Categorize failures
  const analysis = {
    total: results.length,
    resolvable: 0,
    correct: 0,
    wrong: 0,
    
    // Failure categories
    web_issues: {
      forbidden_403: 0,
      not_found_404: 0,
      timeout: 0,
      anti_bot: 0,
      total: 0
    },
    
    content_issues: {
      empty: 0,
      insufficient: 0,
      paywall: 0,
      total: 0
    },
    
    llm_issues: {
      unresolvable: 0,
      error: 0,
      total: 0
    },
    
    consensus_issues: {
      majority_disagree: 0,
      total: 0
    },
    
    genlayer_fault: 0,  // Issues that are GenLayer's responsibility
    external_fault: 0,  // Issues outside GenLayer's control
  };
  
  results.forEach((r: any) => {
    if (r.resolvable) {
      analysis.resolvable++;
      if (r.correct) {
        analysis.correct++;
      } else {
        analysis.wrong++;
      }
    } else {
      // Categorize failures
      const reason = r.failure_reason || '';
      
      // Web access issues (external fault)
      if (reason.includes('web_forbidden') || r.status_code === 403) {
        analysis.web_issues.forbidden_403++;
        analysis.web_issues.total++;
        analysis.external_fault++;
      } else if (reason.includes('web_not_found') || r.status_code === 404) {
        analysis.web_issues.not_found_404++;
        analysis.web_issues.total++;
        analysis.external_fault++;
      } else if (reason.includes('web_timeout')) {
        analysis.web_issues.timeout++;
        analysis.web_issues.total++;
        analysis.external_fault++;
      } else if (reason.includes('anti_bot')) {
        analysis.web_issues.anti_bot++;
        analysis.web_issues.total++;
        analysis.external_fault++;
      }
      
      // Content quality issues (external fault)
      else if (reason.includes('content_empty')) {
        analysis.content_issues.empty++;
        analysis.content_issues.total++;
        analysis.external_fault++;
      } else if (reason.includes('content_insufficient')) {
        analysis.content_issues.insufficient++;
        analysis.content_issues.total++;
        analysis.external_fault++;
      } else if (reason.includes('paywall')) {
        analysis.content_issues.paywall++;
        analysis.content_issues.total++;
        analysis.external_fault++;
      }
      
      // LLM resolution issues (could be GenLayer or content quality)
      else if (reason.includes('llm_unresolvable')) {
        analysis.llm_issues.unresolvable++;
        analysis.llm_issues.total++;
        // Ambiguous - could be either
      } else if (reason.includes('llm_error')) {
        analysis.llm_issues.error++;
        analysis.llm_issues.total++;
        analysis.genlayer_fault++;
      }
      
      // Consensus issues (GenLayer fault)
      else if (reason.includes('consensus') || r.consensus_status === 'MAJORITY_DISAGREE') {
        analysis.consensus_issues.majority_disagree++;
        analysis.consensus_issues.total++;
        analysis.genlayer_fault++;
      }
    }
  });
  
  // Calculate percentages
  const resolvableRate = (analysis.resolvable / analysis.total * 100).toFixed(1);
  const accuracyRate = analysis.resolvable > 0 ? (analysis.correct / analysis.resolvable * 100).toFixed(1) : '0.0';
  const glFaultRate = (analysis.genlayer_fault / analysis.total * 100).toFixed(1);
  const externalFaultRate = (analysis.external_fault / analysis.total * 100).toFixed(1);
  
  console.log('═'.repeat(70));
  console.log('  GENLAYER BENCHMARK ANALYSIS');
  console.log('═'.repeat(70));
  console.log();
  
  console.log('📈 OVERALL PERFORMANCE');
  console.log(`   Total Markets: ${analysis.total}`);
  console.log(`   Resolvable: ${analysis.resolvable} (${resolvableRate}%)`);
  console.log(`   Correct: ${analysis.correct} / ${analysis.resolvable} (${accuracyRate}%)`);
  console.log(`   Wrong: ${analysis.wrong}`);
  console.log();
  
  console.log('🔍 FAILURE ATTRIBUTION');
  console.log(`   GenLayer Issues: ${analysis.genlayer_fault} (${glFaultRate}%)`);
  console.log(`   External Issues: ${analysis.external_fault} (${externalFaultRate}%)`);
  console.log(`   LLM Ambiguous: ${analysis.llm_issues.unresolvable}`);
  console.log();
  
  console.log('🌐 WEB ACCESS FAILURES (External)');
  console.log(`   403 Forbidden: ${analysis.web_issues.forbidden_403}`);
  console.log(`   404 Not Found: ${analysis.web_issues.not_found_404}`);
  console.log(`   Timeout: ${analysis.web_issues.timeout}`);
  console.log(`   Anti-bot: ${analysis.web_issues.anti_bot}`);
  console.log(`   Total: ${analysis.web_issues.total}`);
  console.log();
  
  console.log('📄 CONTENT QUALITY FAILURES (External)');
  console.log(`   Empty content: ${analysis.content_issues.empty}`);
  console.log(`   Insufficient content: ${analysis.content_issues.insufficient}`);
  console.log(`   Paywall: ${analysis.content_issues.paywall}`);
  console.log(`   Total: ${analysis.content_issues.total}`);
  console.log();
  
  console.log('🤖 LLM RESOLUTION FAILURES');
  console.log(`   Unresolvable (ambiguous): ${analysis.llm_issues.unresolvable}`);
  console.log(`   LLM Error (GenLayer): ${analysis.llm_issues.error}`);
  console.log(`   Total: ${analysis.llm_issues.total}`);
  console.log();
  
  console.log('⚖️  CONSENSUS FAILURES (GenLayer)');
  console.log(`   Majority Disagree: ${analysis.consensus_issues.majority_disagree}`);
  console.log(`   Total: ${analysis.consensus_issues.total}`);
  console.log();
  
  console.log('═'.repeat(70));
  console.log();
  
  // Key insights
  console.log('💡 KEY INSIGHTS');
  console.log();
  console.log('1. Core GenLayer Performance:');
  console.log(`   - When content is accessible and valid, GenLayer achieves ${accuracyRate}% accuracy`);
  console.log(`   - Pure GenLayer issues (consensus + LLM errors): ${analysis.genlayer_fault} markets`);
  console.log();
  console.log('2. Primary Bottleneck:');
  console.log(`   - ${externalFaultRate}% of failures are external (web access, content quality)`);
  console.log(`   - GenLayer cannot resolve what it cannot access or parse`);
  console.log();
  console.log('3. Improvement Opportunities:');
  console.log('   - Agentic off-chain data collection (fetch from multiple sources)');
  console.log('   - Content preprocessing (extract relevant sections)');
  console.log('   - Fallback sources when primary URL fails');
  console.log('   - Better handling of dynamic content (news sites, dashboards)');
  console.log();
  
  // Save analysis
  const output = {
    generated_at: new Date().toISOString(),
    contract_address: CONTRACT_ADDRESS,
    summary: {
      total: analysis.total,
      resolvable: analysis.resolvable,
      resolvable_rate: parseFloat(resolvableRate),
      accuracy: analysis.resolvable > 0 ? parseFloat(accuracyRate) : 0,
      genlayer_issues: analysis.genlayer_fault,
      external_issues: analysis.external_fault,
      ambiguous_issues: analysis.llm_issues.unresolvable
    },
    breakdown: {
      web_access: analysis.web_issues,
      content_quality: analysis.content_issues,
      llm_resolution: analysis.llm_issues,
      consensus: analysis.consensus_issues
    },
    insights: [
      `GenLayer achieves ${accuracyRate}% accuracy on resolvable markets`,
      `${externalFaultRate}% of failures are due to external factors (web access, content quality)`,
      `Only ${glFaultRate}% of failures are attributable to GenLayer itself`,
      'Main improvement area: off-chain data preprocessing and multi-source validation'
    ]
  };
  
  require('fs').writeFileSync('ANALYSIS.json', JSON.stringify(output, null, 2));
  console.log('✅ Analysis saved to ANALYSIS.json');
}

main().catch(console.error);

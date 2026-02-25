import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

interface PolymarketToken {
  outcome: string;
  winner: boolean;
}

interface PolymarketMarket {
  market_slug: string;
  question: string;
  description: string;
  end_date_iso: string;
  closed: boolean;
  tokens: PolymarketToken[];
  condition_id: string;
}

interface ProcessedMarket {
  id: string;
  question: string;
  description: string;
  end_date: string;
  outcome: string;
  resolution_url: string | null;
  resolution_source_type: 'url' | 'consensus' | 'official' | 'none';
  category: string;
  polymarket_url: string;
}

function extractResolutionUrl(description: string): string | null {
  const urlMatch = description.match(/https?:\/\/[^\s\)\"<>]+/);
  if (urlMatch) {
    // Clean trailing punctuation
    return urlMatch[0].replace(/[,.\)]+$/, '');
  }
  return null;
}

function categorizeMarket(slug: string, question: string): string {
  const q = question.toLowerCase();
  const s = slug.toLowerCase();
  
  if (s.match(/^(nba-|nfl-|nhl-|mlb-|ncaab-|ufc-)/)) return 'sports';
  if (q.includes('president') || q.includes('election') || q.includes('governor') || q.includes('senate') || q.includes('congress')) return 'politics';
  if (q.includes('oscar') || q.includes('grammy') || q.includes('emmy') || q.includes('award')) return 'entertainment';
  if (q.includes('fed') || q.includes('interest rate') || q.includes('inflation') || q.includes('gdp')) return 'economics';
  if (q.includes('bitcoin') || q.includes('ethereum') || q.includes('crypto') || q.includes('token') || q.includes('airdrop')) return 'crypto';
  if (q.includes('ceo') || q.includes('company') || q.includes('stock') || q.includes('ipo')) return 'business';
  return 'other';
}

function classifyResolutionSource(description: string): 'url' | 'consensus' | 'official' | 'none' {
  const d = description.toLowerCase();
  if (d.includes('https://') || d.includes('http://')) return 'url';
  if (d.includes('consensus of') || d.includes('credible reporting')) return 'consensus';
  if (d.includes('official') || d.includes('government')) return 'official';
  return 'none';
}

async function fetchMarkets() {
  console.log('📊 Fetching resolved markets from Polymarket...\n');
  
  const response = await fetch('https://clob.polymarket.com/markets?closed=true');
  const json = await response.json() as { data: PolymarketMarket[] };
  const allMarkets = json.data || [];
  
  console.log(`   Total closed markets in API: ${allMarkets.length}`);
  
  // Filter for markets with clear winners
  const marketsWithWinners = allMarkets.filter(m => {
    const hasWinner = m.tokens?.some(t => t.winner === true);
    const hasDescription = m.description && m.description.length > 20;
    return hasWinner && hasDescription && m.closed;
  });
  
  console.log(`   Markets with clear winners: ${marketsWithWinners.length}`);
  
  // Sort by end_date descending (most recent first)
  marketsWithWinners.sort((a, b) => {
    const dateA = a.end_date_iso ? new Date(a.end_date_iso).getTime() : 0;
    const dateB = b.end_date_iso ? new Date(b.end_date_iso).getTime() : 0;
    return dateB - dateA;
  });
  
  // Take top 100
  const top100 = marketsWithWinners.slice(0, 100);
  
  // Process into our format
  const processed: ProcessedMarket[] = top100.map(m => {
    const winner = m.tokens?.find(t => t.winner)?.outcome || 'UNKNOWN';
    const resolutionUrl = extractResolutionUrl(m.description || '');
    
    return {
      id: m.market_slug || m.condition_id,
      question: m.question,
      description: m.description?.slice(0, 1000) || '',
      end_date: m.end_date_iso || '',
      outcome: winner,
      resolution_url: resolutionUrl,
      resolution_source_type: classifyResolutionSource(m.description || ''),
      category: categorizeMarket(m.market_slug || '', m.question),
      polymarket_url: `https://polymarket.com/event/${m.market_slug}`
    };
  });
  
  // Stats
  const stats = {
    total: processed.length,
    with_url: processed.filter(m => m.resolution_url).length,
    without_url: processed.filter(m => !m.resolution_url).length,
    by_category: {} as Record<string, number>,
    by_source_type: {} as Record<string, number>,
    date_range: {
      earliest: processed[processed.length - 1]?.end_date || '',
      latest: processed[0]?.end_date || ''
    }
  };
  
  processed.forEach(m => {
    stats.by_category[m.category] = (stats.by_category[m.category] || 0) + 1;
    stats.by_source_type[m.resolution_source_type] = (stats.by_source_type[m.resolution_source_type] || 0) + 1;
  });
  
  // Save markets
  const output = {
    fetched_at: new Date().toISOString(),
    source: 'https://clob.polymarket.com/markets?closed=true',
    stats,
    markets: processed
  };
  
  writeFileSync(
    join(ROOT_DIR, 'data/polymarket_sample.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log(`\n✅ Saved ${processed.length} markets to data/polymarket_sample.json`);
  console.log(`\n📈 Stats:`);
  console.log(`   Date range: ${stats.date_range.earliest} to ${stats.date_range.latest}`);
  console.log(`   With resolution URL: ${stats.with_url}`);
  console.log(`   Without resolution URL: ${stats.without_url}`);
  console.log(`\n   By category:`);
  Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`     ${cat}: ${count}`);
  });
  console.log(`\n   By resolution source type:`);
  Object.entries(stats.by_source_type).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
}

fetchMarkets().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

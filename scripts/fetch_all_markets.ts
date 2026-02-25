import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

interface Market {
  market_slug: string;
  question: string;
  description: string;
  end_date_iso: string;
  tokens: Array<{outcome: string; winner: boolean}>;
}

async function fetchAllClosedMarkets(): Promise<Market[]> {
  console.log('🔄 Fetching ALL closed markets from Polymarket CLOB API...\n');
  
  const allMarkets: Market[] = [];
  let nextCursor: string | null = null;
  let page = 0;
  
  do {
    const url = nextCursor
      ? `https://clob.polymarket.com/markets?closed=true&next_cursor=${nextCursor}`
      : 'https://clob.polymarket.com/markets?closed=true';
    
    console.log(`   Fetching page ${page + 1}...`);
    
    const response = await fetch(url);
    const json = await response.json() as any;
    
    if (json.data && Array.isArray(json.data)) {
      allMarkets.push(...json.data);
      console.log(`   Got ${json.data.length} markets (total: ${allMarkets.length})`);
    }
    
    nextCursor = json.next_cursor;
    page++;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
    
  } while (nextCursor && page < 50); // Cap at 50 pages = ~50k markets
  
  console.log(`\n✅ Fetched ${allMarkets.length} total closed markets\n`);
  return allMarkets;
}

function extractResolutionUrl(description: string): string | null {
  const urlMatch = description.match(/https?:\/\/[^\s\)\"<>]+/);
  if (urlMatch) {
    return urlMatch[0].replace(/[,.\)]+$/, '');
  }
  return null;
}

function categorizeMarket(slug: string, question: string): string {
  const q = question.toLowerCase();
  const s = slug.toLowerCase();
  
  if (s.match(/^(nba-|nfl-|nhl-|mlb-|ncaab-|ufc-)/)) return 'sports';
  if (q.includes('president') || q.includes('election') || q.includes('governor') || q.includes('senate')) return 'politics';
  if (q.includes('oscar') || q.includes('grammy') || q.includes('emmy')) return 'entertainment';
  if (q.includes('fed') || q.includes('interest rate') || q.includes('inflation')) return 'economics';
  if (q.includes('bitcoin') || q.includes('ethereum') || q.includes('crypto') || q.includes('token')) return 'crypto';
  if (q.includes('ceo') || q.includes('company') || q.includes('stock')) return 'business';
  return 'other';
}

async function main() {
  // Fetch all markets
  const allMarkets = await fetchAllClosedMarkets();
  
  // Filter for markets with winners, resolution URLs, and ACTUALLY RESOLVED (end_date in past)
  const now = new Date();
  const marketsWithWinners = allMarkets.filter(m => {
    const hasWinner = m.tokens?.some(t => t.winner === true);
    const hasDescription = m.description && m.description.length > 50;
    const endDate = m.end_date_iso ? new Date(m.end_date_iso) : null;
    const isPast = endDate ? endDate < now : false;
    return hasWinner && hasDescription && isPast;
  });
  
  console.log(`📊 Markets with clear winners: ${marketsWithWinners.length}`);
  
  // Extract resolution URLs
  const processed = marketsWithWinners.map(m => {
    const winner = m.tokens?.find(t => t.winner)?.outcome || 'UNKNOWN';
    const resolutionUrl = extractResolutionUrl(m.description || '');
    
    return {
      id: m.market_slug,
      question: m.question,
      description: (m.description || '').slice(0, 1000),
      end_date: m.end_date_iso || '',
      outcome: winner,
      resolution_url: resolutionUrl,
      category: categorizeMarket(m.market_slug || '', m.question),
      polymarket_url: `https://polymarket.com/event/${m.market_slug}`
    };
  });
  
  // Filter for those with URLs
  const withUrls = processed.filter(m => m.resolution_url);
  const withoutUrls = processed.filter(m => !m.resolution_url);
  
  console.log(`📎 With resolution URL: ${withUrls.length}`);
  console.log(`❌ Without URL: ${withoutUrls.length}`);
  
  // PRIORITY: Get markets with URLs first, sorted by date
  const withUrlsSorted = withUrls.sort((a, b) => {
    const dateA = a.end_date ? new Date(a.end_date).getTime() : 0;
    const dateB = b.end_date ? new Date(b.end_date).getTime() : 0;
    return dateB - dateA;
  });
  
  // Take top 2000 WITH URLs
  const top2000 = withUrlsSorted.slice(0, 2000);
  const top2000WithUrls = top2000;
  
  console.log(`\n📦 Taking top 2000 markets:`);
  console.log(`   With URLs: ${top2000WithUrls.length}`);
  console.log(`   Without URLs: ${2000 - top2000WithUrls.length}`);
  
  // Stats
  const stats = {
    total: top2000.length,
    with_url: top2000WithUrls.length,
    without_url: 2000 - top2000WithUrls.length,
    by_category: {} as Record<string, number>,
    date_range: {
      earliest: top2000[top2000.length - 1]?.end_date || '',
      latest: top2000[0]?.end_date || ''
    }
  };
  
  top2000.forEach(m => {
    stats.by_category[m.category] = (stats.by_category[m.category] || 0) + 1;
  });
  
  // Save
  const output = {
    fetched_at: new Date().toISOString(),
    source: 'https://clob.polymarket.com/markets?closed=true (paginated)',
    stats,
    markets: top2000
  };
  
  writeFileSync(
    join(ROOT_DIR, 'data/polymarket_2000_sample.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log(`\n✅ Saved to data/polymarket_2000_sample.json`);
  console.log(`\nDate range: ${stats.date_range.earliest} to ${stats.date_range.latest}`);
  console.log(`\nBy category:`);
  Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

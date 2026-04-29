import { NextResponse } from 'next/server';
import Exa from 'exa-js';

const EXA_API_KEY = process.env.EXA_API_KEY;

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Extract key entities and terms from a prediction market question
function extractSearchTerms(question: string): {
  entities: string[];
  keyTerms: string[];
  cleanQuestion: string;
} {
  // Remove common prediction market phrasing
  let clean = question
    .replace(/^will\s+/i, '')
    .replace(/\?$/g, '')
    .replace(/\s+be\s+(the\s+)?/i, ' ')
    .replace(/\s+this\s+week/i, '')
    .replace(/\s+today/i, '')
    .replace(/\s+by\s+.+$/i, '');

  // Extract quoted terms (often important entities)
  const quotedTerms: string[] = [];
  const quoteMatches = question.match(/"([^"]+)"/g);
  if (quoteMatches) {
    quotedTerms.push(...quoteMatches.map(m => m.replace(/"/g, '')));
  }

  // Extract capitalized phrases (proper nouns)
  const properNouns = question.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];

  // Common terms that indicate what kind of answer we need
  const keyTerms: string[] = [];
  if (question.toLowerCase().includes('#1') || question.toLowerCase().includes('top')) {
    keyTerms.push('top', 'number one', '#1', 'first place');
  }
  if (question.toLowerCase().includes('#2')) {
    keyTerms.push('second place', '#2', 'number two', 'runner up');
  }
  if (question.toLowerCase().includes('win')) {
    keyTerms.push('won', 'winner', 'victory');
  }
  if (question.toLowerCase().includes('attend')) {
    keyTerms.push('attended', 'appeared', 'present', 'showed up');
  }
  if (question.toLowerCase().includes('announce')) {
    keyTerms.push('announced', 'confirmed', 'revealed');
  }

  return {
    entities: [...new Set([...quotedTerms, ...properNouns])],
    keyTerms,
    cleanQuestion: clean.trim(),
  };
}

// Build multiple search queries for better coverage
function buildSearchQueries(
  question: string,
  outcome: string,
  description?: string
): string[] {
  const { entities, keyTerms, cleanQuestion } = extractSearchTerms(question);
  const outcomeWord = outcome === 'Yes' ? 'yes' : 'no';

  const queries: string[] = [];

  // Strategy 1: Direct question with outcome
  queries.push(`${cleanQuestion} ${outcomeWord}`);

  // Strategy 2: Entity-focused search
  if (entities.length > 0) {
    const entityStr = entities.slice(0, 2).join(' ');
    queries.push(`${entityStr} ${keyTerms[0] || ''} news`);
  }

  // Strategy 3: Full question for semantic search
  queries.push(question);

  // Strategy 4: Use description keywords if available
  if (description) {
    const descWords = description.split(' ').slice(0, 10).join(' ');
    queries.push(`${entities[0] || cleanQuestion} ${descWords}`);
  }

  return queries.filter(q => q.trim().length > 0);
}

export async function POST(request: Request) {
  if (!EXA_API_KEY) {
    return NextResponse.json(
      { error: 'EXA_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const { market_id, question, outcome, description, endDate, excludeDomains, numResults } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const exa = new Exa(EXA_API_KEY);
    // Always exclude Polymarket and prediction market sites - we need external sources
    const defaultExcludes = [
      'polymarket.com',       // Covers all subdomains like worldcoin.polymarket.com
      'predictit.org',
      'metaculus.com',
      'manifold.markets',
      'kalshi.com',
      'augur.net',
      'betfair.com',
    ];
    const excludeList = [...defaultExcludes, ...(excludeDomains || [])];
    const queries = buildSearchQueries(question, outcome, description);

    console.log('[Discover] Question:', question);
    console.log('[Discover] Queries to try:', queries);

    // Calculate date range - search from 2 weeks before end date to now
    let startDate: string | undefined;
    if (endDate) {
      const end = new Date(endDate);
      const start = new Date(end);
      start.setDate(start.getDate() - 14);
      startDate = start.toISOString();
    }

    const allResults: Array<{
      url: string;
      title: string;
      domain: string;
      relevance_score: number;
      highlight?: string;
    }> = [];

    const seenUrls = new Set<string>();

    // Try multiple search strategies
    for (const query of queries.slice(0, 3)) {
      try {
        // Use searchAndContents to get highlights for better filtering
        const response = await exa.searchAndContents(query, {
          numResults: numResults || 10,
          type: 'auto',
          highlights: {
            numSentences: 3,
            highlightsPerUrl: 1,
          },
          excludeDomains: excludeList.length > 0 ? excludeList : undefined,
          startPublishedDate: startDate,
        });

        if (response.results) {
          for (const item of response.results) {
            if (seenUrls.has(item.url)) continue;

            const domain = extractDomain(item.url);

            // Safety filter: skip any prediction market URLs that slipped through
            if (defaultExcludes.some(ex => domain.includes(ex.replace('www.', '')))) {
              console.log('[Discover] Filtered out prediction market URL:', item.url);
              continue;
            }

            seenUrls.add(item.url);

            const highlight = item.highlights?.[0] || '';

            allResults.push({
              url: item.url,
              title: item.title || '',
              domain,
              relevance_score: item.score || 0,
              highlight,
            });
          }
        }
      } catch (e) {
        console.log('[Discover] Query failed:', query, e);
      }
    }

    if (allResults.length === 0) {
      return NextResponse.json({
        market_id,
        urls: [],
        status: 'no_results',
      });
    }

    // Score and rank results based on relevance signals
    const { entities, keyTerms } = extractSearchTerms(question);
    const scoredResults = allResults.map(r => {
      let score = r.relevance_score;

      // Boost if title contains entities
      for (const entity of entities) {
        if (r.title.toLowerCase().includes(entity.toLowerCase())) {
          score += 0.1;
        }
      }

      // Boost if highlight contains key terms or outcome indicators
      const highlightLower = (r.highlight || '').toLowerCase();
      for (const term of keyTerms) {
        if (highlightLower.includes(term.toLowerCase())) {
          score += 0.05;
        }
      }

      // Boost trusted news domains
      const trustedDomains = ['reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'wsj.com', 'bloomberg.com', 'variety.com', 'deadline.com', 'hollywoodreporter.com'];
      if (trustedDomains.some(d => r.domain.includes(d))) {
        score += 0.1;
      }

      return { ...r, adjustedScore: score };
    });

    // Sort by adjusted score
    scoredResults.sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Diversify by domain
    const seenDomains = new Set<string>(excludeList);
    const diversified: Array<{
      url: string;
      title: string;
      domain: string;
      relevance_score: number;
      highlight?: string;
    }> = [];

    for (const item of scoredResults) {
      if (seenDomains.has(item.domain)) continue;
      seenDomains.add(item.domain);

      diversified.push({
        url: item.url,
        title: item.title,
        domain: item.domain,
        relevance_score: item.adjustedScore,
        highlight: item.highlight,
      });

      if (diversified.length >= 5) break;
    }

    console.log('[Discover] Found', diversified.length, 'diverse URLs');

    return NextResponse.json({
      market_id,
      urls: diversified,
      status: 'success',
      queries_used: queries.slice(0, 3),
    });

  } catch (error) {
    console.error('URL discovery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    );
  }
}

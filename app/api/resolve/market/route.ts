import { NextResponse } from 'next/server';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

interface MarketData {
  id: string;
  question: string;
  description: string;
  outcome: string | null;
  end_date: string;
  resolved: boolean;
  slug: string;
  image?: string;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL is Polymarket
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!urlObj.hostname.includes('polymarket.com')) {
      return NextResponse.json({ error: 'URL must be from polymarket.com' }, { status: 400 });
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts[0] !== 'event' || !pathParts[1]) {
      return NextResponse.json(
        { error: 'Invalid Polymarket URL. Expected: https://polymarket.com/event/...' },
        { status: 400 }
      );
    }

    const eventSlug = pathParts[1];
    const subMarketSlug = pathParts[2] || null;

    // Try Gamma API first
    try {
      const gammaUrl = `${GAMMA_API}/events?slug=${eventSlug}`;
      const gammaRes = await fetch(gammaUrl, {
        cache: 'no-store',
      });
      if (gammaRes.ok) {
        const gammaData = await gammaRes.json();

        if (gammaData && gammaData.length > 0) {
          const event = gammaData[0];

          if (event.markets && event.markets.length > 0) {
            // Filter out placeholder "Person X" markets that Polymarket pre-creates
            // These can be "Person A", "Person Z", "Person AA", "Person BG", etc.
            const realMarkets = event.markets.filter((m: any) => {
              const question = m.question || '';
              const groupTitle = m.groupItemTitle || '';
              // Filter out "Person X", "Person AA", "Person BG", etc. placeholders
              const isPlaceholder = /\bPerson [A-Z]{1,2}\b/.test(question) || /\bPerson [A-Z]{1,2}\b/.test(groupTitle);
              return !isPlaceholder;
            });

            // Multiple markets - return all for picker if no sub-slug or more than 1
            if (!subMarketSlug && realMarkets.length > 1) {
              const markets: MarketData[] = realMarkets.map((m: any) => ({
                id: m.conditionId || m.id || eventSlug,
                question: m.question || event.title,
                description: m.description || '',
                outcome: getOutcome(m),
                end_date: m.endDate || event.endDate || '',
                resolved: !!(m.closed || m.resolved || getOutcome(m)),
                slug: m.slug || eventSlug,
                image: m.image || event.image,
              }));
              return NextResponse.json({ markets });
            }

            // Single market or sub-slug provided
            let market = realMarkets[0] || event.markets[0];
            if (subMarketSlug && realMarkets.length > 0) {
              const found = realMarkets.find((m: any) =>
                m.slug?.includes(subMarketSlug) ||
                m.question?.toLowerCase().includes(subMarketSlug.replace(/-/g, ' '))
              );
              if (found) market = found;
            }

            const marketData: MarketData = {
              id: market.conditionId || market.id || eventSlug,
              question: market.question || event.title,
              description: market.description || event.description || '',
              outcome: getOutcome(market),
              end_date: market.endDate || event.endDate || '',
              resolved: !!(market.closed || market.resolved || getOutcome(market)),
              slug: market.slug || eventSlug,
              image: market.image || event.image,
            };

            return NextResponse.json({ market: marketData });
          }
        }
      }
    } catch (e) {
      console.error('Gamma API error:', e);
    }

    // Fallback to CLOB API
    try {
      const clobRes = await fetch(`${CLOB_API}/markets?market_slug=${eventSlug}`, {
        cache: 'no-store',
      });
      if (clobRes.ok) {
        const clobData = await clobRes.json();
        const markets = clobData.data || clobData;

        if (markets && markets.length > 0) {
          const market = markets[0];
          const outcome = market.tokens?.find((t: any) => t.winner)?.outcome || null;

          const marketData: MarketData = {
            id: market.condition_id || market.market_slug || eventSlug,
            question: market.question,
            description: market.description || '',
            outcome,
            end_date: market.end_date_iso || '',
            resolved: !!outcome,
            slug: market.market_slug || eventSlug,
            image: market.image,
          };

          return NextResponse.json({ market: marketData });
        }
      }
    } catch (e) {
      console.error('CLOB API error:', e);
    }

    return NextResponse.json(
      { error: `Market not found: ${eventSlug}` },
      { status: 404 }
    );

  } catch (error) {
    console.error('Market fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market' },
      { status: 500 }
    );
  }
}

function getOutcome(market: any): string | null {
  // Check outcomePrices - format is like "[\"1\", \"0\"]" where 1 means winner
  if (market.outcomePrices && market.outcomes) {
    try {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      const outcomes = typeof market.outcomes === 'string'
        ? JSON.parse(market.outcomes)
        : market.outcomes;

      const winnerIdx = prices.findIndex((p: string | number) => p === '1' || p === 1);
      if (winnerIdx >= 0 && outcomes[winnerIdx]) {
        return outcomes[winnerIdx];
      }
    } catch {}
  }

  // Check tokens array
  if (market.tokens && Array.isArray(market.tokens)) {
    const winner = market.tokens.find((t: any) => t.winner === true || t.winner === 'true');
    if (winner) return winner.outcome;
  }

  // Check winningOutcome field
  if (market.winningOutcome) return market.winningOutcome;

  return null;
}

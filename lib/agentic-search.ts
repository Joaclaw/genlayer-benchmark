import Exa from 'exa-js';

export interface URLCandidate {
  url: string;
  title: string;
  confidence: number;
  accessible: boolean;
  validation_reason?: string;
}

export interface URLDiscoveryResult {
  market_id: string;
  question: string;
  expected: string;
  urls: URLCandidate[];
  accessible_count: number;
  search_results_count: number;
  error?: string;
}

/**
 * Find 3 accessible URLs for a market question using Exa AI neural search,
 * then validate each URL is GenLayer-compatible (HTTP 200, no anti-bot, content in HTML).
 */
export async function findAccessibleURLs(
  question: string,
  endDate: string,
  numSearchResults: number = 10
): Promise<URLCandidate[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error('EXA_API_KEY environment variable is required');
  }

  const exa = new Exa(apiKey);

  // Search with Exa neural search - use the market question directly
  const searchResults = await exa.search(question, {
    type: 'neural',
    numResults: numSearchResults,
    contents: {
      text: { maxCharacters: 3000 },
    },
    // Only find articles published before the market close date
    endPublishedDate: endDate,
    // Exclude known problematic domains
    excludeDomains: [
      'polymarket.com',
      'twitter.com',
      'x.com',
      'reddit.com',
      'facebook.com',
      'instagram.com',
      'tiktok.com',
    ],
  });

  // Validate each URL in parallel
  const validated = await Promise.all(
    searchResults.results.map((result) =>
      validateURL(
        result.url,
        result.title || '',
        (result as any).text || ''
      )
    )
  );

  // Return top 3 accessible URLs sorted by confidence
  return validated
    .filter((v) => v.accessible)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Validate a URL for GenLayer compatibility:
 * - HTTP 200 response
 * - No anti-bot protection (Cloudflare, CAPTCHA)
 * - Meaningful content available in raw HTML (not JS-rendered only)
 */
async function validateURL(
  url: string,
  title: string,
  exaText: string
): Promise<URLCandidate> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GenLayer/1.0; +https://genlayer.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (response.status !== 200) {
      return {
        url,
        title,
        accessible: false,
        validation_reason: `HTTP ${response.status}`,
        confidence: 0,
      };
    }

    const html = await response.text();

    // Check for anti-bot patterns
    const htmlLower = html.toLowerCase();
    const antiBotPatterns = [
      'please verify you are human',
      'checking your browser',
      'enable javascript to continue',
      'captcha',
      'access denied',
      'just a moment...',
    ];

    // Only flag Cloudflare if it looks like a challenge page, not just a CDN header
    if (
      htmlLower.includes('cloudflare') &&
      (htmlLower.includes('challenge') ||
        htmlLower.includes('ray id') ||
        htmlLower.includes('please turn javascript on'))
    ) {
      return {
        url,
        title,
        accessible: false,
        validation_reason: 'Cloudflare challenge detected',
        confidence: 0,
      };
    }

    for (const pattern of antiBotPatterns) {
      if (htmlLower.includes(pattern)) {
        return {
          url,
          title,
          accessible: false,
          validation_reason: `Anti-bot: "${pattern}"`,
          confidence: 0,
        };
      }
    }

    // Extract text content (strip scripts, styles, and tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = textContent.split(/\s+/).length;

    if (wordCount < 100) {
      return {
        url,
        title,
        accessible: false,
        validation_reason: `Insufficient content: ${wordCount} words (need 100+)`,
        confidence: 0,
      };
    }

    // Confidence based on word count (more content = higher confidence)
    const confidence = Math.min(wordCount / 500, 1.0);

    return {
      url,
      title: title || extractTitle(html),
      accessible: true,
      confidence,
    };
  } catch (error: any) {
    const message = error?.name === 'AbortError' ? 'Timeout' : error?.message || 'Unknown error';
    return {
      url,
      title,
      accessible: false,
      validation_reason: `Fetch error: ${message}`,
      confidence: 0,
    };
  }
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim().slice(0, 200) : '';
}

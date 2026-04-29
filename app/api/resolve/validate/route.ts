import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FETCH_TIMEOUT_MS = 10000;
const MIN_CONTENT_LENGTH = 500;

const ANTI_BOT_PATTERNS = [
  'access denied',
  'please verify you are human',
  'enable javascript',
  'checking your browser',
  'captcha',
  'cloudflare',
  'just a moment',
  'ray id',
  'attention required',
  'sorry, you have been blocked',
  'one more step',
];

interface ValidatedURL {
  url: string;
  title: string;
  domain: string;
  accessible: boolean;
  relevant: boolean;
  answerBearing: boolean;
  error?: string;
  snippet?: string;
}

async function fetchContent(url: string): Promise<{ content: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { content: text };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      return { content: '', error: 'Timeout' };
    }
    return { content: '', error: 'Connection failed' };
  }
}

function checkContentQuality(content: string): string | null {
  if (content.length < MIN_CONTENT_LENGTH) {
    return 'Content too short';
  }

  const contentLower = content.toLowerCase();
  for (const pattern of ANTI_BOT_PATTERNS) {
    if (contentLower.includes(pattern)) {
      return 'Anti-bot detected';
    }
  }

  return null;
}

// Check if content is relevant AND can actually answer the question
async function checkRelevanceAndAnswer(
  content: string,
  question: string,
  outcome: string
): Promise<{ relevant: boolean; answerBearing: boolean; snippet?: string }> {
  if (!OPENAI_API_KEY) {
    return { relevant: true, answerBearing: true };
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analyze this webpage content for a prediction market question.

QUESTION: "${question}"
EXPECTED OUTCOME: ${outcome}

CONTENT (first 3000 chars):
${content.slice(0, 3000)}

Analyze and respond with JSON only:
{
  "relevant": true/false (does content relate to the question topic?),
  "answer_bearing": true/false (does content contain specific facts that could definitively answer YES or NO?),
  "snippet": "quote the most relevant sentence that helps answer the question (max 200 chars)"
}

Be strict: "answer_bearing" should only be true if there's a clear, factual statement about the outcome.`
      }],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      relevant: result.relevant === true,
      answerBearing: result.answer_bearing === true,
      snippet: result.snippet,
    };
  } catch (e) {
    console.error('Relevance check error:', e);
    return { relevant: true, answerBearing: true };
  }
}

export async function POST(request: Request) {
  try {
    const { question, outcome, urls } = await request.json();

    if (!question || !urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Question and urls array required' },
        { status: 400 }
      );
    }

    const validated: ValidatedURL[] = [];

    // Process URLs in parallel for speed
    const results = await Promise.all(
      urls.map(async (urlObj: any) => {
        const { url, title, domain, highlight } = urlObj;

        // Fetch content
        const { content, error: fetchError } = await fetchContent(url);

        if (fetchError) {
          return {
            url,
            title,
            domain,
            accessible: false,
            relevant: false,
            answerBearing: false,
            error: fetchError,
          };
        }

        // Check content quality
        const qualityError = checkContentQuality(content);
        if (qualityError) {
          return {
            url,
            title,
            domain,
            accessible: false,
            relevant: false,
            answerBearing: false,
            error: qualityError,
          };
        }

        // Check relevance and answer-bearing capability
        const { relevant, answerBearing, snippet } = await checkRelevanceAndAnswer(
          content,
          question,
          outcome || 'Unknown'
        );

        return {
          url,
          title,
          domain,
          accessible: true,
          relevant,
          answerBearing,
          snippet: snippet || highlight,
          error: !relevant ? 'Not relevant' : (!answerBearing ? 'No definitive answer' : undefined),
        };
      })
    );

    // Sort: prioritize answer-bearing URLs
    const sorted = results.sort((a, b) => {
      if (a.answerBearing && !b.answerBearing) return -1;
      if (!a.answerBearing && b.answerBearing) return 1;
      if (a.relevant && !b.relevant) return -1;
      if (!a.relevant && b.relevant) return 1;
      return 0;
    });

    return NextResponse.json({
      urls: sorted,
      summary: {
        total: sorted.length,
        accessible: sorted.filter(u => u.accessible).length,
        relevant: sorted.filter(u => u.relevant).length,
        answerBearing: sorted.filter(u => u.answerBearing).length,
      },
    });

  } catch (error) {
    console.error('URL validation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}

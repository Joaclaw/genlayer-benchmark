import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const resolution = await request.json();

    if (!resolution.market?.slug) {
      return NextResponse.json({ error: 'Missing market slug' }, { status: 400 });
    }

    const dir = join(process.cwd(), 'data', 'resolutions');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create filename with sanitized slug and timestamp
    const slug = sanitizeSlug(resolution.market.slug);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${slug}_${timestamp}.json`;

    // Save the resolution
    writeFileSync(join(dir, filename), JSON.stringify(resolution, null, 2));

    // Update index
    const indexPath = join(dir, 'index.json');
    let index: Array<{ filename: string; market_id: string; question: string; timestamp: string; correct?: boolean }> = [];

    if (existsSync(indexPath)) {
      try {
        index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      } catch {
        index = [];
      }
    }

    index.unshift({
      filename,
      market_id: resolution.market.id,
      question: resolution.market.question,
      timestamp: resolution.timestamp,
      correct: resolution.result?.correct,
    });

    // Keep only last 100 entries in index
    if (index.length > 100) {
      index = index.slice(0, 100);
    }

    writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return NextResponse.json({ success: true, filename });

  } catch (error) {
    console.error('Save resolution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    );
  }
}

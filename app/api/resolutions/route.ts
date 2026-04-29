import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'resolutions');

    if (!fs.existsSync(dataDir)) {
      return NextResponse.json({ resolutions: [] });
    }

    const files = fs.readdirSync(dataDir)
      .filter(f => f.endsWith('.json') && f !== 'index.json')
      .sort((a, b) => {
        // Sort by timestamp in filename (newest first)
        const timeA = a.match(/_(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || '';
        const timeB = b.match(/_(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || '';
        return timeB.localeCompare(timeA);
      });

    const resolutions = files.map(file => {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return {
        filename: file,
        ...data,
      };
    });

    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Error loading resolutions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load resolutions' },
      { status: 500 }
    );
  }
}

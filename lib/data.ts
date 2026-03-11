import path from 'path';
import fs from 'fs';

export async function getMarketData() {
    const filePath = path.join(process.cwd(), 'data', 'polymarket_2000_sample.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function getResultsData() {
    const filePath = path.join(process.cwd(), 'data', 'benchmark_results.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}


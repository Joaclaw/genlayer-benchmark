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

export async function getCategoryData() {
    const filePath = path.join(process.cwd(), 'data', 'market_categories.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function getPilotResultsData() {
    const filePath = path.join(process.cwd(), 'data', 'pilot_results.json');
    if (!fs.existsSync(filePath)) return null;
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function getPilotURLsData() {
    const filePath = path.join(process.cwd(), 'data', 'pilot_urls.json');
    if (!fs.existsSync(filePath)) return null;
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}


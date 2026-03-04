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

export async function getAnalysisData() {
    const filePath = path.join(process.cwd(), 'ANALYSIS.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function getFinalAnalysisData() {
    const filePath = path.join(process.cwd(), 'final_analysis.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export async function getAmbiguousDetailedAnalysisData() {
    const filePath = path.join(process.cwd(), 'ambiguous_detailed_analysis.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

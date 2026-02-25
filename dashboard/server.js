import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 5050;

// Serve static files
app.use(express.static(__dirname));

// API: Get benchmark results
app.get('/api/results', (req, res) => {
  const resultsPath = join(ROOT_DIR, 'results/benchmark_results.json');
  
  if (!existsSync(resultsPath)) {
    return res.json([]);
  }
  
  try {
    const results = JSON.parse(readFileSync(resultsPath, 'utf-8'));
    res.json(results);
  } catch (err) {
    console.error('Error reading results:', err);
    res.json([]);
  }
});

// API: Get contract code
app.get('/api/contract', (req, res) => {
  const contractPath = join(ROOT_DIR, 'contracts/market_resolver.py');
  
  if (!existsSync(contractPath)) {
    return res.json({ code: '# Contract not found' });
  }
  
  try {
    const code = readFileSync(contractPath, 'utf-8');
    res.json({ code });
  } catch (err) {
    console.error('Error reading contract:', err);
    res.json({ code: '# Error reading contract' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 GenLayer Benchmark Dashboard`);
  console.log(`   Running at http://localhost:${PORT}`);
  console.log(`\n   Press Ctrl+C to stop`);
});

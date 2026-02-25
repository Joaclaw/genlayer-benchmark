import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const app = express();
const PORT = 5050;

// Serve static files
app.use(express.static(__dirname));

// API: Get benchmark results
app.get('/api/results', (req, res) => {
  const resultsPath = join(PROJECT_ROOT, 'results', 'benchmark_results.json');
  
  if (!existsSync(resultsPath)) {
    return res.json({
      startTime: new Date().toISOString(),
      markets: [],
      summary: { total: 0, completed: 0, matches: 0, mismatches: 0, errors: 0, pending: 0 }
    });
  }
  
  try {
    const data = readFileSync(resultsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read results' });
  }
});

// API: Get contract code
app.get('/api/contract', (req, res) => {
  const contractPath = join(PROJECT_ROOT, 'contracts', 'market_resolver.py');
  
  if (!existsSync(contractPath)) {
    return res.status(404).json({ error: 'Contract not found' });
  }
  
  try {
    const code = readFileSync(contractPath, 'utf-8');
    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read contract' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 GenLayer Benchmark Dashboard`);
  console.log(`   Running at http://localhost:${PORT}`);
  console.log('');
  console.log('   Press Ctrl+C to stop');
});

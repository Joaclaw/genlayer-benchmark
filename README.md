# GenLayer Multi-URL Resolution Benchmark

Test GenLayer's Optimistic Democracy consensus for resolving Polymarket prediction markets.

## Quick Start

```bash
# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env with your keys:
# - EXA_API_KEY (for URL discovery)
# - OPENAI_API_KEY (for relevance checking)

# Start dev server
npm run dev
# → http://localhost:3000
```

## How It Works

1. **Paste a Polymarket URL** (e.g., `https://polymarket.com/event/...`)
2. **Auto-discover sources** via Exa AI (finds 5 URLs from different domains)
3. **Validate URLs** (accessibility + relevance checks)
4. **Submit to GenLayer** (3 URLs → Optimistic Democracy consensus)
5. **Compare result** to Polymarket ground truth

## Project Structure

```
genlayer-benchmark/
├── app/                    # Next.js frontend
│   ├── resolve/           # Main resolution UI
│   └── api/resolve/       # API routes
│       ├── market/        # Fetch Polymarket metadata
│       ├── discover/      # Exa AI URL discovery
│       ├── validate/      # URL validation
│       ├── submit/        # Contract submission
│       └── save/          # Persist results
├── pipeline/              # Core logic
│   ├── multi_url_resolver.py  # GenLayer contract
│   └── lib/               # TypeScript utilities
├── data/
│   └── resolutions/       # Saved resolution results
├── archive/               # Old code (preserved)
└── TODOS.md              # Planned improvements
```

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  POLYMARKET URL                                                  │
│  └─► Fetch market metadata (question, outcome, end date)        │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  URL DISCOVERY (Exa AI)                                          │
│  └─► Neural search for 5+ relevant sources                      │
│  └─► Domain diversification (different domains)                 │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  URL VALIDATION                                                  │
│  └─► HTTP accessibility check                                   │
│  └─► Anti-bot detection                                         │
│  └─► LLM relevance check (OpenAI)                              │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  CONTRACT SUBMISSION (GenLayer)                                  │
│  └─► 3 URLs → MultiURLResolver contract                        │
│  └─► Each URL: fetch + LLM extraction                          │
│  └─► 2/3 majority vote → final answer                          │
│  └─► Optimistic Democracy validates consensus                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  RESULT                                                          │
│  └─► Compare to Polymarket ground truth                         │
│  └─► Save to data/resolutions/                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Contract

The `MultiURLResolver` contract (`pipeline/multi_url_resolver.py`) implements:

- **Multi-URL consensus**: Fetches 3 pre-validated URLs
- **Per-URL extraction**: LLM extracts YES/NO from each source
- **2/3 majority vote**: Requires 2 of 3 to agree
- **Optimistic Democracy**: GenLayer validators verify the result

## API Keys Required

| Key | Purpose | Get it at |
|-----|---------|-----------|
| `EXA_API_KEY` | URL discovery | https://exa.ai |
| `OPENAI_API_KEY` | Relevance checking | https://platform.openai.com |

Contract submission uses GenLayer's studionet - no private key required.

## License

MIT

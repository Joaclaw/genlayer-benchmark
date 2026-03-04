# GenLayer Benchmark Improvements Plan

> **Status**: Planned - Not yet implemented
> **Created**: 2026-03-03

## Overview

Two improvements to the benchmark system:
1. **Parallel Deployment** - Submit transactions in parallel, track all tx hashes, batch poll for results
2. **Live Market Resolution** - Fetch upcoming markets, discover accessible URLs off-chain, resolve on-chain with multi-URL support

---

## Part 1: Parallel Deployment Optimization

### Problem
Current sequential approach: 2000 markets × 30-60s consensus = 16+ hours

### Solution
Decouple submission from consensus waiting (inspired by `submit_1000.ts` pattern):
- Phase 1: Submit all transactions (~2-3 min)
- Phase 2: Consensus happens in background (~30-60 min)
- Phase 3: Batch poll/collect results (~5-10 min)
- **Total: ~1-2 hours (25-30x speedup)**

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: Parallel Submission                       │
│                         (2-3 minutes)                                 │
│  - Fire-and-forget all transactions                                  │
│  - Store tx_hash → market_id mapping                                 │
│  - Persist to checkpoint file                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: Background Consensus                      │
│                         (30-60 minutes)                               │
│  - GenLayer validators process transactions in parallel              │
│  - Results accumulate in contract DynArray[MarketResult]             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: Batch Polling/Retrieval                   │
│                         (5-10 minutes)                                │
│  - Poll contract get_result_count() periodically                     │
│  - When complete, fetch all via get_results()                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify

**New: `scripts/parallel_benchmark.ts`**
```
- submitAllMarkets(): Fire-and-forget all transactions
- pollForResults(): Check contract result count periodically
- collectResults(): Fetch all results via get_results()
- Checkpoint system for recovery (save state every N submissions)
```

**New: `checkpoints/` directory**
- Store benchmark state: tx_hash → market_id mappings
- Enable resume from interruption

**Modify: `package.json`**
```json
{
  "benchmark:submit": "tsx scripts/parallel_benchmark.ts submit",
  "benchmark:poll": "tsx scripts/parallel_benchmark.ts poll",
  "benchmark:collect": "tsx scripts/parallel_benchmark.ts collect",
  "benchmark:full": "tsx scripts/parallel_benchmark.ts full"
}
```

### Data Structure
```typescript
interface SubmissionState {
  benchmark_id: string;
  contract_address: string;
  phase: 'submitting' | 'waiting' | 'collecting' | 'complete';
  submissions: Array<{
    market_id: string;
    tx_hash: string;
    status: 'submitted' | 'finalized' | 'failed';
  }>;
}
```

---

## Part 2: Live Market Resolution with Agentic URL Discovery

### Workflow

```
1. FETCH LIVE MARKETS
   Polymarket API ?closed=false → filter by end_date
   Time window: Configurable via --window=24h|48h|7d|etc

2. AGENTIC URL DISCOVERY (Off-chain) - Pluggable Architecture
   For each market:
   ├── Extract URLs from description (always)
   ├── [Pluggable] URL search strategy:
   │   ├── Option A: LLM + Search APIs (OpenAI + Google/DuckDuckGo)
   │   ├── Option B: Direct web scraping
   │   └── Option C: Manual/predefined sources
   ├── Test each URL accessibility (fetch + check for anti-bot)
   ├── [Optional] Score relevance (LLM or heuristic)
   └── Select top 3 accessible URLs

3. ON-CHAIN RESOLUTION
   submit resolve_market_multi(market_id, question, [url1, url2, url3], ...)
   Contract tries URLs in order, returns on first YES/NO
```

### Design Decision: Pluggable URL Discovery
The URL discovery system will be designed with a pluggable interface:
```typescript
interface UrlDiscoveryStrategy {
  discover(market: LiveMarket): Promise<DiscoveredUrl[]>;
}
```
This allows swapping between LLM-based, scraping-based, or hybrid approaches without changing the rest of the pipeline.

### Files to Create

**New: `scripts/fetch_live_markets.ts`**
- Query Polymarket API with `closed=false`
- Filter by `end_date` within configurable window
- Output: list of upcoming markets

**New: `scripts/url_discovery.ts`**
- `generateSearchQueries(question)`: LLM generates search terms
- `searchForUrls(queries)`: Query search APIs
- `testUrlAccessibility(url)`: Fetch test, check for blocks
- `scoreUrlRelevance(url, content, question)`: LLM relevance scoring
- `discoverUrlsForMarket(market)`: Main orchestration

**New: `scripts/resolve_live_markets.ts`**
- Orchestrates full workflow
- Deploys multi-URL contract
- Submits markets with discovered URLs
- Saves state for polling

**New: `contracts/polymarket_resolver_multi.py`**
- New contract method: `resolve_market_multi(market_id, question, urls[], ...)`
- Tries URLs in order, stops on first YES/NO
- Tracks `url_used` and `url_index` in result
- Same consensus mechanism: `gl.eq_principle.prompt_comparative`

### New Data Structures

```python
# Contract storage
@allow_storage
class MarketResultMulti:
    market_id: str
    question: str
    urls_tried: str      # JSON array
    url_used: str        # Which URL succeeded
    url_index: u256      # Index (0-2)
    genlayer_result: str # YES/NO/UNRESOLVABLE
    reasoning: str
    # ... other fields
```

```typescript
// URL discovery
interface DiscoveredUrl {
  url: string;
  source: 'description' | 'search';
  relevance_score: number;
  accessibility: 'accessible' | 'blocked';
}
```

### NPM Scripts
```json
{
  "live:fetch": "tsx scripts/fetch_live_markets.ts",
  "live:discover": "tsx scripts/discover_urls.ts",
  "live:resolve": "tsx scripts/resolve_live_markets.ts",
  "live:poll": "tsx scripts/poll_live_results.ts"
}
```

---

## Dependencies

```json
{
  // Core (always needed)
  "genlayer-js": "^0.20.1"  // Already installed

  // Optional - depends on URL discovery strategy chosen:
  // "openai": "^4.0.0"     // If using LLM for query generation/relevance
  // "serpapi": "^2.0.0"    // If using SerpAPI for search
}
```

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `scripts/submit_1000.ts` | Pattern for fire-and-forget (adapt for parallel) |
| `contracts/polymarket_resolver.py` | Base contract (extend for multi-URL) |
| `scripts/fetch_all_markets.ts` | Polymarket API pattern (adapt for live) |
| `lib/genlayer.ts` | SDK client patterns |

---

## Verification

### Parallel Benchmark
1. Run `npm run benchmark:submit` on 100 markets
2. Verify checkpoint file created with all tx_hashes
3. Run `npm run benchmark:poll` - watch result count increase
4. Run `npm run benchmark:collect` - verify all results retrieved
5. Compare timing to sequential approach

### Live Resolution
1. Run `npm run live:fetch` - verify live markets fetched
2. Run `npm run live:discover` on 5 markets - verify URLs discovered
3. Deploy multi-URL contract to Studionet
4. Submit 1 market with 3 URLs - verify fallback works
5. Full workflow on 10 markets

# Multi-URL Benchmark Testing Checklist

## Prerequisites

1. [ ] `.env` file has required keys:
   - `EXA_API_KEY`
   - `OPENAI_API_KEY`
   - `GENLAYER_PRIVATE_KEY`

2. [ ] `.contract-address` file exists with deployed MultiURLResolver address

3. [ ] GenLayer studionet is accessible

## Step-by-Step Testing

### Step 1: Fetch Resolved Markets

```bash
npx ts-node scripts/benchmark/fetch_resolved.ts
```

**Verify:**
- [ ] `data/benchmark/resolved_markets.json` created
- [ ] Markets have `outcome` field ("Yes" or "No")
- [ ] Markets filtered to whitelisted categories (no sports, crypto)
- [ ] At least 10+ markets returned for 7-day window

**Edge cases:**
- [ ] If 0 markets: Check CLOB API, adjust lookback window
- [ ] If all excluded: Check categorization logic

### Step 2: Discover URLs

```bash
npx ts-node scripts/benchmark/discover_urls.ts
```

**Verify:**
- [ ] `data/benchmark/discovered_urls.json` created
- [ ] Each market has 3+ URLs from different domains
- [ ] Progress logging shows success/failure per market

**Edge cases:**
- [ ] If many "no_results": Check Exa API key, search query format
- [ ] If same domain repeated: Domain diversification working?

### Step 3: Validate URLs

```bash
npx ts-node scripts/benchmark/validate_urls.ts
```

**Verify:**
- [ ] `data/benchmark/validated_urls.json` created
- [ ] URLs marked accessible=true are actually fetchable
- [ ] Relevance check filters out off-topic URLs
- [ ] Anti-bot detection catches Cloudflare, etc.

**Edge cases:**
- [ ] If all URLs fail accessibility: Check fetch timeout, user-agent
- [ ] If all URLs fail relevance: Check LLM prompt, API key

### Step 4: Run Benchmark

```bash
npx ts-node scripts/benchmark/run_benchmark.ts
```

**Verify:**
- [ ] `data/benchmark/benchmark_output.json` created
- [ ] Results have `final_answer`, `correct`, `consensus_count`
- [ ] Summary metrics calculated correctly
- [ ] Skipped markets logged with reason

**Edge cases:**
- [ ] If contract calls fail: Check RPC URL, private key, contract address
- [ ] If UNCERTAIN > 50%: URLs may not contain resolution info

## Success Criteria

After full pipeline run:

- [ ] **URL discovery rate**: >50% of markets have 3+ URLs
- [ ] **Resolution rate**: >70% of submitted markets reach consensus
- [ ] **Accuracy**: >85% correct when consensus reached

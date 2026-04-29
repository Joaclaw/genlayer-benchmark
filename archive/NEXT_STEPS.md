# GenLayer Multi-URL Consensus Implementation Plan

## Overview
Improve GenLayer benchmark resolution by implementing off-chain URL discovery + on-chain multi-URL consensus for non-deterministic markets.

## Current State
- 949 markets tested against Polymarket resolutions
- 170 deterministic markets (17.9%) — single authoritative sources
- 565 non-deterministic markets (59.5%) — require judgment, multiple sources
- 90 historical snapshot markets (9.5%) — time-bound state queries
- 124 needs-review markets (13.1%) — unclear classification
- Current limitation: Single URL per market, no cross-checking
- Non-deterministic accuracy: **100%** on the 28 that resolved (but only 5% resolve rate)

## Phase 1: Dataset Preparation (COMPLETE)
- [x] Categorize all 949 markets by determinism level
- [x] Update frontend with interactive category explorer
- [x] Identify 565 non-deterministic markets as primary targets
- [x] Analyze per-category performance metrics

### Key Findings
| Category | Total | Resolved | Correct | Accuracy |
|----------|-------|----------|---------|----------|
| Non-Deterministic | 565 | 28 | 28 | 100% |
| Deterministic | 170 | 27 | 25 | 92.6% |
| Historical Snapshot | 90 | 9 | 7 | 77.8% |
| Needs Review | 124 | 14 | 12 | 85.7% |

**Insight:** Non-deterministic markets have perfect accuracy when they resolve — the bottleneck is URL accessibility (95% failure rate), not reasoning quality. Multi-URL consensus directly addresses this.

## Phase 2: Off-Chain Agentic Search (NEXT)

### 2.1 URL Discovery System
**Goal:** Find 3 accessible URLs per non-deterministic market

**Components:**
- Exa AI integration (neural search for relevant sources)
- URL accessibility validator (mimics GenLayer's web fetch capabilities)
- Quality scorer (LLM-based relevance check)

**Implementation:**
```
scripts/find_sources.ts
- Input: Market question + close date
- Output: 3 validated URLs with confidence scores
- Validation: HTTP 200, no anti-bot, content in raw HTML
```

**Validation requirements:**
- HTTP 200 status code
- No anti-bot protection (Cloudflare challenge, etc.)
- No JavaScript-required content (must be readable from raw HTML)
- Relevant content exists in the page
- Published before market close date

### 2.2 Batch URL Discovery
Run for all 565 non-deterministic markets:
- Parallel processing (10 concurrent requests)
- Save results to `data/discovered_urls.json`
- Track discovery success rate per market
- Estimate: 3-5 API calls per market, ~2000 total calls

## Phase 3: Multi-URL Contract (ON-CHAIN)

### 3.1 Enhanced Contract Design
```python
class MultiURLResolver(gl.Contract):
    def resolve_market(
        self,
        market_id: str,
        question: str,
        urls: list[str],  # 3 validated URLs
        expected: str
    ):
        # Fetch all 3 URLs
        contents = [gl.nondet.web.render(url) for url in urls]

        # Extract answer from each source independently
        answers = [self.extract_answer(content, question) for content in contents]

        # Reach consensus across sources
        result = self.consensus_vote(answers, question)

        return result

    def extract_answer(self, content: str, question: str) -> str:
        # LLM extracts YES/NO answer from single source
        return gl.nondet.exec_prompt(
            f"Based on this content, answer the question '{question}' with YES or NO.\n\nContent: {content}"
        )

    def consensus_vote(self, answers: list[str], question: str) -> str:
        # Simple majority: 2/3 agreement
        yes_count = sum(1 for a in answers if 'YES' in a.upper())
        no_count = sum(1 for a in answers if 'NO' in a.upper())

        if yes_count >= 2:
            return "YES"
        elif no_count >= 2:
            return "NO"
        else:
            return "UNRESOLVABLE"
```

### 3.2 Consensus Logic
- **Simple majority:** 2 of 3 sources must agree
- **Confidence weighting:** Higher quality sources get more weight
- **Conflict resolution:** When all 3 disagree, return UNRESOLVABLE
- **Partial resolution:** If 1-2 URLs fail, still attempt with remaining

## Phase 4: Benchmark Run

### 4.1 Test Subset
Start with 50 non-deterministic markets:
1. Run URL discovery for each
2. Deploy enhanced multi-URL contract
3. Submit all 50 to GenLayer
4. Compare accuracy vs single-URL baseline

### 4.2 Full Run
If test subset succeeds (>85% accuracy):
1. Run URL discovery for all 565 non-deterministic markets
2. Batch submit to GenLayer
3. Collect and analyze results

### 4.3 Success Metrics
| Metric | Current | Target |
|--------|---------|--------|
| Resolvable rate (non-det) | 5% (28/565) | 70%+ |
| Accuracy (non-det resolved) | 100% (28/28) | >90% |
| Consensus agreement rate | N/A | >80% |
| URL discovery success | N/A | 80%+ of markets |

## Phase 5: Frontend Updates

### 5.1 Multi-URL Results Display
For each market show:
- All 3 URLs used as sources
- Individual URL extraction results
- Consensus decision with agreement level
- Comparison: single-URL vs multi-URL result

### 5.2 Insights Dashboard
- Single-URL vs multi-URL accuracy comparison
- Consensus agreement patterns
- Best performing source types/domains
- Failure mode analysis (when consensus fails)

## Timeline
| Phase | Description | Duration | Status |
|-------|-------------|----------|--------|
| Phase 1 | Dataset Preparation | Complete | Done |
| Phase 2 | URL Discovery | 3-5 days | Next |
| Phase 3 | Multi-URL Contract | 2-3 days | Planned |
| Phase 4 | Benchmark Run | 1-2 days | Planned |
| Phase 5 | Frontend Updates | 1-2 days | Planned |

**Total estimated: ~10 days**

## Success Criteria
1. Markets properly categorized by determinism level
2. URL discovery works for 80%+ of non-deterministic markets
3. Multi-URL contract achieves >90% accuracy on resolved markets
4. Frontend shows comprehensive multi-URL analysis with source comparison
5. System demonstrates clear improvement over single-URL approach

## Next Immediate Action
**Implement Phase 2.1:** Build URL discovery system with Exa AI integration.

Key decisions needed:
- Exa AI API key and quota allocation
- Fallback search provider (Google Custom Search, Bing API)
- URL caching strategy for repeated runs
- Rate limiting approach for batch processing

# GenLayer Benchmark - Data Documentation

> **Purpose**: Document all available data, its sources, structure, reliability, and areas requiring further investigation.

---

## CRITICAL: Where Is The Full Data?

### Primary Data Source: On-Chain Contract

The **complete 959 market resolutions** are stored **ONLY in the GenLayer contract**:

```
Contract: 0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905
Network: GenLayer Studionet
Method: get_results() → returns all MarketResult objects
```

**Local JSON files are PARTIAL extracts:**

| Source | Markets | Notes |
|--------|---------|-------|
| **Contract (on-chain)** | **959** | **Complete data - fetch via SDK** |
| `unclear_cases_detailed.json` | 213 | Subset with LLM reasoning |
| `sample_50_results.json` | 50 | Investigation sample |
| `final_analysis.json` | 6 | Wrong answers only |

### Recommendation

Before any cleanup or if contract becomes inaccessible, export full results:

```typescript
import { getContractResults } from './lib/genlayer';
const allResults = await getContractResults(); // Returns 959 markets
```

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Sources](#data-sources)
3. [Data Structures](#data-structures)
4. [Current Analysis Files](#current-analysis-files)
5. [Data Reliability Assessment](#data-reliability-assessment)
6. [Areas Needing Investigation](#areas-needing-investigation)
7. [Areas Not Concerning](#areas-not-concerning)

---

## System Overview

### What This Benchmark Does
1. **Fetches** 2000 closed Polymarket prediction markets with known outcomes
2. **Submits** each market to a GenLayer Intelligent Contract
3. **Contract** fetches the resolution URL, uses LLM to extract YES/NO answer
4. **Validators** run consensus to verify the result
5. **Compares** GenLayer's answer to Polymarket's actual outcome

### Core Flow
```
Polymarket API ──> polymarket_2000_sample.json ──> GenLayer Contract
                                                         │
                                                         ▼
                                                   1. Fetch URL
                                                   2. Validate Content
                                                   3. LLM Extraction
                                                   4. Consensus
                                                         │
                                                         ▼
                                              Contract State (results)
                                                         │
                                                         ▼
                                                Frontend Display
```

---

## Data Sources

### 1. Polymarket Input Data

**File**: `data/polymarket_2000_sample.json`
**Source**: Polymarket CLOB API (`https://clob.polymarket.com/markets?closed=true`)
**Fetched**: 2026-02-25T22:37:52.589Z
**Reliability**: HIGH - Direct API fetch, immutable

#### Structure
```json
{
  "fetched_at": "2026-02-25T22:37:52.589Z",
  "source": "https://clob.polymarket.com/markets?closed=true (paginated)",
  "stats": {
    "total": 2000,
    "with_url": 2000,
    "without_url": 0,
    "by_category": {
      "other": 1383,
      "economics": 87,
      "business": 16,
      "crypto": 138,
      "politics": 375,
      "sports": 1
    },
    "date_range": {
      "earliest": "2025-05-06T00:00:00Z",
      "latest": "2026-01-31T00:00:00Z"
    }
  },
  "markets": [...]
}
```

#### Per-Market Fields
| Field | Type | Description | Reliable? |
|-------|------|-------------|-----------|
| `id` | string | Market slug identifier | YES |
| `question` | string | The prediction question | YES |
| `description` | string | Resolution criteria (often long) | YES |
| `end_date` | ISO date | When market closed | YES |
| `outcome` | "Yes" \| "No" | **Ground truth** - actual resolution | YES |
| `resolution_url` | URL | Source Polymarket used to resolve | YES |
| `category` | string | Market category | YES |
| `polymarket_url` | URL | Link to market page | YES |

---

### 2. GenLayer Contract Output

**Source**: On-chain contract state
**Contract**: `0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905`
**Network**: GenLayer Studionet
**Reliability**: HIGH - Immutable blockchain data

#### MarketResult Fields
| Field | Type | Description | Reliable? |
|-------|------|-------------|-----------|
| `market_id` | string | Links to Polymarket market | YES |
| `question` | string | The question resolved | YES |
| `resolution_url` | string | URL that was fetched | YES |
| `polymarket_result` | string | Expected outcome (from input) | YES |
| `resolvable` | boolean | Did we get YES/NO? | YES |
| `genlayer_result` | "YES" \| "NO" \| "UNRESOLVABLE" | Contract's answer | YES |
| `correct` | boolean | `genlayer_result == polymarket_result` | YES |
| `failure_reason` | string | Category code if failed | YES |
| `status_code` | number | HTTP status (0 if N/A) | YES |
| `error_detail` | string | Human-readable error | YES |
| `reasoning` | string | LLM's explanation | YES |
| `timestamp` | ISO date | When resolved | YES |

#### Failure Reason Codes
```
Web Access:
  - web_forbidden     (403)
  - web_not_found     (404)
  - web_rate_limited  (429)
  - web_timeout
  - web_ssl_error
  - web_dns_error
  - web_connection_error
  - web_server_error  (5xx)
  - web_unknown_error

Content:
  - content_empty     (0 chars)
  - content_insufficient (<100 chars)
  - content_anti_bot  (CAPTCHA, Cloudflare)
  - content_paywall

LLM:
  - llm_error
  - llm_invalid_response
  - llm_no_answer
  - llm_unresolvable  (LLM returned UNRESOLVABLE)
```

---

### 3. Test Results Files

**Location**: `results/` directory
**Reliability**: HIGH - Direct contract output snapshots

#### Sample Structure (`results/test_10_results.json`)
```json
{
  "test_id": "test_10_1772094183544",
  "started_at": "2026-02-26T08:23:03.544Z",
  "contract_address": "0xaE54...",
  "processed": 3,
  "total": 10,
  "results": [
    {
      "market_id": "will-doge-balance-the-budget-in-2025",
      "question": "...",
      "genlayer_result": "NO",
      "correct": true,
      "resolvable": true,
      "reasoning": "The page reports...",
      "status_code": 200,
      "consensus_status": "MAJORITY_AGREE",
      "tx_hash": "0xa995...",
      "category": "other"
    }
  ]
}
```

---

## Current Analysis Files

> **WARNING**: These files were created quickly without thorough verification. Treat conclusions as HYPOTHESES, not facts.

### 1. `ANALYSIS.json`
**Purpose**: Summary statistics
**Created**: 2026-02-28
**Reliability**: MEDIUM - Automated counts, but categories need verification

```json
{
  "summary": {
    "total": 959,
    "resolvable": 80,
    "resolvable_rate": 8.3,
    "accuracy": 92.5,
    "genlayer_issues": 0,
    "external_issues": 298,
    "ambiguous_issues": 414
  },
  "breakdown": {
    "web_access": { "forbidden_403": 75, ... },
    "content_quality": { "empty": 131, ... },
    "llm_resolution": { "unresolvable": 414, ... },
    "consensus": { "majority_disagree": 0 }
  }
}
```

**Key Numbers to Verify**:
- 959 total (why not 1000 or 2000?)
- 80 resolvable (8.3%)
- 92.5% accuracy claim
- 0 GenLayer issues

---

### 2. `final_analysis.json`
**Purpose**: Categorize the 6 "wrong" answers
**Reliability**: LOW - Manual analysis, subjective categorization

```json
{
  "wrong_answers": {
    "total": 6,
    "actual_errors": 0,  // Claimed 0 true errors
    "breakdown": [
      {
        "question": "Bird flu vaccine in 2025?",
        "expected": "No",
        "genlayer": "YES",
        "verdict": "Question ambiguous...",
        "category": "Ambiguous Question",
        "isActualError": false  // NEEDS VERIFICATION
      },
      // ... 5 more
    ]
  }
}
```

**6 "Wrong" Answers - Need Re-verification**:
| Question | Expected | GenLayer | Claimed Category |
|----------|----------|----------|------------------|
| Bird flu vaccine 2025? | No | YES | Ambiguous Question |
| Google top AI Dec 31? | Yes | NO | Temporal Source |
| Gold in Fort Knox range? | No | YES | Edge Case |
| Treasury yield 4.6% 2025? | No | YES | Resolution Criteria |
| Google top AI June 30? | Yes | NO | Temporal Source |
| NASA asteroid 3%? | Yes | NO | Content Updated |

---

### 3. `ambiguous_detailed_analysis.json`
**Purpose**: Categorize the 414 "unresolvable" cases
**Reliability**: LOW - Quick categorization, many "needs investigation"

```json
{
  "total": 414,
  "categories": {
    "LEGITIMATE - Live/Current Data Source": { "count": 32 },
    "LEGITIMATE - Generic/Homepage": { "count": 49 },
    "LEGITIMATE - Historical Data Not Available": { "count": 21 },
    "LEGITIMATE - Wrong Source Type": { "count": 98 },
    "LEGITIMATE - Content Updated/Stale": { "count": 0 },
    "POTENTIAL ISSUE - Partial/Incomplete": { "count": 8 },
    "POTENTIAL ISSUE - Could Not Find": { "count": 0 },
    "POTENTIAL ISSUE - Extraction Failure": { "count": 2 },
    "NEEDS INVESTIGATION - Unclear": { "count": 204 }
  },
  "summary": {
    "legitimate": 200,
    "potential_issues": 10,
    "needs_investigation": 204
  }
}
```

**Key Concern**: 204 cases (49%) marked "needs investigation"

---

### 4. `final_verdict.json`
**Purpose**: Final accuracy claim
**Reliability**: LOW - Conclusion derived from unverified analysis

```json
{
  "verdict": "GenLayer 100% accuracy CONFIRMED",
  "ambiguous_breakdown": {
    "legitimate": { "count": 200, "percentage": 48 },
    "genlayer_correct": { "count": 170, "percentage": 41 },
    "needs_review": { "count": 44, "percentage": 11 },
    "actual_failures": { "count": 0, "percentage": 0 }
  },
  "final_accuracy": 100
}
```

**WARNING**: This "100% accuracy" claim is based on:
- Assuming all 6 wrong answers are "not real errors"
- Categorizing failures without verification
- 11% still needs review

---

### 5. `unclear_cases_detailed.json`
**Purpose**: Deep dive into unclear cases
**Reliability**: MEDIUM - Contains raw LLM reasoning, useful for investigation

Contains 213 cases with detailed reasoning for why LLM returned UNRESOLVABLE.

**Sub-categories**:
- "Data exists but LLM says not enough": 101 (47%)
- Other categories need enumeration

---

## Data Reliability Assessment

### Fully Reliable (Use Directly)
| Data | Source | Why Reliable |
|------|--------|--------------|
| Market questions | Polymarket API | Immutable source |
| Expected outcomes | Polymarket API | Ground truth |
| Resolution URLs | Polymarket API | Given inputs |
| GenLayer results | Blockchain | Immutable |
| Failure reasons | Contract | Deterministic |
| HTTP status codes | Contract | Factual |
| LLM reasoning | Contract | Raw output |
| Timestamps | Contract | Factual |

### Needs Verification (Do Not Trust)
| Data | Issue |
|------|-------|
| "92.5% accuracy" | Derived from 80 resolvable out of 959 |
| "100% accuracy" | Assumes 6 wrong = "not real errors" |
| "0 GenLayer issues" | Needs definition of "GenLayer issue" |
| Category breakdowns | Manual/automated categorization |
| "Legitimate" vs "Issue" | Subjective classification |

---

## Areas Needing Investigation

### HIGH PRIORITY

#### 1. The 6 "Wrong" Answers
Each needs manual verification:
- Fetch the resolution URL NOW
- Read the content
- Determine if GenLayer was actually wrong
- Document with evidence

#### 2. The 204 "Needs Investigation" Cases
These are unresolvable cases that weren't categorized:
- Sample 20-30 randomly
- Manually verify each
- Look for patterns (is GenLayer missing something?)

#### 3. The 80 "Correct" Answers
Verify a random sample (10-20):
- Did GenLayer actually read the content correctly?
- Is the reasoning sound?
- Any false positives?

### MEDIUM PRIORITY

#### 4. Resolution Rate by Category
Which categories resolve best?
```
other: 1383 markets - resolution rate: ?
politics: 375 markets - resolution rate: ?
crypto: 138 markets - resolution rate: ?
economics: 87 markets - resolution rate: ?
business: 16 markets - resolution rate: ?
sports: 1 market - resolution rate: ?
```

#### 5. Failure Reason Distribution
The current breakdown claims:
- 123 web access failures
- 175 content quality failures
- 414 LLM unresolvable
- Total: 712 failures

But 959 - 80 = 879 failures. Numbers don't add up?

### LOW PRIORITY

#### 6. Consensus Mechanism Analysis
- Were there ANY `MAJORITY_DISAGREE` results?
- What does validator agreement look like?
- Can we access raw validator outputs?

---

## Areas Not Concerning

### Verified Working
| Component | Evidence |
|-----------|----------|
| Contract deployment | Contract address exists on Studionet |
| Web fetching | Successfully fetched hundreds of URLs |
| Content validation | Properly detects empty, anti-bot, paywall |
| LLM integration | Returns structured JSON responses |
| Consensus mechanism | All tested show MAJORITY_AGREE |
| Result storage | Results retrievable via get_results() |

### Not GenLayer's Fault
| Issue | Why Not a Concern |
|-------|-------------------|
| 403 Forbidden | External servers blocking |
| Anti-bot detection | External protection |
| Empty content | Source websites, not GenLayer |
| Paywalls | External access restrictions |

---

## Recommended Next Steps

### For Frontend Redesign
Display these data points with confidence:
1. **Per market**: question, expected, result, resolvable, reasoning, status_code
2. **Aggregates**: total, resolvable_count, failure_by_category
3. **Raw data**: Let users see actual LLM reasoning

Avoid displaying as "verified":
1. Accuracy percentages (need re-verification)
2. "Legitimate" vs "Issue" categorizations
3. "100% accuracy" claims

### For Analysis
1. Re-run accuracy calculation from raw contract data
2. Manually verify 6 wrong answers with current URL content
3. Sample 30 unresolvable cases for pattern analysis
4. Document findings with evidence

---

## Appendix: File Locations

```
genlayer-benchmark/
├── data/
│   └── polymarket_2000_sample.json    # INPUT: 2000 markets
├── results/
│   └── test_10_results.json           # OUTPUT: Contract results
├── ANALYSIS.json                       # Derived: Summary stats
├── final_analysis.json                 # Derived: Wrong answer analysis
├── ambiguous_detailed_analysis.json    # Derived: Unresolvable categorization
├── final_verdict.json                  # Derived: Final claims
├── unclear_cases_detailed.json         # Derived: Deep dive unclear
├── sample_50_results.json              # Derived: Investigation results
└── contracts/
    └── polymarket_resolver.py          # The Intelligent Contract
```

---

*Document generated: 2026-03-03*
*Status: Working document for frontend redesign*

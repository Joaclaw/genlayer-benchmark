# Repository Cleanup - Completed

> **Status**: Cleanup completed on 2026-03-03

---

## What Was Removed

### Folders Removed
| Folder | Reason |
|--------|--------|
| `dashboard/` | Old Flask/Express dashboard, replaced by Next.js |
| `logs/` | Old execution log |
| `memory/` | Empty |
| `src/` | Empty |
| `app/components/` | Empty (components are in `/components`) |
| `out/` | Build output (should be gitignored) |
| `results/` | Contained only outdated 3-market test |

### Scripts Removed (16 one-off analysis scripts)
```
analyze_6_wrong.ts, analyze_all_ambiguous.ts, analyze_ambiguous.ts,
analyze_final.ts, analyze_results.ts, check_data.ts, check_wrong_answers.ts,
deep_dive_ambiguous.ts, examine_unclear.ts, final_verdict.ts,
full_investigation.ts, investigate_final.ts, investigate_robust.ts,
investigate_sample.ts, investigate_sample_v2.ts, verify_wrong_answers.ts
```

### Data Files Removed
| File | Reason |
|------|--------|
| `data/markets.json` | Old 10-market test, superseded |
| `data/markets_feb_2026.json` | Old test set |
| `data/polymarket_sample.json` | 100-market sample, superseded by 2000 |
| `data/real_markets.json` | Old data |

### Other Files Removed
| File | Reason |
|------|--------|
| `contracts/market_resolver.py` | Old contract, not deployed |
| `scripts/fetch_markets.ts` | Superseded by fetch_all_markets.ts |
| `scripts/submit_all_10.ts` | Superseded |
| `scripts/parse_result.ts` | One-time utility |
| `scripts/watch_results.sh` | One-time utility |
| `benchmark_runner.py` | Old Python benchmark |
| `investigation_first_100.json` | Empty/incomplete |
| `final_verdict.json` | Just a summary |
| `results/test_10_results.json` | Only had 3 markets |

---

## What Was Kept

### Data with Actual GenLayer Consensus Results
| File | Markets | Contains |
|------|---------|----------|
| `ANALYSIS.json` | summary | Stats - **USED BY APP** |
| `ambiguous_detailed_analysis.json` | 414 | LLM reasoning from contract |
| `unclear_cases_detailed.json` | 213 | LLM reasoning from contract |
| `final_analysis.json` | 6 | Wrong answers with reasoning |
| `investigation_results.json` | 12 | Investigation with reasoning |
| `sample_50_results.json` | 50 | Verification results |

### Full Results Location
The complete **959 market resolutions** are stored on-chain:
```
Contract: 0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905
Network: GenLayer Studionet
Access: getContractResults() from lib/genlayer.ts
```

---

## Current Repository Structure

```
genlayer-benchmark/
├── app/
│   ├── analysis/page.tsx
│   ├── contract/page.tsx
│   ├── markets/page.tsx
│   ├── results/page.tsx
│   ├── error.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Navigation.tsx
│   └── StatCard.tsx
├── contracts/
│   └── polymarket_resolver.py
├── data/
│   └── polymarket_2000_sample.json
├── lib/
│   ├── constants.ts
│   ├── data.ts
│   └── genlayer.ts
├── scripts/
│   ├── fetch_all_markets.ts
│   ├── run_full_benchmark.ts
│   ├── run_test_10.ts
│   ├── submit_1000.ts
│   └── test_single_market.ts
│
│   # Benchmark Data (with GenLayer consensus reasoning)
├── ANALYSIS.json
├── ambiguous_detailed_analysis.json
├── unclear_cases_detailed.json
├── final_analysis.json
├── investigation_results.json
├── sample_50_results.json
│
│   # Documentation
├── BENCHMARK_ANALYSIS.md
├── CLEANUP_GUIDE.md
├── DATA_DOCUMENTATION.md
├── DEPLOYMENT.md
├── GENLAYER.md
├── README.md
│
│   # Config
├── next.config.js
├── next-env.d.ts
├── package.json
├── package-lock.json
└── tsconfig.json
```

**Total**: ~30 files (down from 55+)

# 🧬 GenLayer Benchmark

**Can GenLayer's Intelligent Contracts resolve Polymarket prediction markets?**

This benchmark tests whether [GenLayer](https://genlayer.com)'s Intelligent Oracle + Optimistic Democracy approach can correctly resolve real prediction markets from [Polymarket](https://polymarket.com).

## 📊 Key Findings

| Metric | Result |
|--------|--------|
| **URL Accessibility** | 60% (6/10 markets) |
| **Resolution Accuracy** | 83% (5/6 accessible) |
| **Best Source** | Wikipedia (100% success) |
| **Worst Sources** | News sites (anti-bot blocked) |

### What Works
- ✅ Wikipedia sources — fully accessible, correct resolution
- ✅ Simple factual questions with clear yes/no answers
- ✅ Historical events with documented outcomes

### What Doesn't Work
- ❌ News sites (CNN, TMZ) — anti-bot protection
- ❌ Government sites (FDA) — heavy JavaScript requirements
- ❌ Sports sites (Olympics.com) — anti-bot blocking
- ❌ Date-context questions — LLM doesn't know "current" date

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Intelligent Contract                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  gl.get_webpage(resolution_url)                  │   │
│  │  → Fetch resolution source                       │   │
│  │                                                  │   │
│  │  gl.exec_prompt(content + question)              │   │
│  │  → LLM determines YES/NO/UNRESOLVABLE            │   │
│  │                                                  │   │
│  │  Optimistic Democracy validates via validators   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Run Python benchmark (requires genlayer CLI + OpenAI key)
python benchmark_runner.py

# View dashboard
npm run dashboard
# → http://localhost:5050
```

## 📁 Structure

```
├── public/              # Static dashboard (Vercel deploy)
│   ├── index.html      # Dashboard UI
│   └── api/
│       └── results.json # Benchmark results
├── contracts/
│   └── market_resolver.py  # GenLayer Intelligent Contract
├── benchmark_runner.py  # Python benchmark script
└── README.md
```

## 🔮 Recommendations for GenLayer

1. **Add headless browser support** — `gl.get_webpage()` should handle JavaScript-heavy sites
2. **Implement anti-bot bypass** — Many real-world resolution sources have protection
3. **Date context injection** — LLM needs to know the "current" date for time-sensitive questions
4. **Multiple source verification** — Cross-reference multiple URLs for higher confidence

## 📝 License

MIT

---

Built by [argue.fun](https://argue.fun) — Feb 2026

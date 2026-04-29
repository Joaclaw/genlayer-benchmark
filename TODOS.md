# TODOs

Deferred work from Multi-URL Resolution Pipeline (2026-03-16).

---

## P1 - High Priority

### 1. Fix URL Discovery Rate Limiting

**What:** Add retry logic with exponential backoff for Exa API rate limits.

**Why:** Exa API returns 429 when hitting rate limits. Currently fails silently.

**Context:** In `app/api/resolve/discover/route.ts`, wrap the Exa call with retry logic. Try 3 times with 1s, 2s, 4s delays.

**Effort:** S (30 min)

---

## P2 - Medium Priority

### 2. Automated Test Suite

**What:** Add Jest tests for URL parsing, validation, and persistence logic.

**Why:** Currently using manual testing. Tests prevent regressions as pipeline evolves.

**Context:**
- URL validation: test anti-bot detection, content length checks
- Market API: test slug parsing, multi-market handling
- Persistence: test file sanitization, index updates

**Effort:** M (2-4 hours)

---

### 3. Batch Mode

**What:** Add ability to run pipeline on multiple markets sequentially.

**Why:** For systematic benchmarking across many markets.

**Context:**
- Add `/resolve/batch` page
- Upload JSON with market URLs
- Run pipeline on each, aggregate results
- Export CSV/JSON summary

**Effort:** L (1 day)

---

### 4. History Dashboard

**What:** Add `/resolve/history` page showing all past resolutions with stats.

**Why:** Track performance over time, identify patterns.

**Context:**
- Read from `data/resolutions/index.json`
- Show accuracy rate, common failure modes
- Filter by date, outcome, correctness

**Effort:** M (3-4 hours)

---

## P3 - Nice to Have

### 5. Manual URL Input

**What:** Allow user to manually provide URLs instead of auto-discovery.

**Why:** Useful when Exa fails or user knows better sources.

**Context:** Add "Use custom URLs" button in resolve flow. Show 3 URL input fields.

**Effort:** S (1 hour)

---

### 6. Source Reliability Tracking

**What:** Track which domains succeed/fail over time.

**Why:** Build domain whitelist/blacklist automatically.

**Context:** Store domain success rate in separate JSON. Surface in dashboard.

**Effort:** M (3 hours)

---

## Archive

Old TODOs from previous iterations moved to `archive/TODOS_old.md`.

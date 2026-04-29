# Using gstack Skills for GenLayer Benchmark

## What is gstack?

gstack is Garry Tan's (YC CEO) Claude Code skills that transform Claude Code from a generic assistant into **specialist modes**:

| Skill | Mode | What it does |
|-------|------|--------------|
| `/plan-ceo-review` | Founder/CEO | Rethink the problem. Find the 10-star product inside the request. |
| `/plan-eng-review` | Eng manager | Lock in architecture, data flow, diagrams, edge cases, tests. |
| `/review` | Paranoid engineer | Find bugs that pass CI but blow up in production. |
| `/ship` | Release engineer | Sync main, run tests, push, open PR. One command. |
| `/browse` | QA engineer | Browser automation - login, click, screenshot, verify. |
| `/qa` | QA + fix engineer | Test app, find bugs, fix them, re-verify. Before/after scores. |
| `/qa-only` | QA reporter | Report bugs without fixing anything. |
| `/setup-browser-cookies` | Session manager | Import cookies from your real browser for testing. |
| `/retro` | Engineering manager | Team retrospective with metrics and feedback. |

**Installed at:** `~/.claude/skills/gstack/`

---

## How to Use gstack Skills

### In Claude Code CLI

When running `claude` command, you can use these skills directly:

```bash
cd ~/Documents/Github/genlayer-benchmark

# Plan mode: Rethink the benchmark approach
claude "/plan-ceo-review: Review our Polymarket benchmark strategy"

# Engineering review: Lock in multi-URL architecture
claude "/plan-eng-review: Design the Exa + GenLayer multi-URL pipeline"

# Code review: Find bugs
claude "/review"

# Ship the changes
claude "/ship"

# Test the app
claude "/qa http://localhost:3000"
```

### In OpenClaw with Claude Code Sessions

When spawning Claude Code via `sessions_spawn`:

```typescript
sessions_spawn({
  task: "/plan-ceo-review: Is our market filtering strategy correct?",
  runtime: "acp",
  agentId: "claude",
  cwd: "~/Documents/Github/genlayer-benchmark"
})
```

---

## Applying gstack to GenLayer Benchmark

### Current State

We're building a multi-URL resolution system:
1. **Off-chain:** Exa AI finds 3 accessible URLs per market
2. **On-chain:** GenLayer contract fetches all 3, reaches consensus
3. **Frontend:** Live monitoring of pilot results

### How gstack Can Accelerate This

#### 1. `/plan-ceo-review` - Validate Product Direction

**Use when:** You're unsure if we're building the right thing.

```bash
claude "/plan-ceo-review: We're building a multi-URL consensus system for 
non-deterministic Polymarket markets. Is this the 10-star product or are 
we missing something bigger?"
```

**Expected output:**
- Challenge assumptions
- Identify the real problem (is it just URL quality or oracle trust?)
- Suggest transformative features (maybe: market creation from GenLayer? auto-resolution services?)

#### 2. `/plan-eng-review` - Lock Architecture

**Use when:** Before implementing major features.

```bash
claude "/plan-eng-review: Design the complete pipeline:
1. Polymarket API → fetch active non-deterministic markets
2. Exa search → find 3 accessible URLs
3. URL validator → mimic GenLayer constraints
4. GenLayer contract → multi-URL consensus
5. Frontend → live results display

Give me architecture diagrams, data flow, failure modes, test matrix."
```

**Expected output:**
- System architecture diagram
- State transition diagrams
- Edge cases documented
- Test coverage plan
- API boundaries clearly defined

#### 3. `/review` - Catch Production Bugs

**Use after:** Implementing URL discovery or contract logic.

```bash
claude "/review"
```

**Expected output:**
- Race conditions in parallel URL fetching?
- N+1 queries in market loading?
- Trust boundaries in Exa API responses?
- Retry logic for GenLayer contract calls?
- Data validation gaps?

#### 4. `/browse` + `/qa` - Automated Testing

**Use for:** Testing the live dashboard while pilot runs.

```bash
# Test the frontend
claude "/qa http://localhost:3000"

# Or test staging
claude "/browse https://genlayer-benchmark.vercel.app
Go to /analysis page, verify pilot monitor is updating every 2 seconds,
check if market results display correctly, screenshot any issues"
```

**Expected output:**
- Automated browser testing
- Screenshots of each page
- Console error detection
- Layout/responsiveness checks
- Before/after health scores

#### 5. `/ship` - One-Command Deployment

**Use when:** Feature is done, tests pass, ready to deploy.

```bash
claude "/ship"
```

**Expected output:**
- Syncs main branch
- Runs tests
- Pushes to GitHub
- Opens PR
- Updates Vercel deployment

#### 6. `/retro` - Track Progress

**Use weekly:** To understand velocity and team patterns.

```bash
claude "/retro"
```

**Expected output:**
- Commit analysis
- LOC shipped
- Test coverage trends
- Biggest wins
- Areas to improve

---

## Practical Workflow for Next Steps

### Scenario 1: Implementing Market Filtering

```bash
cd ~/Documents/Github/genlayer-benchmark

# 1. CEO review: Is our filtering strategy right?
claude "/plan-ceo-review: We're filtering Polymarket markets by:
- Non-deterministic (exclude crypto prices, sports, gov data)
- Closing today/tomorrow
- Volume > $1000
Is this the right approach or should we think bigger?"

# 2. If direction is good, get engineering plan
claude "/plan-eng-review: Design the market filtering pipeline with
Polymarket API integration, category detection, and time-based filtering"

# 3. Implement the code (normal coding)

# 4. Review for bugs
claude "/review"

# 5. Ship it
claude "/ship"
```

### Scenario 2: Testing Multi-URL Resolution

```bash
# 1. Start local dev server
npm run dev

# 2. Import your browser session for testing
claude "/setup-browser-cookies localhost:3000"

# 3. Run full QA pass
claude "/qa http://localhost:3000
Test the pilot monitor, verify URL discovery displays correctly,
check if GenLayer results update in real-time"

# 4. Fix any issues found

# 5. Ship to production
claude "/ship"

# 6. Test production
claude "/qa https://genlayer-benchmark.vercel.app"
```

### Scenario 3: Weekly Review

```bash
# At end of week, analyze progress
claude "/retro"
```

---

## Key Advantages for Our Project

### 1. **Faster Iteration**
- `/plan-ceo-review` prevents building the wrong thing
- `/plan-eng-review` catches design flaws before coding
- `/ship` eliminates manual release work

### 2. **Higher Quality**
- `/review` catches production bugs early
- `/qa` automates testing (no manual clicking)
- Consistent code review standards

### 3. **Better Monitoring**
- `/browse` lets Claude see the live app
- `/qa` generates health scores over time
- `/retro` tracks velocity and patterns

### 4. **Parallel Workflows**
- Multiple Claude Code sessions can use different skills simultaneously
- One session doing `/qa` on staging
- Another doing `/review` on a PR
- Another implementing new features
- Each with the right "brain" for the task

---

## Integration with OpenClaw

You can orchestrate multiple Claude Code sessions with different skills:

```typescript
// CEO review session
sessions_spawn({
  task: "/plan-ceo-review: Review our entire benchmark strategy",
  runtime: "acp",
  agentId: "claude",
  label: "ceo-review"
})

// Engineering session
sessions_spawn({
  task: "/plan-eng-review: Design the multi-URL consensus architecture",
  runtime: "acp",
  agentId: "claude",
  label: "eng-review"
})

// QA session
sessions_spawn({
  task: "/qa https://genlayer-benchmark.vercel.app",
  runtime: "acp",
  agentId: "claude",
  label: "qa-test"
})
```

This gives you **specialist agents working in parallel**, each with the right cognitive mode.

---

## Next Actions

### Immediate: Test gstack on Current Work

1. **Validate market filtering:**
   ```bash
   claude "/plan-ceo-review: Review our Polymarket market filtering strategy"
   ```

2. **Design URL discovery:**
   ```bash
   claude "/plan-eng-review: Architecture for Exa + URL validation + GenLayer integration"
   ```

3. **Test the frontend:**
   ```bash
   claude "/qa http://localhost:3000"
   ```

### Short-term: Integrate into Workflow

- Use `/review` before every PR
- Use `/ship` for every deployment
- Use `/qa` for every feature branch
- Weekly `/retro` to track progress

### Long-term: Scale with Parallel Sessions

When using [Conductor](https://conductor.build) or OpenClaw orchestration:
- Run 5-10 Claude Code sessions simultaneously
- Each with different gstack skill
- Cover planning, coding, review, QA, shipping in parallel

---

## Resources

- **Installed:** `~/.claude/skills/gstack/`
- **Documentation:** `~/.claude/skills/gstack/README.md`
- **Browser docs:** `~/.claude/skills/gstack/BROWSER.md`
- **Architecture:** `~/.claude/skills/gstack/ARCHITECTURE.md`
- **GitHub:** https://github.com/garrytan/gstack

**Upgrade:** Run `claude "/gstack-upgrade"` to get latest version.

**Uninstall:** See instructions in gstack README.

---

## Summary

gstack turns Claude Code from a generic assistant into **specialist modes on demand**. For the GenLayer benchmark:

- **Planning phase:** Use `/plan-ceo-review` and `/plan-eng-review`
- **Implementation:** Normal coding
- **Review:** Use `/review` to catch bugs
- **Testing:** Use `/qa` and `/browse` for automated testing
- **Shipping:** Use `/ship` for one-command deployment
- **Retrospective:** Use `/retro` weekly

This workflow can **10x your velocity** by giving Claude the right "brain" for each task.

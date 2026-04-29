# URL Accessibility Report
**Analysis of 949 Polymarket Resolution URLs**

## Summary

| Category | Count | % |
|----------|-------|---|
| Accessible | 78 | 8.2% |
| Web Access Issues | 255 | 26.9% |
| Content Issues | 206 | 21.7% |
| LLM Processing Issues | 410 | 43.2% |

---

## 1. Accessible URLs (78)

Successfully fetched and resolved content.

**Top Accessible Domains:**
- `speaker.gov` (12)
- `boxofficemojo.com` (11)
- `lmarena.ai` (9)
- `home.treasury.gov` (8)
- `fiscal.treasury.gov` (6)
- `nhc.noaa.gov` (5)
- `nbcwashington.com` (5)
- `whitehouse.gov` (3)
- `bea.gov` (3)
- `ibge.gov.br`, `federalreserve.gov`, `senate.gov`, `fda.gov`, `cdc.gov`, `bbc.com`, `fred.stlouisfed.org`

---

## 2. Web Driver / Access Issues (255)

### 2.1 HTTP 403 Forbidden (74)
Blocked by server or authentication required.

| Domain | Count | Notes |
|--------|-------|-------|
| `bls.gov` | 16 | Bureau of Labor Statistics |
| `atptour.com` | 9 | Sports site |
| `bloomberg.com` | 8 | Paywall |
| `faa.gov` | 7 | Government aviation data |
| `axios.com` | 7 | News site |
| `fire.ca.gov` | 6 | CA fire data |
| `telegraph.co.uk` | 4 | Paywall |
| `etherscan.io` | 2 | Blockchain explorer |
| `courtlistener.com` | 2 | Legal database |

### 2.2 Server Errors 5xx (78)
Server-side failures.

| Domain | Count | Notes |
|--------|-------|-------|
| `elections.ca` | 72 | Canadian elections |
| `nec.go.kr` | 6 | Korean elections |

### 2.3 Timeouts (15)
Connection timed out.

| Domain | Count |
|--------|-------|
| `oep.org.bo` | 12 |
| `nec.go.kr` | 2 |
| `the-numbers.com` | 1 |

### 2.4 Connection Errors (8)
Network/DNS failures.

### 2.5 Unknown Web Errors (78)
Unclassified HTTP failures.

### 2.6 Not Found 404 (2)
URL no longer exists.

---

## 3. Content Issues (206)

### 3.1 Empty Content (131)
Page loaded but no extractable text.

| Domain | Count | Notes |
|--------|-------|-------|
| `binance.com` | 13 | Heavy JS, dynamic content |
| `youtube.com` | 4 | Video platform |
| `the-numbers.com` | 3 | Box office data |

### 3.2 Anti-Bot / CAPTCHA (31)
Cloudflare, CAPTCHA, or bot detection blocked.

| Domain | Count | Notes |
|--------|-------|-------|
| `roaep.ro` | 27 | Romanian elections |
| `variety.com` | 1 | Entertainment |
| `billboard.com` | 1 | Music charts |
| `hollywoodreporter.com` | 1 | Entertainment |
| `polymarket.com` | 1 | Self-referential |

### 3.3 Insufficient Content (44)
Content too sparse to extract useful information.

---

## 4. LLM Processing Issues (410)

### 4.1 Unresolvable (407)
Content fetched but doesn't answer the market question.

**Common reasons:**
- URL provides related but not directly answering data
- Wrong data source for the specific question
- Historical data missing required timeframe
- Generic page without specific answer

### 4.2 No Answer (3)
LLM couldn't determine YES/NO from available content.

---

## Key Insights

1. **Government sites vary widely**: Treasury, NOAA, FDA accessible; BLS, FAA blocked
2. **News paywalls**: Bloomberg, Telegraph, LA Times consistently blocked
3. **Regional elections sites problematic**: Canadian, Korean, Romanian, Bolivian
4. **Dynamic JS sites fail**: Binance, YouTube yield empty content
5. **Anti-bot protection**: Romanian election site blocked 27 attempts
6. **Most failures are content-quality issues** (64.9%), not access issues

# GenLayer Development Reference

> **API Version:** v0.1.3+
> **SDK Docs:** https://sdk.genlayer.com
> **API Reference (AI):** https://sdk.genlayer.com/main/_static/ai/api.txt

## Quick Start

```python
from genlayer import *

class MyContract(gl.Contract):
    result: str
    
    def __init__(self, input_data: str):
        # Constructor-only pattern: all logic here
        self.result = self.process(input_data)
    
    @gl.public.view
    def get_result(self) -> str:
        return self.result
```

---

## Current API (v0.1.3+)

### Non-Deterministic Web Access

```python
# Render webpage (handles JavaScript)
content = gl.nondet.web.render(url, mode='text')
content = gl.nondet.web.render(url, mode='html')
screenshot = gl.nondet.web.render(url, mode='screenshot')

# HTTP methods (raw, no JS rendering)
response = gl.nondet.web.get(url, headers={})
response = gl.nondet.web.post(url, body=data, headers={})
response = gl.nondet.web.delete(url)
response = gl.nondet.web.patch(url, body=data)

# Response object
response.status  # int
response.headers  # dict[str, bytes]
response.body  # bytes | None
```

### LLM Execution

```python
# Basic prompt execution
result = gl.nondet.exec_prompt(prompt)  # returns str

# With JSON response
result = gl.nondet.exec_prompt(prompt, response_format='json')  # returns dict

# With images
result = gl.nondet.exec_prompt(prompt, images=[image_bytes])
```

### Equivalence Principles (Consensus)

```python
# Strict equality - validators must return identical results
result = gl.eq_principle.strict_eq(lambda: compute_value())

# Comparative - LLM compares results using principle
result = gl.eq_principle.prompt_comparative(
    lambda: fetch_and_process(),
    "Results are equivalent if they represent the same YES/NO answer"
)

# Non-comparative - validates task completion quality
result = gl.eq_principle.prompt_non_comparative(
    lambda: summarize(text),
    task="Summarize the article",
    criteria="Summary captures main points accurately"
)

# Lazy evaluation (deferred execution)
lazy_result = gl.eq_principle.strict_eq.lazy(lambda: expensive_op())
value = lazy_result.get()  # executes when needed
```

### VM Operations

```python
# Run with custom leader/validator logic
result = gl.vm.run_nondet(
    leader_fn=lambda: leader_computation(),
    validator_fn=lambda result: validate(result)
)

# Sandbox execution (isolated, catches errors)
result = gl.vm.spawn_sandbox(lambda: risky_operation())
value = gl.vm.unpack_result(result)  # raises on error

# Errors
raise gl.vm.UserError("Custom error message")
```

---

## Storage Types

```python
class MyContract(gl.Contract):
    # Primitives
    name: str
    count: u32
    amount: u256
    owner: Address
    active: bool
    
    # Collections (NOT list/dict!)
    items: DynArray[str]           # use instead of list
    balances: TreeMap[Address, u256]  # use instead of dict
    fixed: Array[u32, 10]          # fixed-size array
```

### Custom Storage Types

```python
@allow_storage
class MarketData:
    question: str
    resolved: bool
    outcome: str

class MyContract(gl.Contract):
    markets: TreeMap[str, MarketData]
```

---

## Constructor-Only Pattern (Recommended for Resolutions)

For single-execution tasks like market resolution, put all logic in `__init__`:

```python
class MarketResolver(gl.Contract):
    result: str
    
    def __init__(self, market_id: str, question: str, resolution_url: str):
        """
        Deploy → Execute → Done
        No need to call methods after deployment
        """
        try:
            content = gl.nondet.web.render(resolution_url, mode='text')
        except Exception as e:
            self.result = json.dumps({
                "market_id": market_id,
                "error": str(e),
                "resolution": "URL_INACCESSIBLE"
            })
            return
        
        resolution = gl.eq_principle.prompt_comparative(
            lambda: gl.nondet.exec_prompt(
                f"Content: {content[:6000]}\nQuestion: {question}\nAnswer YES, NO, or UNRESOLVABLE"
            ).strip().upper(),
            "Equivalent if same YES/NO/UNRESOLVABLE answer"
        )
        
        self.result = json.dumps({
            "market_id": market_id,
            "resolution": "YES" if "YES" in resolution else "NO" if "NO" in resolution else "UNRESOLVABLE"
        })
```

**Benefits:**
- Deploy once, get result
- No separate method call needed
- Monitor deployment tx for outcome
- Read `result` from contract state

---

## Scalable Market Resolution

### Batch Processing Architecture

```python
class BatchResolver(gl.Contract):
    results: TreeMap[str, str]
    
    def __init__(self, markets_json: str):
        """
        Deploy with JSON array of markets:
        [{"id": "m1", "question": "...", "url": "..."}, ...]
        """
        markets = json.loads(markets_json)
        
        for market in markets:
            try:
                content = gl.nondet.web.render(market["url"], mode='text')
                resolution = self._resolve(market["question"], content)
                self.results[market["id"]] = resolution
            except Exception as e:
                self.results[market["id"]] = f"ERROR: {e}"
    
    def _resolve(self, question: str, content: str) -> str:
        return gl.eq_principle.prompt_comparative(
            lambda: gl.nondet.exec_prompt(
                f"Content: {content[:5000]}\nQuestion: {question}\nAnswer: YES/NO/UNRESOLVABLE"
            ).strip().upper(),
            "Same answer"
        )
    
    @gl.public.view
    def get_results(self) -> str:
        return json.dumps(dict(self.results.items()))
```

### Parallel Deployment (External Orchestrator)

```typescript
// benchmark.ts - Deploy contracts in parallel
async function resolveMarkets(markets: Market[]): Promise<Result[]> {
  const deployments = markets.map(m => 
    client.deployContract({
      code: CONTRACT_CODE,
      args: [m.id, m.question, m.resolutionUrl]
    })
  );
  
  const results = await Promise.all(deployments);
  
  return results.map(async (tx, i) => {
    await tx.wait();
    const state = await client.getContractState(tx.contractAddress);
    return JSON.parse(state.result);
  });
}
```

---

## Common Linter Errors

### ❌ Using Python built-ins instead of GenLayer types

```python
# Wrong
balances: dict[str, int]
items: list[str]

# Correct
balances: TreeMap[str, u256]
items: DynArray[str]
```

### ❌ Missing type annotations

```python
# Wrong
def __init__(self):
    self.value = 0

# Correct
value: u256

def __init__(self):
    self.value = u256(0)
```

### ❌ Using old API (pre-v0.1.3)

```python
# OLD (deprecated)
gl.get_webpage(url, mode='text')
gl.exec_prompt(prompt)
gl.eq_principle_strict_eq(fn)

# NEW (v0.1.3+)
gl.nondet.web.render(url, mode='text')
gl.nondet.exec_prompt(prompt)
gl.eq_principle.strict_eq(fn)
```

### ❌ Non-serializable closures

```python
# Wrong - captures local variable
def process():
    return gl.vm.spawn_sandbox(lambda: use_local_var)

# Correct - use parameters
def process(data):
    return gl.vm.spawn_sandbox(lambda d=data: use(d))
```

### ❌ Unbounded loops in deterministic context

```python
# Wrong - may diverge across validators
while some_condition:
    process()

# Correct - bounded iteration
for i in range(MAX_ITERATIONS):
    if not some_condition:
        break
    process()
```

### ❌ Direct float usage in deterministic code

```python
# Wrong - floats are non-deterministic
price: float

# Correct - use fixed-point or u256
price: u256  # Store as wei/smallest unit
```

---

## Testing

### Local Development

```bash
# Install CLI
pip install genlayer

# Start local simulator
genlayer up

# Deploy contract
genlayer deploy contracts/my_contract.py --args '["arg1", "arg2"]'

# Check transaction
genlayer tx <tx_hash>
```

### Studionet (Public Testnet)

```typescript
import { createClient } from 'genlayer-js';

const client = createClient({ network: 'studionet' });

const tx = await client.deployContract({
  code: fs.readFileSync('contract.py'),
  args: ['arg1', 'arg2']
});

await tx.wait();
console.log('Contract:', tx.contractAddress);
```

**⚠️ Studionet Limitations:**
- `gl.nondet.web.render()` may be disabled
- Use localnet for full web access testing

---

## Resources

| Resource | URL |
|----------|-----|
| SDK Docs | https://sdk.genlayer.com |
| AI API Reference | https://sdk.genlayer.com/main/_static/ai/api.txt |
| Main Docs | https://docs.genlayer.com |
| GitHub | https://github.com/genlayerlabs |
| Examples | https://github.com/genlayerlabs/genvm/tree/main/examples |
| Discord | https://discord.gg/8Jm4v89VAu |

---

## Migration from v0.1.0

| Old API | New API (v0.1.3+) |
|---------|-------------------|
| `gl.get_webpage(url)` | `gl.nondet.web.render(url)` |
| `gl.exec_prompt(p)` | `gl.nondet.exec_prompt(p)` |
| `gl.eq_principle_strict_eq(fn)` | `gl.eq_principle.strict_eq(fn)` |
| `gl.eq_principle_prompt_comparative(fn, p)` | `gl.eq_principle.prompt_comparative(fn, p)` |
| `gl.ContractAt(addr)` | `gl.get_contract_at(addr)` |
| `gl.advanced.rollback_immediate(msg)` | `gl.advanced.user_error_immediate(msg)` |
| `gl.advanced.run_nondet(l, v)` | `gl.vm.run_nondet(l, v)` |
| `@gl.eth_contract` | `@gl.evm.contract_interface` |

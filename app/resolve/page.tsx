'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Market {
  id: string;
  question: string;
  description: string;
  outcome: string | null;
  end_date: string;
  resolved: boolean;
  slug: string;
  image?: string;
  markets?: Market[];
}

interface DiscoveredURL {
  url: string;
  title: string;
  domain: string;
  accessible?: boolean;
  relevant?: boolean;
  error?: string;
}

interface URLResponse {
  url: string;
  answer: string;
  reasoning: string;
  error?: string;
}

interface ConsensusResult {
  status: string;
  result: string;
  agree_count: number;
  total_validators: number;
  votes: string[];
}

interface ResolutionResult {
  final_answer: string;
  expected: string;
  correct: boolean;
  reasoning?: string;
  urls_fetched?: number;
  consensus?: ConsensusResult;
  // Legacy fields
  consensus_count?: number;
  url_responses?: URLResponse[];
}

interface Resolution {
  market: Market;
  discoveredUrls: DiscoveredURL[];
  validatedUrls: DiscoveredURL[];
  selectedUrls: string[];
  result: ResolutionResult | null;
  timestamp: string;
  logs: string[];
}

type Step = 'idle' | 'loading' | 'market_loaded' | 'discovering' | 'validating' | 'submitting' | 'complete' | 'error';

export default function ResolvePage() {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [market, setMarket] = useState<Market | null>(null);
  const [marketOptions, setMarketOptions] = useState<Market[] | null>(null);
  const [discoveredUrls, setDiscoveredUrls] = useState<DiscoveredURL[]>([]);
  const [validatedUrls, setValidatedUrls] = useState<DiscoveredURL[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [result, setResult] = useState<Resolution['result']>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'heading' | 'dim' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, `${type}|[${timestamp}] ${msg}`]);
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setMarket(null);
    setMarketOptions(null);
    setDiscoveredUrls([]);
    setValidatedUrls([]);
    setSelectedUrls([]);
    setResult(null);
    setLogs([]);
    setError(null);
  }, []);

  // Keyboard shortcut: Cmd+Enter to run pipeline
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (step === 'market_loaded' && market) {
          runPipeline();
        } else if (step === 'idle' && url.trim()) {
          loadMarket();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  async function loadMarket() {
    if (!url.trim()) return;

    reset();
    setStep('loading');
    addLog('Fetching market metadata from Polymarket...', 'heading');

    try {
      const res = await fetch('/api/resolve/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStep('error');
        addLog(`ERROR: ${data.error}`, 'error');
        return;
      }

      // Check if multiple markets returned (event page)
      if (data.markets && data.markets.length > 1) {
        setMarketOptions(data.markets);
        addLog(`Found ${data.markets.length} markets under this event`, 'info');
        setStep('idle');
        return;
      }

      setMarket(data.market);
      addLog(`Market: "${data.market.question}"`, 'success');
      addLog(`Status: ${data.market.resolved ? 'Resolved' : 'Active'} | Outcome: ${data.market.outcome || 'N/A'}`, 'dim');
      setStep('market_loaded');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch market';
      setError(msg);
      setStep('error');
      addLog(`ERROR: ${msg}`, 'error');
    }
  }

  function selectMarket(m: Market) {
    setMarket(m);
    setMarketOptions(null);
    addLog(`Selected: "${m.question}"`, 'success');
    addLog(`Status: ${m.resolved ? 'Resolved' : 'Active'} | Outcome: ${m.outcome || 'N/A'}`, 'dim');
    setStep('market_loaded');
  }

  async function runPipeline() {
    if (!market) return;

    const MAX_DISCOVERY_ATTEMPTS = 3;
    let allDiscoveredUrls: DiscoveredURL[] = [];
    let allValidatedUrls: DiscoveredURL[] = [];
    let validUrls: DiscoveredURL[] = [];
    let excludedDomains: string[] = [];
    let attemptNum = 0;

    // Discovery + Validation loop
    while (validUrls.length < 3 && attemptNum < MAX_DISCOVERY_ATTEMPTS) {
      attemptNum++;

      // Step 1: Discover
      setStep('discovering');
      if (attemptNum === 1) {
        addLog('', 'dim');
        addLog('STEP 1: URL DISCOVERY', 'heading');
      } else {
        addLog('', 'dim');
        addLog(`RETRY ${attemptNum}: Searching for more URLs...`, 'heading');
        addLog(`Excluding ${excludedDomains.length} failed domains`, 'dim');
      }
      addLog(`Searching for sources about: "${market.question}"`, 'info');

      try {
        const discRes = await fetch('/api/resolve/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market_id: market.id,
            question: market.question,
            outcome: market.outcome,
            description: market.description,
            endDate: market.end_date,
            excludeDomains: excludedDomains,
          }),
        });

        const discData = await discRes.json();

        if (discData.error) {
          setError(discData.error);
          setStep('error');
          addLog(`ERROR: ${discData.error}`, 'error');
          return;
        }

        const urls = discData.urls || [];

        if (urls.length === 0 && attemptNum === 1) {
          setError('No URLs found. Try a different market.');
          setStep('error');
          return;
        }

        if (urls.length > 0) {
          allDiscoveredUrls = [...allDiscoveredUrls, ...urls];
          setDiscoveredUrls(allDiscoveredUrls);

          addLog(`Found ${urls.length} new URLs:`, 'success');
          urls.forEach((u: DiscoveredURL, i: number) => {
            addLog(`  ${i + 1}. ${u.domain} - ${u.title?.slice(0, 50) || ''}`, 'dim');
          });

          // Step 2: Validate new URLs
          setStep('validating');
          if (attemptNum === 1) {
            addLog('', 'dim');
            addLog('STEP 2: URL VALIDATION', 'heading');
          }
          addLog('Checking accessibility and relevance...', 'info');

          const valRes = await fetch('/api/resolve/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: market.question,
              outcome: market.outcome,
              urls: urls,
            }),
          });

          const valData = await valRes.json();

          if (valData.error) {
            setError(valData.error);
            setStep('error');
            addLog(`ERROR: ${valData.error}`, 'error');
            return;
          }

          const validated = valData.urls || [];
          allValidatedUrls = [...allValidatedUrls, ...validated];
          setValidatedUrls(allValidatedUrls);

          // Show validation summary
          if (valData.summary) {
            const s = valData.summary;
            addLog(`Summary: ${s.accessible}/${s.total} accessible, ${s.answerBearing}/${s.total} answer-bearing`, 'dim');
          }

          validated.forEach((u: any) => {
            const status = u.accessible && u.relevant;
            const answerStatus = u.answerBearing ? '✓ has answer' : '○ no answer';
            addLog(`  [${status ? 'PASS' : 'FAIL'}] ${u.domain}: ${u.error || answerStatus}`, status ? 'success' : 'error');

            // Show snippet if available
            if (u.snippet && status) {
              addLog(`    "${u.snippet.slice(0, 100)}..."`, 'dim');
            }

            // Track failed domains for exclusion in next attempt
            if (!status && u.domain) {
              excludedDomains.push(u.domain);
            }
          });

          // Update valid URLs list - prioritize answer-bearing URLs
          const answerBearing = allValidatedUrls.filter((u: any) => u.accessible && u.answerBearing);
          const justRelevant = allValidatedUrls.filter((u: any) => u.accessible && u.relevant && !u.answerBearing);
          validUrls = [...answerBearing, ...justRelevant];

          const answerCount = answerBearing.length;
          addLog(`Valid so far: ${validUrls.length}/3 needed (${answerCount} with definitive answers)`, validUrls.length >= 3 ? 'success' : 'info');
        } else {
          addLog('No new URLs found in this search', 'dim');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Discovery failed';
        addLog(`Warning: ${msg}`, 'error');
      }

      // If we still need more URLs and have attempts left, continue the loop
      if (validUrls.length < 3 && attemptNum < MAX_DISCOVERY_ATTEMPTS) {
        addLog(`Need ${3 - validUrls.length} more valid URLs, retrying...`, 'info');
      }
    }

    const urlsToUse = validUrls.slice(0, 3).map((u: DiscoveredURL) => u.url);
    setSelectedUrls(urlsToUse);

    if (urlsToUse.length < 3) {
      setError(`Need 3 valid URLs for consensus, only found ${urlsToUse.length} after ${attemptNum} attempts`);
      setStep('error');
      addLog(`Failed: Only ${urlsToUse.length} valid URLs found after ${attemptNum} discovery attempts`, 'error');
      return;
    }

    addLog(`Success: Found ${validUrls.length} valid URLs`, 'success');

    // Step 3: Submit
    try {
      setStep('submitting');
      addLog('', 'dim');
      addLog('STEP 3: CONTRACT SUBMISSION', 'heading');
      addLog('Sending to GenLayer for Optimistic Democracy consensus...', 'info');
      addLog('This may take 30-60 seconds...', 'dim');

      const subRes = await fetch('/api/resolve/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: market.id,
          question: market.question,
          urls: urlsToUse,
          expected: market.outcome || 'Unknown',
        }),
      });

      const subData = await subRes.json();

      if (subData.error) {
        setError(subData.error);
        setStep('error');
        addLog(`ERROR: ${subData.error}`, 'error');
        return;
      }

      setResult(subData.result);
      setStep('complete');

      addLog('', 'dim');
      addLog('RESULT', 'heading');
      addLog(`Contract answer: ${subData.result.final_answer}`, 'info');
      addLog(`Expected: ${market.outcome || 'Unknown'}`, 'dim');
      addLog(`Correct: ${subData.result.correct ? 'YES' : 'NO'}`, subData.result.correct ? 'success' : 'error');

      // Display consensus info
      const consensus = subData.result.consensus;
      if (consensus) {
        addLog(`Consensus: ${consensus.agree_count}/${consensus.total_validators} validators agreed (${consensus.result})`, 'dim');
        if (consensus.votes?.length > 0) {
          addLog(`Votes: ${consensus.votes.join(', ')}`, 'dim');
        }
      }

      // Display reasoning
      if (subData.result.reasoning) {
        addLog('', 'dim');
        addLog('REASONING', 'heading');
        addLog(subData.result.reasoning, 'dim');
      }

      // Display URLs fetched
      if (subData.result.urls_fetched !== undefined) {
        addLog(`URLs fetched: ${subData.result.urls_fetched}/3`, 'dim');
      }

      // Save resolution
      saveResolution({
        market,
        discoveredUrls: allDiscoveredUrls,
        validatedUrls: allValidatedUrls,
        selectedUrls: urlsToUse,
        result: subData.result,
        timestamp: new Date().toISOString(),
        logs: [...logs],
      });

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pipeline failed';
      setError(msg);
      setStep('error');
      addLog(`ERROR: ${msg}`, 'error');
    }
  }

  async function saveResolution(resolution: Resolution) {
    try {
      await fetch('/api/resolve/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolution),
      });
      addLog('Resolution saved to data/resolutions/', 'dim');
    } catch {
      addLog('Warning: Could not save resolution', 'error');
    }
  }

  const isRunning = ['loading', 'discovering', 'validating', 'submitting'].includes(step);

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Multi-URL Resolution
      </h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '0.85rem' }}>
        Paste a Polymarket URL to test GenLayer consensus
      </p>

      {/* URL Input */}
      <div className="card">
        <label>Polymarket URL</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="url"
            placeholder="https://polymarket.com/event/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isRunning && loadMarket()}
            disabled={isRunning}
            style={{ flex: 1 }}
          />
          <button onClick={loadMarket} disabled={isRunning || !url.trim()}>
            {step === 'loading' ? 'Loading...' : 'Load'}
          </button>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          Cmd+Enter to load / run
        </div>
      </div>

      {/* Market Picker (for events with multiple markets) */}
      {marketOptions && (
        <div className="card">
          <label>Select a Market</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {marketOptions.map((m, i) => (
              <button
                key={m.id || i}
                onClick={() => selectMarket(m)}
                style={{ textAlign: 'left', padding: '1rem' }}
              >
                {m.question}
                {m.outcome && <span style={{ marginLeft: '0.5rem', color: m.outcome === 'Yes' ? 'var(--green)' : 'var(--red)' }}>({m.outcome})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Market Info */}
      {market && (
        <div className="market-card">
          {market.image && (
            <img src={market.image} alt="" className="market-image" />
          )}
          <div className="question">{market.question}</div>
          <div className="meta">
            <span className={`outcome ${market.outcome?.toLowerCase()}`}>
              {market.outcome || 'Active'}
            </span>
            <span>{market.resolved ? 'Resolved' : 'Active'}</span>
            {market.end_date && <span>Ends: {new Date(market.end_date).toLocaleDateString()}</span>}
          </div>
          {step === 'market_loaded' && (
            <button
              className="primary"
              onClick={runPipeline}
              style={{ marginTop: '1rem', width: '100%' }}
            >
              Run Resolution Pipeline
            </button>
          )}
        </div>
      )}

      {/* Pipeline Steps */}
      {step !== 'idle' && step !== 'loading' && !marketOptions && (
        <div style={{ marginTop: '1rem' }}>
          <Step num={1} label="Discover URLs" status={getStepStatus(step, 'discovering', discoveredUrls.length > 0)} />
          <Step num={2} label="Validate URLs" status={getStepStatus(step, 'validating', validatedUrls.length > 0)} />
          <Step num={3} label="Submit to Contract" status={getStepStatus(step, 'submitting', !!result)} />
        </div>
      )}

      {/* Terminal Log */}
      {logs.length > 0 && (
        <div className="terminal" style={{ marginTop: '1rem' }}>
          {logs.map((log, i) => {
            const [type, text] = log.split('|');
            return <div key={i} className={`line ${type}`}>{text}</div>;
          })}
          {isRunning && <div className="line pulsing">Processing...</div>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: '1rem' }}>
          <div className={`result-box ${result.correct ? 'success' : 'error'}`}>
            <div className="result-label">Result</div>
            <div className="result-value">{result.correct ? 'CORRECT' : 'INCORRECT'}</div>
            <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              Contract: <strong>{result.final_answer}</strong> | Expected: <strong>{result.expected}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              {result.consensus ? (
                <>Consensus: {result.consensus.agree_count}/{result.consensus.total_validators} validators ({result.consensus.result})</>
              ) : (
                <>URLs fetched: {result.urls_fetched || 0}/3</>
              )}
            </div>
            {result.reasoning && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Reasoning:</div>
                {result.reasoning}
              </div>
            )}
          </div>

          {/* Per-URL Results (legacy, may not be used) */}
          {result.url_responses && result.url_responses.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <label>Per-URL Responses</label>
              {result.url_responses.map((resp: any, i: number) => {
                let domain = 'unknown';
                try { domain = new URL(resp.url).hostname; } catch {}
                return (
                  <div key={i} className={`url-card ${resp.answer === 'YES' || resp.answer === 'NO' ? 'valid' : 'invalid'}`} style={{ marginBottom: '0.5rem' }}>
                    <div className="domain">{domain}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: resp.answer === 'YES' ? 'var(--green)' : resp.answer === 'NO' ? 'var(--red)' : 'var(--text-dim)' }}>
                        {resp.answer}
                      </span>
                    </div>
                    {resp.reasoning && (
                      <div className="title" style={{ marginTop: '0.5rem' }}>{resp.reasoning.slice(0, 150)}...</div>
                    )}
                    {resp.error && (
                      <div style={{ color: 'var(--red)', fontSize: '0.8rem' }}>Error: {resp.error}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && step === 'error' && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Reset */}
      {(step === 'complete' || step === 'error') && (
        <button onClick={reset} style={{ marginTop: '1rem' }}>
          Reset
        </button>
      )}
    </div>
  );
}

function Step({ num, label, status }: { num: number; label: string; status: 'pending' | 'active' | 'complete' | 'error' }) {
  return (
    <div className={`step ${status}`}>
      <div className="step-number">{status === 'complete' ? '✓' : num}</div>
      <div className="step-label">{label}</div>
      {status === 'active' && <span className="pulsing" style={{ color: 'var(--blue)' }}>...</span>}
    </div>
  );
}

function getStepStatus(currentStep: Step, thisStep: string, complete: boolean): 'pending' | 'active' | 'complete' | 'error' {
  if (currentStep === 'error') return 'error';
  if (complete) return 'complete';
  if (currentStep === thisStep) return 'active';
  return 'pending';
}

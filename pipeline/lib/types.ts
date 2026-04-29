/**
 * Shared types for the multi-URL benchmark pipeline
 */

// ============================================================================
// Market Types
// ============================================================================

export interface ResolvedMarket {
  id: string;
  question: string;
  description: string;
  outcome: 'Yes' | 'No';  // Polymarket ground truth
  end_date: string;       // ISO datetime
  resolution_url?: string; // Original Polymarket resolution URL (if any)
  category: WhitelistedCategory | 'excluded';
  category_reason: string;
}

export type WhitelistedCategory =
  | 'geopolitical'
  | 'technology'
  | 'politics'
  | 'business'
  | 'science';

// ============================================================================
// URL Discovery Types
// ============================================================================

export interface DiscoveredURL {
  url: string;
  title: string;
  domain: string;
  relevance_score: number;  // From Exa AI
}

export interface MarketURLs {
  market_id: string;
  question: string;
  outcome: 'Yes' | 'No';
  discovered_urls: DiscoveredURL[];
  discovery_status: 'success' | 'no_results' | 'api_error';
  discovery_error?: string;
}

// ============================================================================
// URL Validation Types
// ============================================================================

export type ValidationError =
  | 'http_timeout'
  | 'http_403_forbidden'
  | 'http_404_not_found'
  | 'http_5xx_server_error'
  | 'http_connection_error'
  | 'content_too_short'
  | 'content_anti_bot'
  | 'content_paywall'
  | 'relevance_check_failed'
  | 'relevance_irrelevant'
  | 'unknown_error';

export interface ValidatedURL {
  url: string;
  title: string;
  domain: string;
  accessible: boolean;
  relevant: boolean;
  validation_error?: ValidationError;
  content_preview?: string;  // First 200 chars of content
}

export interface MarketValidatedURLs {
  market_id: string;
  question: string;
  outcome: 'Yes' | 'No';
  validated_urls: ValidatedURL[];
  selected_urls: string[];  // Top 3 accessible + relevant URLs
  validation_status: 'sufficient' | 'insufficient_sources' | 'no_sources';
}

// ============================================================================
// Benchmark Result Types
// ============================================================================

export interface URLResponse {
  url: string;
  answer: 'YES' | 'NO' | 'ERROR' | 'UNRESOLVABLE';
  reasoning: string;
  content_preview: string;
  error?: string;
}

export interface BenchmarkResult {
  market_id: string;
  question: string;
  expected: 'Yes' | 'No';           // Polymarket ground truth
  urls_used: string[];              // 3 URLs submitted
  url_responses: URLResponse[];     // Per-URL results from contract
  final_answer: 'YES' | 'NO' | 'UNCERTAIN';
  correct: boolean;
  consensus_count: number;          // How many URLs agreed (2/3 or 3/3)
  urls_fetched: number;             // How many URLs were successfully fetched
  urls_failed: number;              // How many URLs failed to fetch
  reasoning: string;                // Combined reasoning
  timestamp: string;
}

export interface BenchmarkSkipped {
  market_id: string;
  question: string;
  expected: 'Yes' | 'No';
  skip_reason: 'insufficient_sources' | 'no_sources' | 'submission_error';
  error?: string;
}

export interface BenchmarkOutput {
  generated_at: string;
  contract_address: string;
  summary: {
    total_resolved_markets: number;
    markets_with_3_urls: number;
    markets_submitted: number;
    markets_skipped: number;

    // Accuracy metrics
    consensus_reached: number;      // Markets that got YES/NO (not UNCERTAIN)
    correct: number;
    incorrect: number;
    uncertain: number;
    accuracy_percent: number;       // correct / consensus_reached
    resolution_rate_percent: number; // consensus_reached / markets_submitted

    // URL metrics
    avg_urls_fetched: number;
    avg_consensus_count: number;
  };
  results: BenchmarkResult[];
  skipped: BenchmarkSkipped[];
}

// ============================================================================
// Pipeline Data Files
// ============================================================================

export interface ResolvedMarketsFile {
  generated_at: string;
  lookback_days: number;
  stats: {
    total_from_api: number;
    after_filter: number;
    by_category: Record<string, number>;
  };
  markets: ResolvedMarket[];
}

export interface DiscoveredURLsFile {
  generated_at: string;
  stats: {
    total_markets: number;
    with_urls: number;
    no_results: number;
    api_errors: number;
  };
  markets: MarketURLs[];
}

export interface ValidatedURLsFile {
  generated_at: string;
  stats: {
    total_markets: number;
    sufficient_sources: number;
    insufficient_sources: number;
    no_sources: number;

    // URL-level stats
    total_urls_checked: number;
    accessible_and_relevant: number;
    failed_accessibility: number;
    failed_relevance: number;
  };
  markets: MarketValidatedURLs[];
}

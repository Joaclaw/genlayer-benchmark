export interface PolymarketMarket {
  id: string;
  question: string;
  resolutionSource: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  createdAt: string;
  endDate: string;
  closed: boolean;
  resolvedBy: string;
  questionID?: string;
}

export interface BenchmarkResult {
  marketId: string;
  question: string;
  resolutionUrl: string;
  createdAt: string;
  endDate: string;
  volume: string;
  polymarketResolution: string;
  genlayerResolution: string | null;
  status: 'success' | 'error' | 'pending';
  match: boolean | null;
  error?: string;
  txHash?: string;
  contractAddress?: string;
  timestamp: string;
}

export interface BenchmarkState {
  startTime: string;
  endTime?: string;
  contractAddress?: string;
  markets: BenchmarkResult[];
  summary: {
    total: number;
    completed: number;
    matches: number;
    mismatches: number;
    errors: number;
    pending: number;
  };
}

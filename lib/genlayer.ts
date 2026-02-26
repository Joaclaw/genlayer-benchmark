'use client';

import { createClient, createAccount, chains } from 'genlayer-js';
import { CONTRACT_ADDRESS } from './constants';

const { studionet } = chains;

// Ensure we always use the production endpoint, not localhost
const studionetWithEndpoint = {
  ...studionet,
  rpcUrls: {
    default: {
      http: ['https://studio.genlayer.com/api']
    }
  }
};

let clientInstance: any = null;

export async function getGenLayerClient() {
  if (clientInstance) return clientInstance;
  
  const account = createAccount();
  const client = createClient({ 
    chain: studionetWithEndpoint,
    endpoint: 'https://studio.genlayer.com/api',
    account 
  }) as any;
  
  // Initialize consensus if method exists
  if (typeof client.initializeConsensusSmartContract === 'function') {
    await client.initializeConsensusSmartContract();
  }
  
  clientInstance = client;
  return client;
}

function parseGenLayerResult(payload: any): any {
  if (!payload) return null;
  if (payload.readable) payload = payload.readable;
  if (typeof payload !== 'string') return payload;
  
  // Try normal parse
  try {
    let parsed = JSON.parse(payload);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    // Fix malformed JSON (missing commas)
    let fixed = payload.replace(/""([a-z_])/gi, '","$1');
    fixed = fixed.replace(/(true|false|\d+)"([a-z_])/gi, '$1,"$2');
    fixed = fixed.replace(/:"""/g, ':"","');
    return JSON.parse(fixed);
  }
}

export async function getContractResults() {
  const client = await getGenLayerClient();
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_results',
    args: []
  });
  
  // Handle different return types
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  } else if (Array.isArray(raw)) {
    return raw;
  } else {
    return parseGenLayerResult(raw);
  }
}

export async function getResultCount() {
  const client = await getGenLayerClient();
  return await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_result_count',
    args: []
  });
}

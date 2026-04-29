import { NextResponse } from 'next/server';
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getContractAddress(): string | undefined {
  if (process.env.CONTRACT_ADDRESS) {
    return process.env.CONTRACT_ADDRESS;
  }
  const addrPath = join(process.cwd(), '.contract-address');
  if (existsSync(addrPath)) {
    const addr = readFileSync(addrPath, 'utf-8').trim();
    if (addr) return addr;
  }
  return undefined;
}

export async function POST(request: Request) {
  const CONTRACT_ADDRESS = getContractAddress();

  if (!CONTRACT_ADDRESS) {
    return NextResponse.json(
      { error: 'Contract address not found. Deploy the contract first or set CONTRACT_ADDRESS in .env' },
      { status: 500 }
    );
  }

  try {
    const { market_id, question, urls, expected } = await request.json();

    if (!market_id || !question || !urls || urls.length < 3 || !expected) {
      return NextResponse.json(
        { error: 'market_id, question, 3 urls, and expected are required' },
        { status: 400 }
      );
    }

    const account = createAccount();
    const client = createClient({
      chain: studionet,
      account,
    });

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'resolve_market',
      args: [
        market_id,
        question,
        urls[0],
        urls[1],
        urls[2],
        expected,
      ],
      value: BigInt(0),
    });

    console.log('[Submit] Transaction submitted:', txHash);

    // Wait for consensus (ACCEPTED or FINALIZED)
    let tx: any = null;
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes max (consensus can take time)

    while (attempts < maxAttempts) {
      try {
        tx = await client.getTransaction({ hash: txHash });
        const status = tx?.statusName || 'UNKNOWN';
        const resultName = tx?.result_name || 'UNKNOWN';

        console.log(`[Submit] Attempt ${attempts + 1}: ${status} / ${resultName}`);

        // Wait for consensus to complete
        if (status === 'ACCEPTED' || status === 'FINALIZED') {
          console.log('[Submit] Consensus reached:', resultName);
          break;
        }

        if (resultName === 'FAILURE' || status === 'FAILED') {
          console.log('[Submit] Transaction failed');
          break;
        }

      } catch (e) {
        console.log(`[Submit] Attempt ${attempts + 1} error:`, e);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!tx) {
      return NextResponse.json(
        { error: 'Failed to get transaction status', tx_hash: String(txHash) },
        { status: 500 }
      );
    }

    // Extract result
    let finalAnswer = 'UNCERTAIN';
    let reasoning = '';
    let urlsFetched = 0;

    const leaderReceipt = tx?.consensus_data?.leader_receipt?.[0];
    if (leaderReceipt?.result?.payload?.readable) {
      try {
        const readable = leaderReceipt.result.payload.readable;
        // Parse the outer JSON string
        let resultData = typeof readable === 'string' ? JSON.parse(readable) : readable;

        // If it's still a string (double-encoded), parse again
        if (typeof resultData === 'string') {
          resultData = JSON.parse(resultData);
        }

        finalAnswer = resultData.answer || 'UNCERTAIN';
        reasoning = resultData.reasoning || '';
        urlsFetched = resultData.urls_fetched || 0;

        console.log('[Submit] Parsed result:', { finalAnswer, reasoning, urlsFetched });
      } catch (e) {
        console.log('[Submit] Failed to parse result:', e);
        // Try to extract raw string
        const raw = leaderReceipt?.result?.payload?.readable;
        if (typeof raw === 'string' && (raw.includes('YES') || raw.includes('NO'))) {
          if (raw.includes('YES')) finalAnswer = 'YES';
          else if (raw.includes('NO')) finalAnswer = 'NO';
        }
      }
    }

    // Get validator vote counts
    const validatorVotes = tx?.last_round?.validator_votes_name || [];
    const agreeCount = validatorVotes.filter((v: string) => v === 'AGREE').length;
    const totalValidators = validatorVotes.length || (tx?.num_of_initial_validators || 5);

    // Normalize expected
    let expectedNorm = expected.toUpperCase().trim();
    if (expectedNorm === 'TRUE' || expectedNorm === '1') expectedNorm = 'YES';
    if (expectedNorm === 'FALSE' || expectedNorm === '0') expectedNorm = 'NO';

    const correct = finalAnswer === expectedNorm && finalAnswer !== 'UNCERTAIN';

    return NextResponse.json({
      tx_hash: String(txHash),
      result: {
        market_id,
        question,
        urls_used: urls,
        final_answer: finalAnswer,
        expected,
        correct,
        reasoning,
        urls_fetched: urlsFetched,
        consensus: {
          status: tx?.statusName || 'UNKNOWN',
          result: tx?.result_name || 'UNKNOWN',
          agree_count: agreeCount,
          total_validators: totalValidators,
          votes: validatorVotes,
        },
      },
    });

  } catch (error) {
    console.error('Contract submission error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Submission failed' },
      { status: 500 }
    );
  }
}

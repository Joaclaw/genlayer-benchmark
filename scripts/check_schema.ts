import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { join } from 'path';

async function checkSchema() {
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account,
  });

  const contractAddress = readFileSync(join(process.cwd(), '.contract-address'), 'utf-8').trim();
  console.log('Contract address:', contractAddress);

  try {
    const schema = await client.getContractSchema({
      address: contractAddress,
    });
    console.log('\nContract schema:');
    console.log(JSON.stringify(schema, null, 2));
  } catch (e) {
    console.error('Error getting schema:', e);
  }

  // Also try getting schema for code
  try {
    const contractCode = readFileSync(join(process.cwd(), 'pipeline', 'multi_url_resolver.py'), 'utf-8');
    const codeSchema = await client.getContractSchemaForCode({
      code: contractCode,
    });
    console.log('\nCode schema:');
    console.log(JSON.stringify(codeSchema, null, 2));
  } catch (e) {
    console.error('Error getting code schema:', e);
  }
}

checkSchema();

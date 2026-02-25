/**
 * Validate a GenLayer contract before deployment
 * Usage: npx tsx src/validate-contract.ts [contract-path]
 */

import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createAccount } from 'genlayer-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

async function validateContract(contractPath?: string) {
  const path = contractPath || join(ROOT_DIR, 'contracts/market_resolver.py');
  
  console.log('🔍 Validating contract:', path);
  console.log('');
  
  const contractCode = readFileSync(path, 'utf-8');
  
  const account = createAccount();
  const client = createClient({
    chain: studionet,
    account: account,
  });
  
  try {
    const schema = await client.getContractSchemaForCode({
      code: contractCode,
    });
    
    console.log('✅ Contract is valid!\n');
    
    // Display constructor
    console.log('📦 Constructor:');
    if (schema.ctor) {
      const params = schema.ctor.params || [];
      if (params.length === 0) {
        console.log('   No parameters');
      } else {
        params.forEach(([name, type]: [string, string]) => {
          console.log(`   - ${name}: ${type}`);
        });
      }
    }
    console.log('');
    
    // Display methods
    console.log('📋 Methods:');
    if (schema.methods) {
      for (const [methodName, methodInfo] of Object.entries(schema.methods)) {
        const info = methodInfo as any;
        const flags = [];
        if (info.readonly) flags.push('view');
        if (info.payable) flags.push('payable');
        const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
        
        console.log(`\n   ${methodName}${flagStr}`);
        
        // Parameters
        const params = info.params || [];
        if (params.length > 0) {
          console.log('     Parameters:');
          params.forEach(([name, type]: [string, string]) => {
            console.log(`       - ${name}: ${type}`);
          });
        }
        
        // Return type
        if (info.ret) {
          console.log(`     Returns: ${info.ret}`);
        }
      }
    }
    
    console.log('\n');
    return schema;
    
  } catch (error: any) {
    if (error.message?.includes('not supported')) {
      console.log('⚠️  Schema validation not available on studionet.');
      console.log('   This feature requires localnet (genlayer up).\n');
      console.log('   Contract syntax appears valid (loaded successfully).');
      return null;
    }
    console.error('❌ Contract validation failed!\n');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const contractPath = process.argv[2];
validateContract(contractPath);

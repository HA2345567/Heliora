import { solanaService } from './src/utils/solana-service';

async function test() {
  try {
    console.log('Testing SolanaService initialization...');
    const balance = await solanaService.getAgentBalance();
    console.log('Agent Balance:', balance, 'SOL');
    console.log('✅ SolanaService initialized successfully!');
  } catch (error) {
    console.error('❌ SolanaService initialization failed:', (error as Error).message);
  }
}

test();

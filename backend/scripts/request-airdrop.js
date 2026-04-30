const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function airdrop() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load agent keypair
  const keypairPath = path.resolve(__dirname, 'agent-keypair.json');
  if (!fs.existsSync(keypairPath)) {
    console.error('Agent keypair not found!');
    return;
  }
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
  const agentKeypair = Keypair.fromSecretKey(secretKey);
  const publicKey = agentKeypair.publicKey;
  
  console.log('Requesting airdrop for', publicKey.toBase58());
  try {
    const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    console.log('✅ Airdrop successful!');
    const balance = await connection.getBalance(publicKey);
    console.log('Current Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  } catch (error) {
    console.error('❌ Airdrop failed:', error.message);
    console.log('Please fund this address manually if the faucet is rate-limited:');
    console.log(publicKey.toBase58());
  }
}

airdrop();

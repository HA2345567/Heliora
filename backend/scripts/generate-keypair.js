const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const keypair = Keypair.generate();
const secretKey = Array.from(keypair.secretKey);
const publicKey = keypair.publicKey.toBase58();

const filePath = path.join(__dirname, 'agent-keypair.json');
fs.writeFileSync(filePath, JSON.stringify(secretKey));

console.log('✅ Agent Keypair Generated');
console.log('Public Key:', publicKey);
console.log('Secret Key saved to:', filePath);

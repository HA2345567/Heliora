import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export class SolanaService {
  private connection: Connection;
  private agentKeypair: Keypair;
  private program: anchor.Program;
  private programId: PublicKey;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load agent keypair
    const keypairPath = path.resolve(process.cwd(), process.env.AGENT_KEYPAIR_PATH || './scripts/agent-keypair.json');
    if (!fs.existsSync(keypairPath)) {
      throw new Error(`Agent keypair not found at ${keypairPath}`);
    }
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
    this.agentKeypair = Keypair.fromSecretKey(secretKey);

    this.programId = new PublicKey(process.env.PROGRAM_ID!);
    
    // Initialize Anchor Provider
    const wallet = new anchor.Wallet(this.agentKeypair);
    const provider = new anchor.AnchorProvider(this.connection, wallet, {
      preflightCommitment: 'confirmed',
    });

    // Load IDL
    const idlPath = path.resolve(process.cwd(), '../programs/heliora_market_factory/target/idl/heliora_market_factory.json');
    if (!fs.existsSync(idlPath)) {
       // Fallback for build environment
       console.warn('IDL not found at', idlPath);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    this.program = new anchor.Program(idl, provider);
  }

  async getAgentBalance() {
    const balance = await this.connection.getBalance(this.agentKeypair.publicKey);
    return balance / anchor.web3.LAMPORTS_PER_SOL;
  }

  async createMarketOnChain(marketData: {
    id: string;
    question: string;
    resolutionKind: string;
    endsAt: Date;
    liquiditySeed?: number;
  }) {
    try {
      console.log(`[SolanaService] Creating market on-chain: ${marketData.id}`);
      
      // Convert UUID/ID string to [u8; 16] for Anchor
      // (Simplified: using first 16 bytes of the string or a hash)
      const marketIdBytes = Buffer.alloc(16);
      Buffer.from(marketData.id.replace(/-/g, '').slice(0, 32), 'hex').copy(marketIdBytes);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), marketIdBytes],
        this.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), marketPda.toBuffer()],
        this.programId
      );

      // In a real production app, we would use a real USDC mint. 
      // For Devnet testing, we use a placeholder or the agent's SOL (wrapped).
      // Here we assume the program expects a collateral mint.
      const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // Devnet USDC placeholder

      const tx = await this.program.methods
        .createMarket(
          Array.from(marketIdBytes),
          marketData.question,
          marketData.resolutionKind,
          new anchor.BN(Math.floor(marketData.endsAt.getTime() / 1000)),
          new anchor.BN(marketData.liquiditySeed || 1000000) // 1 USDC if 6 decimals
        )
        .accounts({
          creator: this.agentKeypair.publicKey,
          market: marketPda,
          vault: vaultPda,
          collateralMint: collateralMint,
          // Note: In real app, we'd need to create/provide the creator_collateral token account
          // creatorCollateral: ...
        })
        .rpc();

      console.log(`✅ Market created on-chain. TX: ${tx}`);
      return { tx, marketPda: marketPda.toBase58() };
    } catch (error: any) {
      console.error(`❌ Failed to create market on-chain:`, error.message);
      throw error;
    }
  }

  async submitVoteOnChain(marketId: string, outcome: number, confidenceBps: number) {
    try {
      const marketIdBytes = Buffer.alloc(16);
      Buffer.from(marketId.replace(/-/g, '').slice(0, 32), 'hex').copy(marketIdBytes);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), marketIdBytes],
        this.programId
      );

      const [votePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('oracle_vote'), marketPda.toBuffer(), this.agentKeypair.publicKey.toBuffer()],
        this.programId
      );

      const tx = await this.program.methods
        .submitOracleVote(outcome, confidenceBps)
        .accounts({
          agentAuthority: this.agentKeypair.publicKey,
          market: marketPda,
          oracleVote: votePda,
        })
        .rpc();

      console.log(`✅ Oracle vote submitted on-chain. TX: ${tx}`);
      return tx;
    } catch (error: any) {
      console.error(`❌ Failed to submit vote on-chain:`, error.message);
      throw error;
    }
  }
}

export const solanaService = new SolanaService();

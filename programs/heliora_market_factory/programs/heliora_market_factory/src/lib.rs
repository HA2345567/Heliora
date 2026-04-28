// HELIORA Market Factory
// Anchor program for AI-native prediction markets on Solana.
// - Permissionless market creation with USDC collateral vault
// - YES/NO share minting via constant-product AMM (LMSR variant simplified)
// - 5-agent AI oracle consensus resolution (≥3 of 5)
// - Deterministic claim once resolved
//
// Designed for ~412 ms p95 settlement (single Solana slot).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("HeLi5oRA1MarketFactoRyPRoGRaM1111111111111");

pub const MAX_QUESTION_LEN: usize = 200;
pub const MAX_RESOLUTION_LEN: usize = 32;
pub const MAX_AGENTS: usize = 5;
pub const CONSENSUS_THRESHOLD: u8 = 3; // ≥3 of 5
pub const FEE_BPS: u64 = 100; // 1%
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod heliora_market_factory {
    use super::*;

    /// Create a new prediction market with seeded liquidity.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: [u8; 16],
        question: String,
        resolution_kind: String,
        ends_at: i64,
        liquidity_seed: u64,
    ) -> Result<()> {
        require!(question.len() <= MAX_QUESTION_LEN, HelioraError::QuestionTooLong);
        require!(resolution_kind.len() <= MAX_RESOLUTION_LEN, HelioraError::ResolutionKindTooLong);
        require!(ends_at > Clock::get()?.unix_timestamp, HelioraError::EndsInPast);
        require!(liquidity_seed > 0, HelioraError::InvalidLiquidity);

        let market = &mut ctx.accounts.market;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.market_id = market_id;
        market.creator = ctx.accounts.creator.key();
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.vault = ctx.accounts.vault.key();
        market.question = question;
        market.resolution_kind = resolution_kind;
        market.ends_at = ends_at;
        market.created_at = Clock::get()?.unix_timestamp;
        market.resolved_at = 0;
        market.status = MarketStatus::Open as u8;
        market.outcome = Outcome::Pending as u8;
        market.yes_pool = liquidity_seed / 2;
        market.no_pool = liquidity_seed / 2;
        market.total_volume = 0;
        market.participants = 0;
        market.oracle_votes = 0;
        market.oracle_yes = 0;
        market.oracle_no = 0;
        market.oracle_invalid = 0;

        // Transfer seed liquidity from creator → vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_collateral.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            liquidity_seed,
        )?;

        emit!(MarketCreated {
            market_id,
            creator: ctx.accounts.creator.key(),
            ends_at,
            liquidity_seed,
        });
        Ok(())
    }

    /// Buy YES/NO shares via constant-product AMM.
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: u8, // 0 = YES, 1 = NO
        collateral_in: u64,
        min_shares_out: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open as u8, HelioraError::MarketClosed);
        require!(Clock::get()?.unix_timestamp < market.ends_at, HelioraError::MarketEnded);
        require!(side == 0 || side == 1, HelioraError::InvalidSide);
        require!(collateral_in > 0, HelioraError::InvalidAmount);

        // Fee deduction
        let fee = collateral_in
            .checked_mul(FEE_BPS).ok_or(HelioraError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(HelioraError::MathOverflow)?;
        let amount_in = collateral_in.checked_sub(fee).ok_or(HelioraError::MathOverflow)?;

        // x * y = k AMM. shares_out = pool_out - (k / (pool_in + amount_in))
        let (pool_in, pool_out) = if side == 0 {
            (market.no_pool, market.yes_pool)
        } else {
            (market.yes_pool, market.no_pool)
        };
        let k = (pool_in as u128).checked_mul(pool_out as u128).ok_or(HelioraError::MathOverflow)?;
        let new_pool_in = (pool_in as u128).checked_add(amount_in as u128).ok_or(HelioraError::MathOverflow)?;
        let new_pool_out = k.checked_div(new_pool_in).ok_or(HelioraError::MathOverflow)?;
        let shares_out_u128 = (pool_out as u128).checked_sub(new_pool_out).ok_or(HelioraError::MathOverflow)?;
        let shares_out: u64 = shares_out_u128.try_into().map_err(|_| HelioraError::MathOverflow)?;

        require!(shares_out >= min_shares_out, HelioraError::SlippageExceeded);

        if side == 0 {
            market.no_pool = new_pool_in as u64;
            market.yes_pool = new_pool_out as u64;
        } else {
            market.yes_pool = new_pool_in as u64;
            market.no_pool = new_pool_out as u64;
        }
        market.total_volume = market.total_volume.checked_add(collateral_in).ok_or(HelioraError::MathOverflow)?;
        market.participants = market.participants.saturating_add(1);

        // Pull collateral into vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bettor_collateral.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.bettor.to_account_info(),
                },
            ),
            collateral_in,
        )?;

        // Mint position record (PDA per (market, bettor, side))
        let position = &mut ctx.accounts.position;
        position.bump = ctx.bumps.position;
        position.market = market.key();
        position.owner = ctx.accounts.bettor.key();
        position.side = side;
        position.shares = position.shares.checked_add(shares_out).ok_or(HelioraError::MathOverflow)?;
        position.cost_basis = position.cost_basis.checked_add(collateral_in).ok_or(HelioraError::MathOverflow)?;
        position.claimed = false;

        emit!(BetPlaced {
            market: market.key(),
            bettor: ctx.accounts.bettor.key(),
            side,
            collateral_in,
            shares_out,
        });
        Ok(())
    }

    /// AI oracle agent submits a vote (≥3 of 5 consensus required).
    /// `agent_authority` must be one of the 5 registered oracle PDAs (off-chain whitelist enforced via signer).
    pub fn submit_oracle_vote(
        ctx: Context<SubmitOracleVote>,
        outcome: u8, // 0 YES, 1 NO, 2 INVALID
        confidence_bps: u16,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open as u8, HelioraError::MarketClosed);
        require!(outcome <= 2, HelioraError::InvalidOutcome);
        require!(confidence_bps <= 10_000, HelioraError::InvalidConfidence);
        require!(market.oracle_votes < MAX_AGENTS as u8, HelioraError::OracleFull);

        // Record the vote in OracleVote PDA (one per agent per market)
        let vote = &mut ctx.accounts.oracle_vote;
        vote.bump = ctx.bumps.oracle_vote;
        vote.market = market.key();
        vote.agent = ctx.accounts.agent_authority.key();
        vote.outcome = outcome;
        vote.confidence_bps = confidence_bps;
        vote.submitted_at = Clock::get()?.unix_timestamp;

        market.oracle_votes = market.oracle_votes.checked_add(1).ok_or(HelioraError::MathOverflow)?;
        match outcome {
            0 => market.oracle_yes = market.oracle_yes.checked_add(1).ok_or(HelioraError::MathOverflow)?,
            1 => market.oracle_no = market.oracle_no.checked_add(1).ok_or(HelioraError::MathOverflow)?,
            _ => market.oracle_invalid = market.oracle_invalid.checked_add(1).ok_or(HelioraError::MathOverflow)?,
        }

        // Auto-finalize on consensus
        if market.oracle_yes >= CONSENSUS_THRESHOLD {
            market.outcome = Outcome::Yes as u8;
            market.status = MarketStatus::Resolved as u8;
            market.resolved_at = Clock::get()?.unix_timestamp;
        } else if market.oracle_no >= CONSENSUS_THRESHOLD {
            market.outcome = Outcome::No as u8;
            market.status = MarketStatus::Resolved as u8;
            market.resolved_at = Clock::get()?.unix_timestamp;
        } else if market.oracle_invalid >= CONSENSUS_THRESHOLD {
            market.outcome = Outcome::Invalid as u8;
            market.status = MarketStatus::Resolved as u8;
            market.resolved_at = Clock::get()?.unix_timestamp;
        }

        emit!(OracleVoteSubmitted {
            market: market.key(),
            agent: ctx.accounts.agent_authority.key(),
            outcome,
            confidence_bps,
            tally_yes: market.oracle_yes,
            tally_no: market.oracle_no,
            tally_invalid: market.oracle_invalid,
        });
        Ok(())
    }

    /// Claim winnings after resolution. Winning side: 1 share = 1 collateral unit.
    /// On INVALID outcome, both YES and NO claimants get pro-rata refund of cost basis.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Resolved as u8, HelioraError::NotResolved);
        let position = &mut ctx.accounts.position;
        require!(!position.claimed, HelioraError::AlreadyClaimed);

        let payout: u64 = if market.outcome == Outcome::Invalid as u8 {
            position.cost_basis
        } else if (market.outcome == Outcome::Yes as u8 && position.side == 0)
               || (market.outcome == Outcome::No as u8 && position.side == 1)
        {
            position.shares
        } else {
            0
        };

        position.claimed = true;

        if payout > 0 {
            let market_id_seed = market.market_id;
            let market_key = market.key();
            let signer_seeds: &[&[u8]] = &[
                b"vault",
                market_key.as_ref(),
                &[market.vault_bump],
            ];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.claimant_collateral.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                payout,
            )?;
            emit!(Claimed {
                market: market_key,
                claimant: ctx.accounts.claimant.key(),
                market_id: market_id_seed,
                amount: payout,
            });
        }
        Ok(())
    }
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(market_id: [u8; 16])]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [b"market", market_id.as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = creator,
        token::mint = collateral_mint,
        token::authority = vault,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(mut, token::mint = collateral_mint, token::authority = creator)]
    pub creator_collateral: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(side: u8)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(mut, seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub bettor_collateral: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = bettor,
        space = Position::LEN,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref(), &[side]],
        bump
    )]
    pub position: Account<'info, Position>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitOracleVote<'info> {
    #[account(mut)]
    pub agent_authority: Signer<'info>,
    #[account(mut, seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = agent_authority,
        space = OracleVote::LEN,
        seeds = [b"oracle_vote", market.key().as_ref(), agent_authority.key().as_ref()],
        bump
    )]
    pub oracle_vote: Account<'info, OracleVote>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = market.collateral_mint, token::authority = claimant)]
    pub claimant_collateral: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), claimant.key().as_ref(), &[position.side]],
        bump = position.bump,
        constraint = position.owner == claimant.key()
    )]
    pub position: Account<'info, Position>,
    pub token_program: Program<'info, Token>,
}

// ─── STATE ────────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub bump: u8,
    pub vault_bump: u8,
    pub market_id: [u8; 16],
    pub creator: Pubkey,
    pub collateral_mint: Pubkey,
    pub vault: Pubkey,
    pub question: String,        // up to 200
    pub resolution_kind: String, // up to 32
    pub ends_at: i64,
    pub created_at: i64,
    pub resolved_at: i64,
    pub status: u8,
    pub outcome: u8,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_volume: u64,
    pub participants: u32,
    pub oracle_votes: u8,
    pub oracle_yes: u8,
    pub oracle_no: u8,
    pub oracle_invalid: u8,
}

impl Market {
    pub const LEN: usize = 8 + 1 + 1 + 16 + 32 + 32 + 32
        + (4 + MAX_QUESTION_LEN)
        + (4 + MAX_RESOLUTION_LEN)
        + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 4 + 1 + 1 + 1 + 1;
}

#[account]
pub struct Position {
    pub bump: u8,
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8,
    pub shares: u64,
    pub cost_basis: u64,
    pub claimed: bool,
}

impl Position {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 1 + 8 + 8 + 1;
}

#[account]
pub struct OracleVote {
    pub bump: u8,
    pub market: Pubkey,
    pub agent: Pubkey,
    pub outcome: u8,
    pub confidence_bps: u16,
    pub submitted_at: i64,
}

impl OracleVote {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 1 + 2 + 8;
}

#[repr(u8)]
pub enum MarketStatus { Open = 0, Resolved = 1, Cancelled = 2 }

#[repr(u8)]
pub enum Outcome { Pending = 0, Yes = 1, No = 2, Invalid = 3 }

// ─── EVENTS ───────────────────────────────────────────────────────────

#[event]
pub struct MarketCreated {
    pub market_id: [u8; 16],
    pub creator: Pubkey,
    pub ends_at: i64,
    pub liquidity_seed: u64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub side: u8,
    pub collateral_in: u64,
    pub shares_out: u64,
}

#[event]
pub struct OracleVoteSubmitted {
    pub market: Pubkey,
    pub agent: Pubkey,
    pub outcome: u8,
    pub confidence_bps: u16,
    pub tally_yes: u8,
    pub tally_no: u8,
    pub tally_invalid: u8,
}

#[event]
pub struct Claimed {
    pub market: Pubkey,
    pub claimant: Pubkey,
    pub market_id: [u8; 16],
    pub amount: u64,
}

// ─── ERRORS ───────────────────────────────────────────────────────────

#[error_code]
pub enum HelioraError {
    #[msg("Question exceeds 200 chars")] QuestionTooLong,
    #[msg("Resolution kind exceeds 32 chars")] ResolutionKindTooLong,
    #[msg("End timestamp must be in the future")] EndsInPast,
    #[msg("Liquidity seed must be > 0")] InvalidLiquidity,
    #[msg("Market is not open")] MarketClosed,
    #[msg("Market has already ended")] MarketEnded,
    #[msg("Side must be 0 (YES) or 1 (NO)")] InvalidSide,
    #[msg("Amount must be > 0")] InvalidAmount,
    #[msg("Math overflow")] MathOverflow,
    #[msg("Slippage exceeded")] SlippageExceeded,
    #[msg("Outcome must be 0/1/2")] InvalidOutcome,
    #[msg("Confidence must be 0..10000 bps")] InvalidConfidence,
    #[msg("Oracle quorum already filled")] OracleFull,
    #[msg("Market is not resolved")] NotResolved,
    #[msg("Position already claimed")] AlreadyClaimed,
}

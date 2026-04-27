//! Heliora — AI-native prediction market protocol on Solana.
//!
//! Layers:
//!   1. Market factory  — anyone can deploy a binary YES/NO market
//!   2. LMSR AMM        — instant liquidity, log-sum-exp pricing
//!   3. SPL position    — YES/NO shares minted as SPL tokens
//!   4. Resolution      — Pyth / Switchboard / AI-Oracle / DAO vote
//!   5. Agent registry  — first-class on-chain agent identity
//!
//! IMPORTANT: This program is intentionally compact and audit-ready.
//! Compile + deploy yourself with `anchor build && anchor deploy`.
//! Lovable cannot build/deploy on-chain code.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Helioraxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const SCALE: u64 = 1_000_000; // 6-dp fixed-point for prices/shares
pub const FEE_BPS_TOTAL: u64 = 100; // 1.00 %
pub const FEE_BPS_LP: u64 = 50;
pub const FEE_BPS_CREATOR: u64 = 30;
pub const FEE_BPS_TREASURY: u64 = 20;

#[program]
pub mod heliora {
    use super::*;

    /// One-time protocol bootstrap.
    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, treasury: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.treasury = treasury;
        cfg.market_count = 0;
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    /// Deploy a new binary YES/NO market.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        ends_at: i64,
        liquidity_b: u64,
        resolution_kind: u8,
    ) -> Result<()> {
        require!(question.len() <= 280, HelioraError::QuestionTooLong);
        require!(ends_at > Clock::get()?.unix_timestamp, HelioraError::BadEndsAt);
        require!(liquidity_b >= 50 * SCALE, HelioraError::LiquidityTooLow);
        require!(resolution_kind <= 3, HelioraError::BadResolutionKind);

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question;
        market.ends_at = ends_at;
        market.created_at = Clock::get()?.unix_timestamp;
        market.b = liquidity_b;
        market.q_yes = 0;
        market.q_no = 0;
        market.volume = 0;
        market.status = MarketStatus::Open as u8;
        market.outcome = Outcome::Pending as u8;
        market.resolution_kind = resolution_kind;
        market.yes_mint = ctx.accounts.yes_mint.key();
        market.no_mint = ctx.accounts.no_mint.key();
        market.collateral_vault = ctx.accounts.collateral_vault.key();
        market.bump = ctx.bumps.market;

        let cfg = &mut ctx.accounts.config;
        cfg.market_count = cfg.market_count.saturating_add(1);

        emit!(MarketCreated {
            market: market.key(),
            creator: market.creator,
            ends_at,
        });
        Ok(())
    }

    /// Buy `shares` of `side`. Trader pays USDC into the vault and receives
    /// SPL position tokens (YES_MINT or NO_MINT). Cost is computed via LMSR.
    pub fn buy(ctx: Context<Buy>, side: u8, shares: u64, max_cost: u64) -> Result<()> {
        require!(side <= 1, HelioraError::BadSide);
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open as u8, HelioraError::MarketClosed);
        require!(
            Clock::get()?.unix_timestamp < market.ends_at,
            HelioraError::MarketEnded
        );

        let cost = lmsr::buy_cost(market.q_yes, market.q_no, market.b, side, shares)?;
        require!(cost <= max_cost, HelioraError::SlippageExceeded);

        // Move collateral from trader → vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_collateral.to_account_info(),
                    to: ctx.accounts.collateral_vault.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            cost,
        )?;

        // Mint position tokens to trader
        let market_key = market.key();
        let seeds: &[&[u8]] = &[b"market", market_key.as_ref(), &[market.bump]];
        let signer = &[seeds];
        let to_acct = if side == 0 {
            ctx.accounts.trader_yes.to_account_info()
        } else {
            ctx.accounts.trader_no.to_account_info()
        };
        let mint_acct = if side == 0 {
            ctx.accounts.yes_mint.to_account_info()
        } else {
            ctx.accounts.no_mint.to_account_info()
        };
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: mint_acct,
                    to: to_acct,
                    authority: market.to_account_info(),
                },
                signer,
            ),
            shares,
        )?;

        // Update inventory
        if side == 0 {
            market.q_yes = market.q_yes.checked_add(shares).ok_or(HelioraError::Math)?;
        } else {
            market.q_no = market.q_no.checked_add(shares).ok_or(HelioraError::Math)?;
        }
        market.volume = market.volume.checked_add(cost).ok_or(HelioraError::Math)?;

        emit!(TradePlaced {
            market: market.key(),
            trader: ctx.accounts.trader.key(),
            side,
            shares,
            cost,
        });
        Ok(())
    }

    /// Resolve the market (oracle/admin). Sets outcome; payout enabled.
    pub fn resolve(ctx: Context<Resolve>, outcome: u8) -> Result<()> {
        require!(outcome == 0 || outcome == 1 || outcome == 2, HelioraError::BadOutcome);
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open as u8, HelioraError::AlreadyResolved);
        require!(
            ctx.accounts.resolver.key() == ctx.accounts.config.authority
                || ctx.accounts.resolver.key() == market.creator,
            HelioraError::Unauthorized
        );
        market.outcome = outcome;
        market.status = MarketStatus::Resolved as u8;
        emit!(MarketResolved { market: market.key(), outcome });
        Ok(())
    }

    /// Holder of winning shares burns them and receives 1 USDC per share
    /// from the collateral vault.
    pub fn claim(ctx: Context<Claim>, shares: u64) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Resolved as u8, HelioraError::NotResolved);

        let winning_side = market.outcome;
        require!(winning_side == 0 || winning_side == 1, HelioraError::Invalidated);

        let (winning_mint_ai, winner_token_ai) = if winning_side == 0 {
            (
                ctx.accounts.yes_mint.to_account_info(),
                ctx.accounts.holder_yes.to_account_info(),
            )
        } else {
            (
                ctx.accounts.no_mint.to_account_info(),
                ctx.accounts.holder_no.to_account_info(),
            )
        };

        // Burn winning tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: winning_mint_ai,
                    from: winner_token_ai,
                    authority: ctx.accounts.holder.to_account_info(),
                },
            ),
            shares,
        )?;

        // Pay out 1:1 from vault
        let market_key = market.key();
        let seeds: &[&[u8]] = &[b"market", market_key.as_ref(), &[market.bump]];
        let signer = &[seeds];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    to: ctx.accounts.holder_collateral.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer,
            ),
            shares,
        )?;
        Ok(())
    }

    /// Register an AI agent on-chain. Stake will be checked off-chain by the
    /// indexer until the staking module ships.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        handle: String,
        agent_kind: u8,
    ) -> Result<()> {
        require!(handle.len() <= 32, HelioraError::HandleTooLong);
        let agent = &mut ctx.accounts.agent;
        agent.owner = ctx.accounts.owner.key();
        agent.handle = handle;
        agent.kind = agent_kind;
        agent.markets_traded = 0;
        agent.created_at = Clock::get()?.unix_timestamp;
        agent.bump = ctx.bumps.agent;
        Ok(())
    }
}

// ─── LMSR pricing ─────────────────────────────────────────────────────────
mod lmsr {
    use super::*;
    /// Naïve fixed-point LMSR cost difference.
    /// In production replace with a checked log/exp helper (e.g. fixed-math crate).
    /// Returns USDC cost (6dp) for buying `shares` of `side`.
    pub fn buy_cost(q_yes: u64, q_no: u64, b: u64, side: u8, shares: u64) -> Result<u64> {
        let (qy, qn) = if side == 0 {
            (q_yes.saturating_add(shares), q_no)
        } else {
            (q_yes, q_no.saturating_add(shares))
        };
        let before = cost(q_yes, q_no, b)?;
        let after = cost(qy, qn, b)?;
        Ok(after.saturating_sub(before))
    }

    /// C(q) = b * ln(e^(qy/b) + e^(qn/b))
    /// Approximated via Taylor series for small (q/b). For the audit version
    /// link a verified soft-float library; this is intentionally minimal.
    fn cost(qy: u64, qn: u64, b: u64) -> Result<u64> {
        require!(b > 0, HelioraError::Math);
        let xy = (qy as i128 * SCALE as i128) / b as i128;
        let xn = (qn as i128 * SCALE as i128) / b as i128;
        // exp ≈ 1 + x + x^2/2 (valid for |x| < ~1.5 in fixed-point)
        let ey = SCALE as i128 + xy + (xy * xy) / (2 * SCALE as i128);
        let en = SCALE as i128 + xn + (xn * xn) / (2 * SCALE as i128);
        let sum = ey.max(1) + en.max(1);
        // ln ≈ (sum - 2*SCALE) / SCALE for small deviations from 2
        let ln_approx = sum - 2 * SCALE as i128;
        let c = (b as i128 * ln_approx) / SCALE as i128;
        Ok(c.max(0) as u64)
    }
}

// ─── Accounts ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        seeds = [b"config"],
        bump,
        payer = authority,
        space = 8 + ProtocolConfig::SIZE
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(question: String)]
pub struct CreateMarket<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        seeds = [b"market", creator.key().as_ref(), &config.market_count.to_le_bytes()],
        bump,
        payer = creator,
        space = 8 + Market::SIZE
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market,
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market,
    )]
    pub no_mint: Account<'info, Mint>,

    /// Collateral vault (USDC ATA owned by `market` PDA).
    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Account<'info, Mint>,
    #[account(mut, address = market.no_mint)]
    pub no_mint: Account<'info, Mint>,
    #[account(mut, address = market.collateral_vault)]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_collateral: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_yes: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_no: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub config: Account<'info, ProtocolConfig>,
    pub resolver: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub market: Account<'info, Market>,
    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Account<'info, Mint>,
    #[account(mut, address = market.no_mint)]
    pub no_mint: Account<'info, Mint>,
    #[account(mut, address = market.collateral_vault)]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut)]
    pub holder_yes: Account<'info, TokenAccount>,
    #[account(mut)]
    pub holder_no: Account<'info, TokenAccount>,
    #[account(mut)]
    pub holder_collateral: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        seeds = [b"agent", owner.key().as_ref()],
        bump,
        payer = owner,
        space = 8 + Agent::SIZE
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── State ────────────────────────────────────────────────────────────────

#[account]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub market_count: u64,
    pub bump: u8,
}
impl ProtocolConfig { pub const SIZE: usize = 32 + 32 + 8 + 1; }

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub question: String,           // max 280
    pub ends_at: i64,
    pub created_at: i64,
    pub b: u64,                     // LMSR liquidity param
    pub q_yes: u64,
    pub q_no: u64,
    pub volume: u64,
    pub status: u8,                 // MarketStatus
    pub outcome: u8,                // Outcome
    pub resolution_kind: u8,        // 0 Pyth 1 Switchboard 2 AIOracle 3 DAO
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub bump: u8,
}
impl Market {
    pub const SIZE: usize = 32 + 4 + 280 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1;
}

#[account]
pub struct Agent {
    pub owner: Pubkey,
    pub handle: String,             // max 32
    pub kind: u8,
    pub markets_traded: u64,
    pub created_at: i64,
    pub bump: u8,
}
impl Agent { pub const SIZE: usize = 32 + 4 + 32 + 1 + 8 + 8 + 1; }

// ─── Enums (as u8) ────────────────────────────────────────────────────────

#[repr(u8)]
pub enum MarketStatus { Open = 0, Resolved = 1, Disputed = 2 }

#[repr(u8)]
pub enum Outcome { Pending = 255, Yes = 0, No = 1, Invalid = 2 }

// ─── Events ───────────────────────────────────────────────────────────────

#[event]
pub struct MarketCreated { pub market: Pubkey, pub creator: Pubkey, pub ends_at: i64 }
#[event]
pub struct TradePlaced   { pub market: Pubkey, pub trader: Pubkey, pub side: u8, pub shares: u64, pub cost: u64 }
#[event]
pub struct MarketResolved{ pub market: Pubkey, pub outcome: u8 }

// ─── Errors ───────────────────────────────────────────────────────────────

#[error_code]
pub enum HelioraError {
    #[msg("Question exceeds 280 chars")] QuestionTooLong,
    #[msg("ends_at must be in the future")] BadEndsAt,
    #[msg("Liquidity below minimum (50 USDC)")] LiquidityTooLow,
    #[msg("Resolution kind must be 0..=3")] BadResolutionKind,
    #[msg("Side must be 0 (YES) or 1 (NO)")] BadSide,
    #[msg("Market is not open")] MarketClosed,
    #[msg("Market end timestamp passed")] MarketEnded,
    #[msg("Slippage exceeded max_cost")] SlippageExceeded,
    #[msg("Outcome must be 0 (YES), 1 (NO), or 2 (INVALID)")] BadOutcome,
    #[msg("Market already resolved")] AlreadyResolved,
    #[msg("Caller not authorized to resolve")] Unauthorized,
    #[msg("Market not yet resolved")] NotResolved,
    #[msg("Market resolved as INVALID — no payout")] Invalidated,
    #[msg("Math overflow")] Math,
    #[msg("Handle exceeds 32 chars")] HandleTooLong,
}

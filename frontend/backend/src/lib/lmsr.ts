/**
 * Logarithmic Market Scoring Rule (LMSR) — Hanson 2003.
 * Pricing helpers for a binary YES/NO market.
 *
 * Cost function:  C(q) = b * ln( e^(qYes/b) + e^(qNo/b) )
 * Price of YES:   p_yes = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
 *
 * `b` controls liquidity. Higher b => deeper book, less price impact.
 */

export interface MarketState {
  qYes: number;
  qNo: number;
  b: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function cost({ qYes, qNo, b }: MarketState): number {
  // numerically stable log-sum-exp
  const m = Math.max(qYes, qNo) / b;
  return b * (m + Math.log(Math.exp(qYes / b - m) + Math.exp(qNo / b - m)));
}

export function priceYes({ qYes, qNo, b }: MarketState): number {
  const a = qYes / b;
  const c = qNo / b;
  const m = Math.max(a, c);
  const ea = Math.exp(a - m);
  const ec = Math.exp(c - m);
  return clamp(ea / (ea + ec), 0.001, 0.999);
}

export function priceNo(state: MarketState): number {
  return 1 - priceYes(state);
}

/**
 * Cost to buy `shares` of side. Returns USDC cost (>= 0).
 */
export function buyCost(
  state: MarketState,
  side: "YES" | "NO",
  shares: number,
): number {
  if (shares <= 0) return 0;
  const next: MarketState = {
    ...state,
    qYes: side === "YES" ? state.qYes + shares : state.qYes,
    qNo: side === "NO" ? state.qNo + shares : state.qNo,
  };
  return cost(next) - cost(state);
}

/** Average fill price for an order (cost / shares). */
export function avgFillPrice(
  state: MarketState,
  side: "YES" | "NO",
  shares: number,
): number {
  if (shares <= 0) return side === "YES" ? priceYes(state) : priceNo(state);
  return buyCost(state, side, shares) / shares;
}

export function applyTrade(
  state: MarketState,
  side: "YES" | "NO",
  shares: number,
): MarketState {
  return {
    ...state,
    qYes: side === "YES" ? state.qYes + shares : state.qYes,
    qNo: side === "NO" ? state.qNo + shares : state.qNo,
  };
}

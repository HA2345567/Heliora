import nacl from "tweetnacl";
import bs58 from "bs58";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma.js";
import { HttpError } from "../middleware/error.js";

/**
 * Sign-In With Solana (SIWS-lite).
 * Client signs `Heliora login: <wallet>:<nonce>` and sends { wallet, signature, nonce }.
 * We verify ed25519 against the wallet pubkey.
 */
export function verifySolanaSignature(
  wallet: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pub = bs58.decode(wallet);
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

export interface AuthedRequest extends Request {
  user?: { id: string; wallet: string };
}

/**
 * Soft auth: trusts `x-wallet` header for read endpoints (preview / dev).
 * For writes that mutate funds, callers should use the /api/auth/login flow
 * and present the returned session (out of scope for this scaffold).
 */
export async function attachUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const wallet = req.header("x-wallet");
  if (!wallet) return next();
  const user = await prisma.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet },
  });
  req.user = { id: user.id, wallet: user.wallet };
  next();
}

export function requireUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, "wallet required (x-wallet header)");
  next();
}

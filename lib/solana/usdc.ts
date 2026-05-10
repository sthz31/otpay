import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export const DEVNET_USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_DEVNET_USDC_MINT ??
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export type SettlementRequest = {
  senderWalletAddress: string;
  recipientWalletAddress: string;
  amount: string;
};

const USDC_DECIMALS = 6;

export async function prepareUsdcTransfer(request: SettlementRequest) {
  return {
    ...request,
    rpcUrl: SOLANA_RPC_URL,
    mintAddress: DEVNET_USDC_MINT.toBase58(),
  };
}

export function usdcAmountToBaseUnits(amount: string | number) {
  const value = String(amount).trim();

  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimals.");
  }

  const [whole, fractional = ""] = value.split(".");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(USDC_DECIMALS) +
    BigInt(fractional.padEnd(USDC_DECIMALS, "0"))
  );
}

export async function buildUsdcTransferTransaction(request: SettlementRequest) {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const payer = new PublicKey(request.senderWalletAddress);
  const recipient = new PublicKey(request.recipientWalletAddress);
  const sourceAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, payer);
  const destinationAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, recipient);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: payer,
    recentBlockhash: blockhash,
  }).add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      destinationAta,
      recipient,
      DEVNET_USDC_MINT,
    ),
    createTransferCheckedInstruction(
      sourceAta,
      DEVNET_USDC_MINT,
      destinationAta,
      payer,
      usdcAmountToBaseUnits(request.amount),
      USDC_DECIMALS,
    ),
  );

  return {
    transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
    blockhash,
    lastValidBlockHeight,
    sourceAta: sourceAta.toBase58(),
    destinationAta: destinationAta.toBase58(),
    rpcUrl: SOLANA_RPC_URL,
    mintAddress: DEVNET_USDC_MINT.toBase58(),
  };
}

/**
 * Checks if a wallet has at least the required amount of USDC.
 * @param walletAddress The wallet public key (base58 string)
 * @param amount The required amount (as a string, e.g. "1.5")
 * @returns true if the wallet has enough USDC, false otherwise
 */
export async function hasSufficientUsdc(
  walletAddress: string,
  amount: string
): Promise<boolean> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const owner = new PublicKey(walletAddress);
  const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, owner);

  const accountInfo = await connection.getTokenAccountBalance(ata).catch(() => null);
  if (!accountInfo) return false;

  // USDC usually has 6 decimals
  const balance = parseFloat(accountInfo.value.uiAmountString || "0");
  const required = parseFloat(amount);

  return balance >= required;
}

import { PublicKey } from "@solana/web3.js";

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

export async function prepareUsdcTransfer(request: SettlementRequest) {
  return {
    ...request,
    rpcUrl: SOLANA_RPC_URL,
    mintAddress: DEVNET_USDC_MINT.toBase58(),
  };
}

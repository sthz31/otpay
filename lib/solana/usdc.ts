import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
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
const LAMPORTS_PER_SOL = 1_000_000_000;
const FEE_BUFFER_LAMPORTS = 10_000;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const MIN_SOL_FOR_USDC_TRANSFER = 0.003;
export const DEMO_TOP_UP_SOL_AMOUNT = 0.05;

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

export async function sendCustodialUsdcTransfer({
  request,
  payerSecretKey,
}: {
  request: SettlementRequest;
  payerSecretKey: Uint8Array;
}) {
  const payerKeypair = Keypair.fromSecretKey(payerSecretKey);

  if (payerKeypair.publicKey.toBase58() !== request.senderWalletAddress) {
    throw new Error("Encrypted payer wallet does not match the payer profile.");
  }

  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const payer = payerKeypair.publicKey;
  const recipient = new PublicKey(request.recipientWalletAddress);
  const sourceAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, payer);
  const destinationAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, recipient);
  const transferAmount = usdcAmountToBaseUnits(request.amount);
  const [payerLamports, sourceBalance, destinationAccountInfo, tokenAccountRent] =
    await Promise.all([
      connection.getBalance(payer),
      connection.getTokenAccountBalance(sourceAta).catch(() => null),
      connection.getAccountInfo(destinationAta),
      connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE),
    ]);

  if (payerLamports === 0) {
    throw new Error(
      `Payer wallet ${payer.toBase58()} has no devnet SOL. Airdrop devnet SOL to pay transaction fees, then try again.`,
    );
  }

  const requiredLamports =
    FEE_BUFFER_LAMPORTS + (destinationAccountInfo ? 0 : tokenAccountRent);

  if (payerLamports < requiredLamports) {
    throw new Error(
      `Payer wallet ${payer.toBase58()} only has ${(payerLamports / LAMPORTS_PER_SOL).toFixed(
        6,
      )} SOL. Add at least ${MIN_SOL_FOR_USDC_TRANSFER} devnet SOL so OTPay can pay fees${
        destinationAccountInfo ? "" : " and create the recipient USDC token account"
      }.`,
    );
  }

  if (!sourceBalance) {
    throw new Error(
      `Payer wallet ${payer.toBase58()} does not have a devnet USDC token account for mint ${DEVNET_USDC_MINT.toBase58()}. Fund that wallet with devnet USDC first.`,
    );
  }

  const sourceAmount = BigInt(sourceBalance.value.amount);

  if (sourceAmount < transferAmount) {
    throw new Error(
      `Payer wallet ${payer.toBase58()} only has ${sourceBalance.value.uiAmountString} USDC, but this payment needs ${request.amount} USDC.`,
    );
  }

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
      transferAmount,
      USDC_DECIMALS,
    ),
  );

  transaction.sign(payerKeypair);

  let signature: string;

  try {
    signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
  } catch (error) {
    if (error instanceof SendTransactionError) {
      const logs = await error.getLogs(connection).catch(() => null);
      throw new Error(
        `${error.message}${logs?.length ? ` Logs: ${logs.join(" | ")}` : ""}`,
      );
    }

    throw error;
  }
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return {
    signature,
    sourceAta: sourceAta.toBase58(),
    destinationAta: destinationAta.toBase58(),
  };
}

function normalizeTreasurySecret(secretKey: string) {
  const trimmed = secretKey.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseTreasurySecretBytes(secretKey: string) {
  const normalized = normalizeTreasurySecret(secretKey);

  if (normalized.startsWith("[") || normalized.includes(",")) {
    let values: unknown;

    try {
      values = normalized.startsWith("[")
        ? JSON.parse(normalized)
        : normalized.split(",").map((value) => Number(value.trim()));
    } catch {
      throw new Error(
        "OTPAY_DEVNET_TREASURY_SECRET_KEY looks like a Solana JSON keypair, but it could not be parsed.",
      );
    }

    if (
      !Array.isArray(values) ||
      values.length !== 64 ||
      !values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
    ) {
      throw new Error(
        "OTPAY_DEVNET_TREASURY_SECRET_KEY JSON/comma format must contain exactly 64 byte values.",
      );
    }

    return Uint8Array.from(values as number[]);
  }

  const bytes = Buffer.from(normalized, "base64");

  if (bytes.length === 64) {
    return bytes;
  }

  const base58Bytes = decodeBase58Secret(normalized);

  if (base58Bytes?.length === 64) {
    return base58Bytes;
  }

  throw new Error(
    "OTPAY_DEVNET_TREASURY_SECRET_KEY must be a 64-byte Solana secret key in base64, base58, JSON array, or comma-separated format.",
  );
}

function getKeypairFromSecret(secretKey: string) {
  return Keypair.fromSecretKey(parseTreasurySecretBytes(secretKey));
}

function decodeBase58Secret(value: string) {
  if (!value || [...value].some((char) => !BASE58_ALPHABET.includes(char))) {
    return null;
  }

  const bytes = [0];

  for (const char of value) {
    const alphabetIndex = BASE58_ALPHABET.indexOf(char);
    let carry = alphabetIndex;

    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const char of value) {
    if (char !== "1") break;
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}

export function getDevnetTreasuryKeypair() {
  const secretKey = process.env.OTPAY_DEVNET_TREASURY_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Demo treasury wallet is not configured. Set OTPAY_DEVNET_TREASURY_SECRET_KEY.");
  }

  return getKeypairFromSecret(secretKey);
}

export async function airdropDevnetSol({
  walletAddress,
  solAmount,
}: {
  walletAddress: string;
  solAmount: number;
}) {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const recipient = new PublicKey(walletAddress);
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  try {
    const signature = await connection.requestAirdrop(recipient, lamports);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(`Devnet SOL airdrop failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Devnet faucet is temporarily unavailable.";

    throw new Error(
      message.toLowerCase().includes("airdrop")
        ? message
        : `Devnet faucet is temporarily unavailable: ${message}`,
    );
  }
}

export async function sendTreasurySolTopUp({
  recipientWalletAddress,
  solAmount,
}: {
  recipientWalletAddress: string;
  solAmount: number;
}) {
  const treasuryKeypair = getDevnetTreasuryKeypair();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const treasury = treasuryKeypair.publicKey;
  const recipient = new PublicKey(recipientWalletAddress);
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const treasuryLamports = await connection.getBalance(treasury);

  if (treasuryLamports < lamports + FEE_BUFFER_LAMPORTS) {
    throw new Error(
      `Demo treasury wallet ${treasury.toBase58()} needs at least ${solAmount} SOL plus fees to fund wallet gas.`,
    );
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: treasury,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: treasury,
      toPubkey: recipient,
      lamports,
    }),
  );

  transaction.sign(treasuryKeypair);

  let signature: string;

  try {
    signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
  } catch (error) {
    if (error instanceof SendTransactionError) {
      const logs = await error.getLogs(connection).catch(() => null);
      throw new Error(
        `${error.message}${logs?.length ? ` Logs: ${logs.join(" | ")}` : ""}`,
      );
    }

    throw error;
  }

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`Demo SOL top-up failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return {
    signature,
    treasuryWalletAddress: treasury.toBase58(),
  };
}

export async function sendTreasuryUsdcTopUp({
  recipientWalletAddress,
  amount,
}: {
  recipientWalletAddress: string;
  amount: string | number;
}) {
  const treasuryKeypair = getDevnetTreasuryKeypair();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const treasury = treasuryKeypair.publicKey;
  const recipient = new PublicKey(recipientWalletAddress);
  const treasuryAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, treasury);
  const recipientAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, recipient);
  const transferAmount = usdcAmountToBaseUnits(amount);
  const [treasuryLamports, treasuryBalance] = await Promise.all([
    connection.getBalance(treasury),
    connection.getTokenAccountBalance(treasuryAta).catch(() => null),
  ]);

  if (treasuryLamports === 0) {
    throw new Error(
      `Demo treasury wallet ${treasury.toBase58()} has no devnet SOL for token-transfer fees.`,
    );
  }

  if (!treasuryBalance) {
    throw new Error(
      `Demo treasury wallet ${treasury.toBase58()} has no devnet USDC token account for mint ${DEVNET_USDC_MINT.toBase58()}.`,
    );
  }

  if (BigInt(treasuryBalance.value.amount) < transferAmount) {
    throw new Error(
      `Demo treasury wallet only has ${treasuryBalance.value.uiAmountString} USDC, but this top-up needs ${amount} USDC.`,
    );
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: treasury,
    recentBlockhash: blockhash,
  }).add(
    createAssociatedTokenAccountIdempotentInstruction(
      treasury,
      recipientAta,
      recipient,
      DEVNET_USDC_MINT,
    ),
    createTransferCheckedInstruction(
      treasuryAta,
      DEVNET_USDC_MINT,
      recipientAta,
      treasury,
      transferAmount,
      USDC_DECIMALS,
    ),
  );

  transaction.sign(treasuryKeypair);

  let signature: string;

  try {
    signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
  } catch (error) {
    if (error instanceof SendTransactionError) {
      const logs = await error.getLogs(connection).catch(() => null);
      throw new Error(
        `${error.message}${logs?.length ? ` Logs: ${logs.join(" | ")}` : ""}`,
      );
    }

    throw error;
  }

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`Demo USDC top-up failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return {
    signature,
    treasuryWalletAddress: treasury.toBase58(),
    sourceAta: treasuryAta.toBase58(),
    destinationAta: recipientAta.toBase58(),
  };
}

export async function getDevnetWalletBalances(walletAddress: string) {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const owner = new PublicKey(walletAddress);
  const usdcAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, owner);

  const [lamports, usdcBalance] = await Promise.all([
    connection.getBalance(owner).catch(() => null),
    connection.getTokenAccountBalance(usdcAta).catch(() => null),
  ]);

  return {
    sol: lamports === null ? null : lamports / 1_000_000_000,
    usdc: usdcBalance?.value.uiAmount ?? null,
    usdcAta: usdcAta.toBase58(),
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

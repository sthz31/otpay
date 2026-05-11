import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Keypair } from "@solana/web3.js";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  const rawKey = process.env.OTPAY_WALLET_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("Missing OTPAY_WALLET_ENCRYPTION_KEY for test wallet custody.");
  }

  const key = Buffer.from(rawKey, "base64");

  if (key.length !== 32) {
    throw new Error("OTPAY_WALLET_ENCRYPTION_KEY must be a 32-byte base64 string.");
  }

  return key;
}

export function encryptWalletSecret(secretKey: Uint8Array) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptWalletSecret(encryptedWalletSecret: string) {
  const [version, iv, authTag, encrypted] = encryptedWalletSecret.split(":");

  if (version !== "v1" || !iv || !authTag || !encrypted) {
    throw new Error("Unsupported encrypted wallet secret format.");
  }

  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Uint8Array.from(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]),
  );
}

export function createEncryptedTestWallet() {
  const keypair = Keypair.generate();

  return {
    walletAddress: keypair.publicKey.toBase58(),
    encryptedWalletSecret: encryptWalletSecret(keypair.secretKey),
  };
}

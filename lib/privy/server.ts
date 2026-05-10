import { PrivyClient, verifyAccessToken } from "@privy-io/node";
import { cookies, headers } from "next/headers";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;
const privyVerificationKey = process.env.PRIVY_VERIFICATION_KEY;

let privyClient: PrivyClient | null = null;

export type PrivyUserLike = {
  id: string;
  linked_accounts: Array<{
    type: string;
  }>;
};

export function isPrivyConfigured() {
  return Boolean(privyAppId && privyAppSecret && privyVerificationKey);
}

export function getPrivyServerClient() {
  if (!privyAppId || !privyAppSecret) {
    throw new Error("Missing Privy server configuration.");
  }

  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: privyAppId,
      appSecret: privyAppSecret,
      jwtVerificationKey: privyVerificationKey,
    });
  }

  return privyClient;
}

export async function getPrivyAccessTokenFromRequest() {
  const headerStore = await headers();
  const authorizationHeader = headerStore.get("authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const cookieStore = await cookies();
  return cookieStore.get("privy-token")?.value ?? null;
}

export async function getPrivyUserFromRequest() {
  try {
    if (!isPrivyConfigured() || !privyAppId || !privyVerificationKey) {
      return null;
    }

    const accessToken = await getPrivyAccessTokenFromRequest();

    if (!accessToken) {
      return null;
    }

    const verifiedToken = await verifyAccessToken({
      access_token: accessToken,
      app_id: privyAppId,
      verification_key: privyVerificationKey,
    });

    return getPrivyServerClient().users()._get(verifiedToken.user_id);
  } catch {
    return null;
  }
}

export function getPrivyPhoneNumber(user: PrivyUserLike) {
  const linkedPhone = user.linked_accounts.find((account) => account.type === "phone");

  const phoneAccount = linkedPhone as
    | {
        phoneNumber?: string;
        number?: string;
      }
    | undefined;

  if (!phoneAccount) {
    return null;
  }

  return phoneAccount.phoneNumber ?? phoneAccount.number ?? null;
}

export function getPrivySolanaWalletAddress(user: PrivyUserLike) {
  const embeddedWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" &&
      (account as { chain_type?: string }).chain_type === "solana" &&
      (account as { connector_type?: string }).connector_type === "embedded",
  );

  if (embeddedWallet) {
    return (embeddedWallet as { address?: string }).address ?? null;
  }

  const anySolanaWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" &&
      (account as { chain_type?: string }).chain_type === "solana",
  );

  if (anySolanaWallet) {
    return (anySolanaWallet as { address?: string }).address ?? null;
  }

  return null;
}

export async function ensurePrivySolanaWallet(user: PrivyUserLike) {
  if (getPrivySolanaWalletAddress(user)) {
    return user;
  }

  const updatedUser = await getPrivyServerClient().users().pregenerateWallets(user.id, {
    wallets: [{ chain_type: "solana" }],
  });

  return updatedUser as PrivyUserLike;
}

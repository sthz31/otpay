export type PaymentIntentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "settling"
  | "settled"
  | "failed";

export type Profile = {
  id: string;
  displayName: string;
  walletAddress: string;
  pinSetAt?: string | null;
  createdAt?: string;
};

export type PhoneLink = {
  id: string;
  profileId: string;
  phoneNumber: string;
  isVerified: boolean;
  createdAt?: string;
};

export type PaymentIntent = {
  id: string;
  senderProfileId: string;
  recipientProfileId: string;
  recipientPhoneNumber: string;
  payerPhoneNumber?: string | null;
  approvalMethod?: "payer_link" | "shared_otp" | null;
  approvedByProfileId?: string | null;
  amount: string;
  currency: "USDC";
  note?: string;
  status: PaymentIntentStatus;
  transactionSignature?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionRecord = {
  id: string;
  paymentIntentId: string;
  signature: string;
  tokenMint: string;
  senderWallet: string;
  recipientWallet: string;
  status: "submitted" | "confirmed" | "failed";
  createdAt?: string;
};

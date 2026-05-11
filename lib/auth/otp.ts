import { createHash, randomInt, timingSafeEqual } from "crypto";

export function createOtp() {
  return randomInt(1000, 10000).toString();
}

export function hashPaymentOtp(intentId: string, otp: string) {
  return createHash("sha256").update(`${intentId}:${otp}`).digest("hex");
}

export function hashPhoneOtp(phoneNumber: string, otp: string) {
  return createHash("sha256").update(`phone:${phoneNumber}:${otp}`).digest("hex");
}

export function verifyPaymentOtp({
  intentId,
  otp,
  otpHash,
}: {
  intentId: string;
  otp: string;
  otpHash: string | null;
}) {
  if (!otpHash) return false;

  const candidate = Buffer.from(hashPaymentOtp(intentId, otp), "hex");
  const expected = Buffer.from(otpHash, "hex");

  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}

export function verifyPhoneOtp({
  phoneNumber,
  otp,
  otpHash,
}: {
  phoneNumber: string;
  otp: string;
  otpHash: string | null;
}) {
  if (!otpHash) return false;

  const candidate = Buffer.from(hashPhoneOtp(phoneNumber, otp), "hex");
  const expected = Buffer.from(otpHash, "hex");

  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}

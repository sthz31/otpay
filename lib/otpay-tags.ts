export function normalizeOtpayTag(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function isOtpayTagInput(value: string) {
  const normalized = normalizeOtpayTag(value);
  return /^[a-z0-9][a-z0-9_]{2,29}$/.test(normalized);
}

export function createOtpayTagCandidate(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 18);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "otpay"}_${suffix}`;
}

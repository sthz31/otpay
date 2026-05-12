import { z } from "zod";

export const phoneLinkStartSchema = z.object({
  displayName: z.string().min(2, "displayName is required").max(40, "displayName is too long"),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number."),
});

export const phoneLinkVerifySchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number."),
  otp: z.string().length(4, "OTP must be 4 digits"),
});

export const phoneLinkPinSchema = z.object({
  profileId: z.string().uuid("profileId is required"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is required.").max(40, "Display name is too long.").optional(),
  otpayTag: z
    .string()
    .trim()
    .regex(/^@?[a-zA-Z0-9][a-zA-Z0-9_]{2,29}$/, "Use 3-30 letters, numbers, or underscores.")
    .optional(),
  currentPin: z.string().regex(/^\d{4}$/, "Current PIN must be exactly 4 digits.").optional(),
  newPin: z.string().regex(/^\d{4}$/, "New PIN must be exactly 4 digits.").optional(),
}).refine((value) => !value.newPin || value.currentPin, {
  message: "Enter your current PIN to change PIN.",
  path: ["currentPin"],
});

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number."),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

export const paymentIntentSchema = z.object({
  payerIdentifier: z.string().trim().min(3, "Enter an OTPay tag or phone number.").optional(),
  recipientPhoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number.")
    .optional(),
  amount: z.string().min(1, "amount is required"),
  currency: z.literal("USDC").default("USDC"),
  note: z.string().max(160).optional(),
}).refine((value) => value.payerIdentifier || value.recipientPhoneNumber, {
  message: "Enter an OTPay tag or phone number.",
  path: ["payerIdentifier"],
});

export const paymentIntentDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const paymentIntentConfirmSchema = z.object({
  otp: z.string().regex(/^\d{4}$/, "OTP must be exactly 4 digits."),
});

export const settlementSchema = z.object({
  paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be exactly 4 digits.").optional(),
  signature: z.string().min(32, "signature is required").optional(),
});

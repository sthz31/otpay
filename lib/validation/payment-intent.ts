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

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number."),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

export const paymentIntentSchema = z.object({
  recipientPhoneNumber: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number."),
  amount: z.string().min(1, "amount is required"),
  currency: z.literal("USDC").default("USDC"),
  note: z.string().max(160).optional(),
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

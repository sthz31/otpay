const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

export function isTwilioConfigured() {
  return Boolean(twilioAccountSid && twilioAuthToken && twilioFromNumber);
}

export async function sendPaymentOtpSms({
  to,
  requesterName,
  amount,
  currency,
  otp,
  approvalUrl,
}: {
  to: string;
  requesterName: string;
  amount: string;
  currency: string;
  otp: string;
  approvalUrl: string;
}) {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error("Twilio SMS is not configured.");
  }

  const body = new URLSearchParams({
    From: twilioFromNumber,
    To: to,
    Body: `OTPay request: ${requesterName} is requesting ${amount} ${currency}. OTP: ${otp}. Approve and pay: ${approvalUrl}`,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString(
          "base64",
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Twilio could not send the payment OTP.");
  }
}

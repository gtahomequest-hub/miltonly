export async function sendSMS(message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.OWNER_PHONE;

  if (!accountSid || !authToken || !from || !to) {
    console.log("SMS skipped (Twilio not configured):", message);
    return false;
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body: message, from, to });
    return true;
  } catch (e) {
    console.error("SMS send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

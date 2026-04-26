type LeadLike = {
  id: string;
  firstName: string;
  phone: string | null;
  bedrooms: number | null;
  priceRangeMax: number | null;
  timeline: string | null;
};

const isLive =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER;

export async function sendLeadSms(lead: LeadLike): Promise<void> {
  if (!lead.phone) {
    console.log("[twilio:stub] no phone — skipping SMS to renter");
    return;
  }

  const bedroomLabel = lead.bedrooms === 0 ? "studio" : `${lead.bedrooms}bd`;
  const renterMsg = `Hi ${lead.firstName}! It's Aamir from RE/MAX 👋 Got your request for a ${bedroomLabel} under $${lead.priceRangeMax} in Milton. Pulling matches now — you'll have 3-5 listings by 4 PM today. Quick Q: any preferred area (Hawthorne, Scott, Willmott)? Reply STOP to opt out.`;
  const aamirMsg = `🏠 NEW LEAD ${lead.id}: ${lead.firstName} | ${bedroomLabel} | $${lead.priceRangeMax} | ${lead.timeline} | ${lead.phone}`;

  if (!isLive) {
    console.log("[twilio:stub] -> renter", lead.phone, renterMsg);
    console.log("[twilio:stub] -> aamir", process.env.AAMIR_PHONE, aamirMsg);
    return;
  }
  // TODO: when A2P 10DLC is registered, uncomment and `npm install twilio`:
  // const twilio = (await import("twilio")).default(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  // await twilio.messages.create({ from: process.env.TWILIO_FROM_NUMBER!, to: lead.phone, body: renterMsg });
  // await twilio.messages.create({ from: process.env.TWILIO_FROM_NUMBER!, to: process.env.AAMIR_PHONE!, body: aamirMsg });
}

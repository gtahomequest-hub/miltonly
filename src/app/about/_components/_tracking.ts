// Centralised GA4 event taxonomy for the /about page. Every section
// imports from here so the full event list is auditable in one place.
// Matches the existing getGtag() pattern used by LeadCaptureForm,
// HomeValuationCard, MarketPulseUnlockCard, AamirTrustCard.
//
// Adding a new event:
//   1. Add the constant to ABOUT_EVENTS.
//   2. Call fireAboutEvent(ABOUT_EVENTS.<name>, { ...params }) at the site.
//   3. Document the event in docs/about-page-tracking-spec.md (Gate 5).
//
// generate_lead is owned by ContactFormSection's submit handler and
// matches the existing convention (source/intent/value/currency/
// transaction_id) — listed here for taxonomy completeness only.

export const ABOUT_EVENTS = {
  heroCtaPrimaryClick: "hero_cta_primary_click",
  heroCtaPhoneClick: "hero_cta_phone_click",
  videoIntroPlay: "video_intro_play",
  videoIntroComplete: "video_intro_complete",
  reviewCardVisible: "review_card_visible",
  audienceTabSwitch: "audience_tab_switch",
  serviceAreaMapView: "service_area_map_view",
  formFieldFocus: "form_start_about",
  formSubmitAttempt: "form_submit_attempt",
  generateLead: "generate_lead",
  clickCallAbout: "click_call_about",
  clickWhatsappAbout: "click_whatsapp_about",
  clickEmailAbout: "click_email_about",
  stickyBarCall: "sticky_bar_call",
  stickyBarText: "sticky_bar_text",
  faqExpand: "faq_expand",
} as const;

export type AboutEventName = (typeof ABOUT_EVENTS)[keyof typeof ABOUT_EVENTS];

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return typeof w.gtag === "function" ? w.gtag : null;
}

/**
 * Fire a GA4 event scoped to the /about page. Adds source="about-page"
 * to every payload so reporting can filter cleanly. Caller params win
 * if they override source.
 *
 * No-op when gtag isn't loaded (SSR, ad-blockers, cold cache) — never
 * throws.
 */
export function fireAboutEvent(
  name: AboutEventName,
  params: Record<string, unknown> = {},
): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("event", name, { source: "about-page", ...params });
}

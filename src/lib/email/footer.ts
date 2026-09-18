// The footer every recurring email carries, and the reason it is one function.
//
// CASL s.6(2) asks three things of a commercial electronic message: it identifies who sent
// it, it gives a mailing address the sender can be reached at, and it carries an unsubscribe
// that works. The brief had two of the three and the deal alerts and the leads digest had
// none. Each sender composing its own footer is how that happened, so the footer is composed
// here, once, and a sender passes the one thing that differs: the signed link for the watch
// it is mailing.
//
// The footer names the person, the brokerage and the postal address from config, so a change
// of brokerage or address is one edit. It says why the reader is receiving the mail, because a
// reader who does not remember signing up is the one who reports it as spam, and the
// unsubscribe is a plain link in both bodies: the HTML one for a browser and the text one for
// a client that shows no HTML.

import { config } from "@/lib/config";

export interface FooterInput {
  /** The signed link for this recipient's watch. Every recurring email has one. */
  unsubscribeUrl: string;
  /** What the reader signed up for, in words: "the Milton daily brief", "alerts for Main Street". */
  listName: string;
  /** Where the unsubscribe link's site links point. The canonical site in production. */
  origin?: string;
}

export interface Footer {
  html: string;
  text: string;
}

export function mailingAddressLine(): string {
  const a = config.brokerage.mailingAddress;
  return `${a.street}, ${a.city}, ${a.province} ${a.postalCode}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emailFooter(input: FooterInput): Footer {
  const origin = input.origin || config.SITE_URL;
  const sender = `${config.realtor.name}, ${config.realtor.title}, ${config.brokerage.name}`;
  const address = mailingAddressLine();
  const why = `You are receiving this because you asked for ${input.listName} at ${config.SITE_DOMAIN}.`;
  const stop = "Unsubscribe with one click, no account needed:";

  const html = `
      <p style="font-size:11px;line-height:1.6;color:#6b7280;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:12px;">
        ${esc(sender)}<br/>
        ${esc(address)}<br/>
        ${esc(why)}<br/>
        ${esc(stop)} <a href="${input.unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a><br/>
        <a href="${origin}" style="color:#6b7280;">${esc(config.SITE_DOMAIN)}</a>
      </p>`.trim();

  const text = [
    "",
    "--",
    sender,
    address,
    why,
    `${stop} ${input.unsubscribeUrl}`,
    origin,
  ].join("\n");

  return { html, text };
}

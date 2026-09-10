// The honeypot field name, alone in a module with no imports.
//
// Both the server guard and the client helper need this constant, and the guard imports
// Upstash and the Redis client. Sharing the constant through that file would drag the whole
// rate-limit stack into every browser bundle, so the name lives here and nowhere else.
export const HONEYPOT_FIELD = process.env.HONEYPOT_FIELD || "company_website";

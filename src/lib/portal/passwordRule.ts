// The password length floor, alone in a module with no imports, so the card and the sign-in
// form can show it without pulling bcrypt and the rate-limit stack into the browser bundle.
// src/lib/portal/password.ts re-exports it and is the one that judges.
export const MIN_PASSWORD_LENGTH = 12;

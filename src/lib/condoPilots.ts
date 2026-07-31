// Build B pilot allowlist — the ONLY slugs that render the new buildBuildingAttributes page.
// CONDO_ENABLED (generation) stays globally off; these four are enabled for visual review and
// span the honest-degradation range: 610 full/rich, 830 typical-no-range, 480 sale-suppressed/
// lease-rich, 139 identity-only.
export const CONDO_PILOT_SLUGS: readonly string[] = [
  "610-farmstead-drive-milton",
  "830-megson-terrace-milton",
  "480-gordon-krantz-avenue-milton",
  "139-main-street-milton",
];

export function isCondoPilot(slug: string): boolean {
  return CONDO_PILOT_SLUGS.includes(slug);
}

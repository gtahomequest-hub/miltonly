// src/components/tenure/TenureHubPage.tsx
//
// The SHARED tenure-hub render. Reuses the .hub-v2 visual system (hub-theme.css)
// VERBATIM and composes the tenure-local section variants. HubPage.tsx and
// sections.tsx are UNTOUCHED (zero regression to the 16 neighbourhood hubs).
//
// It renders ONLY the tenure-appropriate sections — no Streets/VIP/Condos/
// Siblings (those are neighbourhood-coupled and would 404 / read wrong for a
// tenure slug). Fed a HubData object from getTenureHubData(config), so condo +
// POTL plug in later as configs with NO template change. Every stat null-degrades
// (POTL: stats=null -> hero "not stated", numeric editorial dropped -> a clean
// editorial-only page through this same composer).
import "../hub/hub-theme.css";
import type { HubData } from "../hub/types";
import { SiteNav } from "../nav/SiteNav";
import { CompareModule, type CompareModuleProps } from "../compare/CompareModule";
import {
  TenureHero,
  TenureGlance,
  TenureOverview,
  TenureMarket,
  TenureFaqs,
  TenureDualCta,
} from "./tenure-sections";

// compareLink is OPTIONAL + additive — when present (freehold + condos-guide), a
// standalone CompareModule renders after the market section (now self-contained:
// no .hub-v2 styling dependency, and it can carry a live stat contrast). When
// absent (POTL, neighbourhood-adjacent uses), the page is byte-unchanged.
export function TenureHubPage({
  data,
  eyebrow,
  compareLink,
}: {
  data: HubData;
  eyebrow: string;
  compareLink?: CompareModuleProps;
}) {
  return (
    <div className="hub-v2">
      <SiteNav variant="page" />
      <TenureHero data={data} eyebrow={eyebrow} />
      <TenureGlance data={data} />
      <TenureOverview data={data} />
      <TenureMarket data={data} />
      {compareLink && <CompareModule {...compareLink} />}
      <TenureFaqs data={data} />
      <TenureDualCta data={data} />
    </div>
  );
}

export default TenureHubPage;

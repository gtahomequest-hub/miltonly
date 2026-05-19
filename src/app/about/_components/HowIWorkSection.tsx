"use client";

import { useState } from "react";
import type { Audience, AudienceId } from "./_types";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface HowIWorkSectionProps {
  audiences: Audience[];
}

/**
 * Tabbed three-audience process explainer (Buyers / Tenants / Landlords).
 * Each tab shows three step cards. Copy is Ontario-first with Milton
 * depth (locked spec per DEC-ABOUT-CANONICAL 2026-05-19) — never
 * Milton-only.
 *
 * SCAFFOLD: visual implementation of tabs + step cards deferred to
 * Gate 4. Tab-switch tracking is live in this scaffold so the GA event
 * shape (audience param) is locked.
 */
export default function HowIWorkSection(props: HowIWorkSectionProps) {
  const initial: AudienceId = props.audiences[0]?.id ?? "buyers";
  const [active, setActive] = useState<AudienceId>(initial);

  function switchTo(audience: AudienceId) {
    if (active === audience) return;
    setActive(audience);
    fireAboutEvent(ABOUT_EVENTS.audienceTabSwitch, { audience });
  }

  const activeAudience = props.audiences.find((a) => a.id === active);

  return (
    <section
      data-section="about-how-i-work"
      aria-labelledby="about-how-heading"
    >
      <h2 id="about-how-heading">How I work</h2>

      <div role="tablist" data-role="audience-tabs">
        {props.audiences.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={active === a.id}
            aria-controls={`how-panel-${a.id}`}
            id={`how-tab-${a.id}`}
            onClick={() => switchTo(a.id)}
          >
            {a.tabLabel}
          </button>
        ))}
      </div>

      {activeAudience ? (
        <div
          role="tabpanel"
          id={`how-panel-${activeAudience.id}`}
          aria-labelledby={`how-tab-${activeAudience.id}`}
          data-role="steps"
        >
          {activeAudience.steps.map((step, i) => (
            <article key={`${activeAudience.id}-${i}`} data-step={i + 1}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

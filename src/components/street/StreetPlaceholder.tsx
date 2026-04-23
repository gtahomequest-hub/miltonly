// Phase 4.1 Step 13b — StreetPlaceholder.
//
// Renders in place of DescriptionBody when neither a generated AI narrative
// nor a legacy StreetContent.description exists for the slug. Keeps the
// page visually native — same SerifHeading + Body typography as successful
// pages — without exposing internal pipeline state to the reader.
//
// Trigger is computed in src/app/streets/[slug]/page.tsx; this component
// does not make the decision, it just renders.
//
// Paired with FAQ suppression at the page level. The rest of the page
// (hero, market, commute, schools, inventory, CTAs) continues to render
// independently — that data is DB-derived and doesn't need AI prose.

import { Container, SerifHeading, Body } from "@/components/ui";
import { DescriptionSidebar } from "./DescriptionSidebar";
import type { DescriptionSidebarProps } from "@/types/street";

interface StreetPlaceholderProps {
  streetName: string;
  sidebar: DescriptionSidebarProps;
}

export function StreetPlaceholder({ streetName, sidebar }: StreetPlaceholderProps) {
  return (
    <section className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <div className="description-grid">
          <DescriptionSidebar {...sidebar} />
          <div className="description-body">
            <div className="section-heading-block">
              <SerifHeading level={3}>A note on this profile</SerifHeading>
            </div>
            <Body variant="lead">
              A fuller narrative on {streetName} is in preparation. Live
              market activity, commute context, school catchment, and current
              inventory are all available below. For pricing specifics, recent
              trade context, or a private conversation about this street,
              reach our team directly.
            </Body>
          </div>
        </div>
      </Container>
    </section>
  );
}

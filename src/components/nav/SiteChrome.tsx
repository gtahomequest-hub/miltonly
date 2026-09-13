// src/components/nav/SiteChrome.tsx
// The forest header and footer around a page that has no theme of its own.
//
// Until MH-006 the root layout rendered the legacy navy <Navbar> on every route ChromeGate did
// not suppress, and each of those pages ended without a footer. Navbar is deleted; the pages
// that leaned on it (about, exclusive, privacy, terms, rent, rentals, saved, signin, admin)
// wrap their body in this instead and get the same bar and the same map every forest page
// has. The 66px offset clears the fixed bar the way every forest theme's hero does.
import SiteNavLive from "./SiteNavLive";
import SiteFooter from "./SiteFooter";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNavLive variant="page" />
      <div className="site-chrome-body">{children}</div>
      <SiteFooter />
    </>
  );
}

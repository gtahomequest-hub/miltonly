// The admin pages leaned on the root layout's navy Navbar for a way back to the site. That
// bar is gone (MH-006); the forest chrome wraps them here so a signed-in editor still has the
// menu, and the page components stay client components untouched.
import SiteChrome from "@/components/nav/SiteChrome";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}

import CrispChat from "@/components/CrispChat";

export default function RentLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* analytics comes from the root layout (DeferredTags); a second gtag.js here was a duplicate */}
      {children}
      <CrispChat />
    </>
  );
}

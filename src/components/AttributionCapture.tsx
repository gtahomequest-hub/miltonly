"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

// Re-runs capture on every URL change so client-side navigations to
// gclid-bearing routes (rare but possible) are also recorded — first-touch
// is preserved by captureAttribution's "don't overwrite if exists" guard.
function AttributionCaptureInner() {
  const searchParams = useSearchParams();
  useEffect(() => {
    captureAttribution();
  }, [searchParams]);
  return null;
}

// useSearchParams() requires Suspense in App Router; the inner component
// runs in a Suspense boundary so layout SSR isn't bailed out.
export default function AttributionCapture() {
  return (
    <Suspense fallback={null}>
      <AttributionCaptureInner />
    </Suspense>
  );
}

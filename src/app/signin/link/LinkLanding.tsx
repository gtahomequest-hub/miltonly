"use client";

// The client half of /signin/link: posts the token once, then goes where the link said.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LinkLanding() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const redirect = params.get("r") || "";
  const [error, setError] = useState<string | null>(null);
  const posted = useRef(false);

  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    if (!token) {
      setError("That link is incomplete. Request a new one.");
      return;
    }
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, redirect }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "That link did not work. Request a new one.");
          return;
        }
        window.location.replace(data.redirect || "/saved");
      })
      .catch(() => setError("Something went wrong. Request a new link."));
  }, [token, redirect]);

  const signinHref = redirect ? `/signin?redirect=${encodeURIComponent(redirect)}` : "/signin";

  return (
    <div className="bg-white rounded-2xl border border-[#dfe0dc] p-8 shadow-sm text-center">
      {error ? (
        <>
          <p className="text-[16px] font-bold text-[#073126] mb-2">{error}</p>
          <p className="text-[13px] text-[#6b6f6a] mb-5">A link works once and for 15 minutes. The code in the same email may still work on the page you left.</p>
          <Link href={signinHref} rel="nofollow" className="inline-block bg-[#017848] text-white text-[13px] font-bold px-6 py-3 rounded-xl">
            Request a new link
          </Link>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 w-6 h-6 border-2 border-[#017848] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] font-semibold text-[#073126]">Signing you in…</p>
        </>
      )}
    </div>
  );
}

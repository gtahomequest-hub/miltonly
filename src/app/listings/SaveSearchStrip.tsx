"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { useState } from "react";

interface Props {
  type?: string;
  status?: string;
  neighbourhood?: string;
  min?: string;
  max?: string;
  beds?: string;
  baths?: string;
  openHouse?: string;
}

export default function SaveSearchStrip(props: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const labels: string[] = [];
  if (props.type && props.type !== "all") labels.push(props.type.charAt(0).toUpperCase() + props.type.slice(1));
  if (props.neighbourhood) labels.push(props.neighbourhood);
  if (props.beds) labels.push(`${props.beds}+ bd`);
  if (props.baths) labels.push(`${props.baths}+ ba`);
  if (props.min || props.max) {
    const minStr = props.min ? `$${Math.round(parseInt(props.min) / 1000)}K` : "";
    const maxStr = props.max ? `$${Math.round(parseInt(props.max) / 1000)}K` : "";
    labels.push(minStr && maxStr ? `${minStr}–${maxStr}` : minStr ? `from ${minStr}` : `under ${maxStr}`);
  }
  if (props.openHouse) labels.push("open houses");

  const summary = labels.length ? labels.join(" · ") : "all Milton listings";

  const handleSave = async () => {
    if (!user) {
      router.push("/signin?redirect=/listings");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: labels.length ? labels.join(" · ") : "All Milton listings",
          propertyType: props.type && props.type !== "all" ? props.type : undefined,
          neighbourhood: props.neighbourhood || undefined,
          priceMin: props.min || undefined,
          priceMax: props.max || undefined,
          bedsMin: props.beds || undefined,
          bathsMin: props.baths || undefined,
          transactionType: props.status === "rent" ? "For Lease" : "For Sale",
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setErr("Could not save — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#07111f] px-5 sm:px-11 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-[#cbd5e1]">
          <span className="text-[#f59e0b] mr-1">🔔</span>
          Get notified when new listings match — <span className="text-white font-semibold">{summary}</span>
        </p>
        <div className="flex items-center gap-3">
          {err && <span className="text-[12px] text-[#fca5a5]">{err}</span>}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="text-[12px] font-bold text-[#f59e0b] border border-[#f59e0b] rounded-lg px-4 py-2 hover:bg-[#f59e0b] hover:text-[#07111f] transition-colors disabled:opacity-60 disabled:cursor-default"
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save this search"}
          </button>
        </div>
      </div>
    </div>
  );
}

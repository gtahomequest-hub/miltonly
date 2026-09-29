// VOW consumer notice + PropTx MLS® source attribution. Required on every
// page that renders sold data per the VOW licensing agreement. Static
// server component, no client-side JS.

import { VOW_NOTICES } from "@/lib/vowNotice";
import { config } from "@/lib/config";

export default function VowComplianceNotice({
  brokerageName = config.brokerage.name,
}: {
  brokerageName?: string;
}) {
  return (
    <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl px-5 py-4 text-[11px] text-[#475569] leading-relaxed">
      <p className="font-semibold text-[#07111f] mb-1">
        Source: PropTx MLS<sup>®</sup> System
      </p>
      <p className="mb-1">{VOW_NOTICES}</p>
      <p className="text-[#94a3b8]">
        Brokerage: <span className="font-medium text-[#475569]">{brokerageName}</span>
      </p>
    </div>
  );
}

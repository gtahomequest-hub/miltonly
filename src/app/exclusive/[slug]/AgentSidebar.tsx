import InquiryForm from "./InquiryForm";

interface Props {
  address: string;
  slug: string;
}

export default function AgentSidebar({ address, slug }: Props) {
  return (
    <div>
      {/* Agent card */}
      <div className="bg-[#07111f] rounded-2xl p-6">
        <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Listed by</p>
        <p className="text-[22px] font-extrabold text-[#f8f9fb] mt-1 tracking-[-0.01em]">Aamir Yaqoob</p>
        <p className="text-[12px] font-bold text-[#f59e0b] mt-1">
          Sales Representative · RE/MAX Realty Specialists Inc.
        </p>

        <div className="mt-4 space-y-1">
          <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX Hall of Fame Award</p>
          <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX Executive Award</p>
          <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX 100% Club Award</p>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href="tel:+16478399090"
            className="block w-full bg-[#f59e0b] text-[#07111f] text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#fbbf24]"
          >
            📞 Call (647) 839-9090
          </a>
          <a
            href="https://wa.me/16478399090"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#1e3a5f]"
          >
            💬 WhatsApp (647) 839-9090
          </a>
          <p className="text-[11px] text-[#94a3b8] text-center mt-2">gtahomequest@gmail.com</p>
        </div>
      </div>

      {/* Inquiry form */}
      <InquiryForm address={address} slug={slug} />
    </div>
  );
}

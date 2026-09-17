import InquiryForm from "./InquiryForm";

interface Props {
  address: string;
  slug: string;
}

export default function AgentSidebar({ address, slug }: Props) {
  return (
    <div>
      {/* Agent card */}
      <div className="bg-[#073126] rounded-2xl p-6">
        <p className="text-[12px] font-bold text-white/75 uppercase tracking-wider">Listed by</p>
        <p className="text-[22px] font-extrabold text-[#fffdfa] mt-1 tracking-[-0.01em]">Aamir Yaqoob</p>
        <p className="text-[12px] font-bold text-[#00ff80] mt-1">
          Sales Representative · RE/MAX Realty Specialists Inc.
        </p>

        <div className="mt-4 space-y-1">
          <p className="text-[12px] text-white/75">🏆 RE/MAX Hall of Fame Award</p>
          <p className="text-[12px] text-white/75">🏆 RE/MAX Executive Award</p>
          <p className="text-[12px] text-white/75">🏆 RE/MAX 100% Club Award</p>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href="tel:+16478399090"
            className="block w-full bg-[#00ff80] text-[#04160f] text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#5cffa8]"
          >
            📞 Call (647) 839-9090
          </a>
          <a
            href="https://wa.me/16478399090"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-[#0b3d2e] border border-[#1c5a45] text-white text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#1c5a45]"
          >
            💬 WhatsApp (647) 839-9090
          </a>
          <p className="text-[12px] text-white/75 text-center mt-2">gtahomequest@gmail.com</p>
        </div>
      </div>

      {/* Inquiry form */}
      <InquiryForm address={address} slug={slug} />
    </div>
  );
}

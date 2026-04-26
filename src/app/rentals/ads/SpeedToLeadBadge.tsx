export default function SpeedToLeadBadge() {
  return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-7 inline-flex items-start gap-3 max-w-xl">
      <span className="text-[20px] leading-none mt-0.5" aria-hidden>
        ⚡
      </span>
      <div className="text-left">
        <p className="text-[14px] sm:text-[15px] font-bold text-white leading-snug">
          Aamir personally replies in under 60 minutes.
        </p>
        <p className="text-[12px] text-[#a7f3d0] leading-snug mt-0.5">
          During business hours, guaranteed. After hours: by 9 AM next morning.
        </p>
      </div>
    </div>
  );
}

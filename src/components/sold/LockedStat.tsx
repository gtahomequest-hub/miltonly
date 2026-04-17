// Mixed-visibility stat cell. Pass `authed` (server-side session check)
// and either a `value` (rendered for authed users) or null. Anon users see
// a locked placeholder that never contains the underlying value — nothing
// to unmask in DevTools.

import Link from "next/link";

interface Props {
  label: string;
  value: React.ReactNode | null;
  authed: boolean;
  /** Always public — renders `value` for everyone if true. */
  alwaysPublic?: boolean;
  /** Where to send the user when they tap the lock. */
  signinHref?: string;
}

export default function LockedStat({
  label,
  value,
  authed,
  alwaysPublic = false,
  signinHref = "/signin",
}: Props) {
  const show = alwaysPublic || authed;

  return (
    <div className="text-center">
      {show ? (
        <p className="text-[20px] sm:text-[22px] font-extrabold text-[#07111f] leading-none">
          {value ?? "—"}
        </p>
      ) : (
        <Link
          href={signinHref}
          className="inline-flex items-center gap-1 text-[14px] font-bold text-[#2563eb] leading-none hover:underline"
          aria-label={`Sign in to view ${label}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block">
            <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" fill="currentColor"/>
          </svg>
          Sign in
        </Link>
      )}
      <p className="text-[10px] text-[#94a3b8] font-semibold mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

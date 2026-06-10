// src/components/street/v2/SoldRecordsIsland.tsx
// Forest-v2 sold-records island. Client component: fetches the SAME gated endpoint
// as the legacy navy island (/api/streets/<slug>/sold-records -> { canSee, records })
// and applies the TREB-VOW sign-in gate per session. Restyle only — identical data
// path and gate logic to src/components/street/SoldRecordsIsland.tsx, forest classes.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SoldTableRow } from '@/types/street';
import { shortPrice, pct } from './format';

export function StreetSoldRecords({ slug, streetName }: { slug: string; streetName: string }) {
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [canSee, setCanSee] = useState(false);
  const [rows, setRows] = useState<SoldTableRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/streets/${encodeURIComponent(slug)}/sold-records`)
      .then((r) => r.json())
      .then((d: { canSee: boolean; records: SoldTableRow[] }) => {
        if (cancelled) return;
        setCanSee(d.canSee);
        setRows(d.records);
        setState('done');
      })
      .catch(() => {
        if (!cancelled) setState('done');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const signinHref = `/signin?redirect=${encodeURIComponent(pathname)}&intent=sold&street=${encodeURIComponent(slug)}`;
  const gated = state === 'done' && !canSee;

  return (
    <div className={`s-records${gated ? ' s-gated' : ''}`}>
      <div className="s-records-cap">Recent closed sales, {streetName}</div>
      <table className="s-rtable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Address</th>
            <th>Beds</th>
            <th>Sold</th>
            <th>vs Ask</th>
            <th>DOM</th>
            <th>Listing brokerage</th>
          </tr>
        </thead>
        <tbody>
          {state === 'loading' ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--s-text-muted)', padding: 28 }}>
                Loading sold records…
              </td>
            </tr>
          ) : rows.length === 0 && canSee ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--s-text-muted)', padding: 28 }}>
                No recent sales on record.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.mls_number}>
                <td>{r.sold_date.slice(0, 10)}</td>
                <td>{r.address}</td>
                <td>{r.beds ?? '—'}</td>
                <td>{shortPrice(r.sold_price)}</td>
                <td>{pct(r.sold_to_ask_ratio)}</td>
                <td>{r.days_on_market}d</td>
                <td className="s-r-brok">{r.list_office_name ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="s-gate">
        <div className="s-gate-k">TREB VOW · Registered access</div>
        <div className="s-gate-h">See every closed sale on {streetName}</div>
        <div className="s-gate-p">Free with a verified email — exact sold prices, days on market, and sold-to-ask ratios.</div>
        <Link className="s-gate-btn" href={signinHref}>
          Sign in free to unlock →
        </Link>
      </div>
    </div>
  );
}

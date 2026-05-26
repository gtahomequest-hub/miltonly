"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatCADShort } from "@/lib/charts/theme";
import type { SoldTableRow } from "@/types/street";

interface Props {
  slug: string;
  streetName: string;
}

export function SoldRecordsIsland({ slug, streetName }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "done">("loading");
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
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("done");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const signinHref = `/signin?redirect=${encodeURIComponent(pathname)}&intent=sold&street=${encodeURIComponent(slug)}`;
  const gated = state === "done" && !canSee;

  return (
    <div className={`gated-wrap ${gated ? "is-gated" : ""}`}>
      <table className="data-table">
        <caption>Recent closed sales, {streetName}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Address</th>
            <th scope="col">Beds</th>
            <th scope="col">Sold</th>
            <th scope="col">vs Ask</th>
            <th scope="col">DOM</th>
            <th scope="col">Listing brokerage</th>
          </tr>
        </thead>
        <tbody>
          {state === "loading" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}>
                    <span className="skeleton-line" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 && canSee ? (
            <tr>
              <td
                colSpan={7}
                style={{
                  textAlign: "center",
                  color: "var(--ink-faint)",
                  padding: 32,
                }}
              >
                No recent sales on record.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.mls_number}>
                <td>{r.sold_date.slice(0, 10)}</td>
                <td>{r.address}</td>
                <td>{r.beds ?? "—"}</td>
                <td>{formatCADShort(r.sold_price)}</td>
                <td>{(r.sold_to_ask_ratio * 100).toFixed(0)}%</td>
                <td>{r.days_on_market}d</td>
                <td style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  {r.list_office_name ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {gated && (
        <div className="gate-overlay">
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "var(--gold)",
              textTransform: "uppercase",
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            TREB VOW &middot; Registered access
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            See every closed sale on {streetName}
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 13,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 18,
            }}
          >
            Free with a verified email. Exact sold prices, DOM, and sold-to-ask
            ratios.
          </div>
          <Link
            href={signinHref}
            style={{
              display: "inline-block",
              background: "var(--gold)",
              color: "var(--navy-deep)",
              padding: "12px 24px",
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: "0.02em",
              textDecoration: "none",
            }}
          >
            Sign in free to unlock &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

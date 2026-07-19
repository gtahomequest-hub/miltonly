"use client";

import { useMemo, useState } from "react";

interface Row {
  id: string;
  query: string;
  cls: string;
  entityType: string;
  entitySlug: string | null;
  targetPage: string | null;
  impressions: number;
  clicks: number;
  position: number;
  prevImpressions: number | null;
  prevPosition: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  rows: Row[];
  statusCounts: Record<string, number>;
  classCounts: Record<string, number>;
  lastSenseAt: string | null;
  killSwitchOn: boolean;
}

const CLASS_BADGE: Record<string, string> = {
  SEEN_NOT_CLICKED: "bg-amber-100 text-amber-800",
  STRIKING_DISTANCE: "bg-sky-100 text-sky-800",
  NO_PAGE_MATCH: "bg-slate-200 text-slate-700",
  THIN_ENTITY: "bg-emerald-100 text-emerald-800",
};

export default function AdminSeoClient({ rows, statusCounts, classCounts, lastSenseAt, killSwitchOn }: Props) {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [classFilter, setClassFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (classFilter === "all" || r.cls === classFilter),
      ),
    [rows, statusFilter, classFilter],
  );

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const act = async (ids: string[], action: "approve" | "reject") => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seo-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const body = await res.json();
      if (res.ok) {
        const thin = rows.filter((r) => ids.includes(r.id) && r.cls === "THIN_ENTITY").length;
        showToast(
          `${action === "approve" ? "Approved" : "Rejected"} ${body.updated} row(s).` +
            (action === "approve" && thin > 0
              ? ` ${thin} THIN_ENTITY row(s) will auto-generate when ACT (piece 4) ships.`
              : ""),
        );
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showToast(`Failed: ${body.error ?? res.status}`);
      }
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  };

  const pendingSelected = Array.from(selected).filter((id) => rows.find((r) => r.id === id)?.status === "pending");

  const deltaCell = (r: Row) => {
    if (r.prevImpressions === null) return `${r.impressions}`;
    const d = r.impressions - r.prevImpressions;
    return `${r.impressions} (${d >= 0 ? "+" : ""}${d})`;
  };
  const posCell = (r: Row) => {
    if (r.prevPosition === null) return r.position.toFixed(1);
    const d = r.position - r.prevPosition;
    return `${r.position.toFixed(1)} (${d <= 0 ? "" : "+"}${d.toFixed(1)})`;
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header + summary strip */}
      <div className="bg-[#07111f] text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-extrabold">Miltonly Admin — SEO Queue</h1>
          <a href="/admin/review" className="text-[12px] text-[#94a3b8] hover:text-white">
            Content Review &rarr;
          </a>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[11px]">
          {Object.entries(statusCounts).map(([s, n]) => (
            <span key={s} className={s === "pending" ? "text-[#f59e0b] font-bold" : "text-[#64748b]"}>
              {n} {s}
            </span>
          ))}
          <span className="text-[#334155]">|</span>
          {Object.entries(classCounts).map(([c, n]) => (
            <span key={c} className="text-[#64748b]">
              {n} {c.toLowerCase().replace(/_/g, " ")}
            </span>
          ))}
          <span className="text-[#334155]">|</span>
          <span className="text-[#64748b]">
            last sense: {lastSenseAt ? lastSenseAt.slice(0, 16).replace("T", " ") + "Z" : "never"}
          </span>
          <span className={killSwitchOn ? "text-emerald-400" : "text-red-400 font-bold"}>
            loop {killSwitchOn ? "ENABLED" : "DISABLED (kill switch)"}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters + bulk bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[13px] border border-[#e2e8f0] rounded-lg px-3 py-2 bg-white"
          >
            {["pending", "approved", "rejected", "auto_queued", "done", "all"].map((s) => (
              <option key={s} value={s}>
                status: {s}
              </option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="text-[13px] border border-[#e2e8f0] rounded-lg px-3 py-2 bg-white"
          >
            {["all", "SEEN_NOT_CLICKED", "STRIKING_DISTANCE", "NO_PAGE_MATCH", "THIN_ENTITY"].map((c) => (
              <option key={c} value={c}>
                class: {c === "all" ? "all" : c.toLowerCase().replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-[#64748b]">{visible.length} shown</span>

          {pendingSelected.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[12px] text-[#64748b]">{pendingSelected.length} selected</span>
              <button
                disabled={busy}
                onClick={() => act(pendingSelected, "approve")}
                className="text-[12px] font-bold bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve selected
              </button>
              <button
                disabled={busy}
                onClick={() => act(pendingSelected, "reject")}
                className="text-[12px] font-bold bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50"
              >
                Reject selected
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#94a3b8] border-b border-[#e2e8f0]">
                <th className="px-3 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">Query</th>
                <th className="px-3 py-2.5">Class</th>
                <th className="px-3 py-2.5">Impr</th>
                <th className="px-3 py-2.5">Clk</th>
                <th className="px-3 py-2.5">Pos</th>
                <th className="px-3 py-2.5">Riding / target</th>
                <th className="px-3 py-2.5">Entity</th>
                <th className="px-3 py-2.5">Detected</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-3 py-2">
                    {r.status === "pending" && (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-[#0f172a]">{r.query}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${CLASS_BADGE[r.cls] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {r.cls.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{deltaCell(r)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.clicks}</td>
                  <td className="px-3 py-2 tabular-nums">{posCell(r)}</td>
                  <td className="px-3 py-2">
                    {r.targetPage ? (
                      <a
                        href={r.targetPage}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 hover:underline"
                      >
                        {r.targetPage}
                      </a>
                    ) : (
                      <span className="text-[#94a3b8]">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#475569]">{r.entitySlug ?? "-"}</td>
                  <td className="px-3 py-2 text-[#94a3b8] whitespace-nowrap">{r.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.status === "pending" ? (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => act([r.id], "approve")}
                          className="text-[11px] font-bold text-emerald-700 hover:underline mr-3 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => act([r.id], "reject")}
                          className="text-[11px] font-bold text-red-700 hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#94a3b8]">
                        {r.status} {r.updatedAt.slice(0, 10)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[#94a3b8]">
                    Nothing matches this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#07111f] text-white text-[13px] px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

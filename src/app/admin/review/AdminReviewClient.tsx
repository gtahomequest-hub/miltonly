"use client";

import { useState } from "react";

interface Draft {
  id: string;
  streetSlug: string;
  streetName: string;
  neighbourhood: string | null;
  description: string;
  rawAiOutput: string | null;
  status: string;
  needsReview: boolean;
  aiGenerated: boolean;
  attempts: number;
  reviewNotes: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  faqJson: string | null;
  statsJson: string | null;
  marketDataHash: string | null;
  generatedAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  drafts: Draft[];
  recentPublished: { streetSlug: string; streetName: string; publishedAt: string | null }[];
  queueStats: { pending: number; processing: number; failed: number; ineligible: number };
}

export default function AdminReviewClient({ drafts, recentPublished, queueStats }: Props) {
  const [selected, setSelected] = useState<Draft | null>(null);
  const [editedText, setEditedText] = useState("");
  const [toast, setToast] = useState("");
  const [publishing, setPublishing] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const openDraft = (draft: Draft) => {
    setSelected(draft);
    setEditedText(draft.description);
  };

  const handlePublish = async () => {
    if (!selected || !editedText.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetSlug: selected.streetSlug, description: editedText }),
      });
      if (res.ok) {
        showToast(`Published: ${selected.streetName}`);
        setSelected(null);
        window.location.reload();
      } else {
        showToast("Publish failed — check console");
      }
    } catch {
      showToast("Network error");
    }
    setPublishing(false);
  };

  const handleReject = async () => {
    if (!selected) return;
    const reason = prompt("Rejection reason (optional):");
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetSlug: selected.streetSlug, reviewNotes: reason || "" }),
      });
      if (res.ok) {
        showToast(`Rejected: ${selected.streetName}`);
        setSelected(null);
        window.location.reload();
      }
    } catch {
      showToast("Network error");
    }
  };

  const parseStats = (statsJson: string | null) => {
    if (!statsJson) return null;
    try {
      return JSON.parse(statsJson);
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <div className="bg-[#07111f] text-white px-6 py-4">
        <h1 className="text-[18px] font-extrabold">Miltonly Admin — Content Review</h1>
        <div className="flex gap-6 mt-2 text-[11px]">
          <span className="text-[#f59e0b] font-bold">{drafts.length} drafts to review</span>
          <span className="text-[#64748b]">{queueStats.pending} pending in queue</span>
          <span className="text-[#64748b]">{queueStats.processing} processing</span>
          {queueStats.failed > 0 && (
            <span className="text-red-400">{queueStats.failed} failed</span>
          )}
          <span className="text-[#64748b]">{queueStats.ineligible} ineligible</span>
        </div>
      </div>

      {selected ? (
        /* ═══ SPLIT-VIEW EDITOR ═══ */
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={() => setSelected(null)}
            className="text-[12px] text-[#64748b] hover:text-[#07111f] mb-4 flex items-center gap-1"
          >
            &larr; Back to queue
          </button>

          <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4">
            {selected.streetName}
            {selected.attempts >= 3 && (
              <span className="ml-2 text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                3+ attempts — needs manual attention
              </span>
            )}
          </h2>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* LEFT — AI Draft (read-only) */}
            <div>
              <h3 className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                AI Draft
              </h3>
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-[13px] text-[#475569] leading-[1.8] whitespace-pre-wrap">
                {selected.rawAiOutput || selected.description}
              </div>

              {/* Stats panel */}
              {(() => {
                const stats = parseStats(selected.statsJson);
                if (!stats) return null;
                return (
                  <div className="mt-4 bg-white border border-[#e2e8f0] rounded-xl p-5">
                    <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-wider mb-3">
                      Key Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <span className="text-[#94a3b8]">Avg sold price</span>
                        <p className="font-bold text-[#07111f]">
                          ${stats.avgSoldPrice?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Days on market</span>
                        <p className="font-bold text-[#07111f]">{stats.avgDOM} days</p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Sold vs ask</span>
                        <p className="font-bold text-[#07111f]">{stats.soldVsAskPct}%</p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Sold (12mo)</span>
                        <p className="font-bold text-[#07111f]">{stats.totalSold12mo}</p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Neighbourhood</span>
                        <p className="font-bold text-[#07111f]">{stats.neighbourhood}</p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">School zone</span>
                        <p className="font-bold text-[#07111f]">{stats.schoolZone || "—"}</p>
                      </div>
                    </div>
                    {stats.totalSold12mo < 4 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                        Low data — only {stats.totalSold12mo} sales. Consider writing manually.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-4 text-[10px] text-[#94a3b8]">
                Generated: {new Date(selected.generatedAt).toLocaleString()} · Attempts:{" "}
                {selected.attempts}
              </div>
            </div>

            {/* RIGHT — Editable version */}
            <div>
              <h3 className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                Your Version
              </h3>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full bg-white border border-[#e2e8f0] rounded-xl p-5 text-[13px] text-[#07111f] leading-[1.8] outline-none focus:border-[#2563eb] resize-none"
                rows={16}
              />

              <div className="text-[11px] text-[#94a3b8] mt-2 mb-4">
                {editedText.split(/\s+/).filter(Boolean).length} words
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="bg-[#16a34a] text-white text-[13px] font-bold px-6 py-2.5 rounded-lg hover:bg-[#15803d] transition-colors disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish"}
                </button>
                <button
                  onClick={() => setEditedText(selected.rawAiOutput || selected.description)}
                  className="bg-white border border-[#e2e8f0] text-[#475569] text-[13px] font-medium px-6 py-2.5 rounded-lg hover:border-[#07111f] transition-colors"
                >
                  Reset to AI draft
                </button>
                <button
                  onClick={handleReject}
                  className="bg-white border border-red-200 text-red-600 text-[13px] font-medium px-6 py-2.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ QUEUE LIST ═══ */
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h2 className="text-[16px] font-extrabold text-[#07111f] mb-4">
            Drafts waiting for your review
          </h2>

          {drafts.length === 0 ? (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center">
              <p className="text-[14px] font-bold text-[#07111f] mb-1">All caught up</p>
              <p className="text-[12px] text-[#64748b]">No drafts waiting for review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => {
                const stats = parseStats(draft.statsJson);
                const ago = timeAgo(draft.generatedAt);
                return (
                  <button
                    key={draft.id}
                    onClick={() => openDraft(draft)}
                    className="w-full text-left bg-white border border-[#e2e8f0] rounded-xl px-5 py-4 hover:shadow-md transition-shadow flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[14px] font-bold text-[#07111f]">{draft.streetName}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        {stats?.neighbourhood || "Milton"} · {ago}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-[#94a3b8]">
                      {stats && (
                        <span>
                          {stats.totalSold12mo} sales · ${Math.round((stats.avgSoldPrice || 0) / 1000)}K ·{" "}
                          {stats.avgDOM}d
                        </span>
                      )}
                      {stats?.totalSold12mo < 4 && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                          LOW DATA
                        </span>
                      )}
                      <span className="text-[#2563eb] font-semibold">Review &rarr;</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent published */}
          {recentPublished.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[14px] font-extrabold text-[#07111f] mb-3">
                Recently published
              </h2>
              <div className="space-y-1">
                {recentPublished.map((p) => (
                  <div
                    key={p.streetSlug}
                    className="flex items-center justify-between text-[12px] py-2 border-b border-[#f1f5f9]"
                  >
                    <a
                      href={`/streets/${p.streetSlug}`}
                      className="text-[#07111f] font-medium hover:text-[#2563eb]"
                    >
                      {p.streetName}
                    </a>
                    <span className="text-[#94a3b8]">
                      {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#07111f] border border-[#22c55e] rounded-xl px-4 py-3 text-[13px] text-[#f8f9fb] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

"use client";

import { useUser } from "@/components/UserProvider";
import { useEffect, useState } from "react";
import Link from "next/link";

interface SavedSearchData {
  id: string;
  name: string;
  propertyType: string | null;
  neighbourhood: string | null;
  streetSlug: string | null;
  priceMin: number | null;
  priceMax: number | null;
  bedsMin: number | null;
  bathsMin: number | null;
  transactionType: string | null;
  alertEnabled: boolean;
  alertFrequency: string;
  lastMatchCount: number;
  createdAt: string;
}

interface ListingPreview {
  mlsNumber: string;
  address: string;
  price: number;
  propertyType: string;
  status: string;
  streetSlug: string;
  bedrooms: number | null;
  bathrooms: number | null;
}

type Tab = "listings" | "searches";

export default function SavedDashboard() {
  const { user, loading, unsaveListing } = useUser();
  const [tab, setTab] = useState<Tab>("listings");
  const [savedListings, setSavedListings] = useState<ListingPreview[]>([]);
  const [searches, setSearches] = useState<SavedSearchData[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [searchesLoading, setSearchesLoading] = useState(false);

  // New search form state
  const [showNewSearch, setShowNewSearch] = useState(false);
  const [newSearch, setNewSearch] = useState({
    name: "",
    propertyType: "",
    neighbourhood: "",
    priceMin: "",
    priceMax: "",
    bedsMin: "",
    transactionType: "For Sale",
  });

  useEffect(() => {
    if (!user) return;

    // Fetch saved listings
    if (user.savedListings.length > 0) {
      setListingsLoading(true);
      fetch(`/api/auth/saved-listings?mls=${user.savedListings.join(",")}`)
        .then((r) => r.json())
        .then((d) => setSavedListings(d.listings || []))
        .catch(() => {})
        .finally(() => setListingsLoading(false));
    }

    // Fetch saved searches
    setSearchesLoading(true);
    fetch("/api/auth/saved-searches")
      .then((r) => r.json())
      .then((d) => setSearches(d.searches || []))
      .catch(() => {})
      .finally(() => setSearchesLoading(false));
  }, [user]);

  const handleRemoveListing = async (mlsNumber: string) => {
    await unsaveListing(mlsNumber);
    setSavedListings((prev) => prev.filter((l) => l.mlsNumber !== mlsNumber));
  };

  const handleDeleteSearch = async (searchId: string) => {
    await fetch("/api/auth/saved-searches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchId }),
    });
    setSearches((prev) => prev.filter((s) => s.id !== searchId));
  };

  const handleCreateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSearch.name) return;
    const res = await fetch("/api/auth/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSearch),
    });
    const data = await res.json();
    if (data.search) {
      setSearches((prev) => [data.search, ...prev]);
      setNewSearch({ name: "", propertyType: "", neighbourhood: "", priceMin: "", priceMax: "", bedsMin: "", transactionType: "For Sale" });
      setShowNewSearch(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5">
        <div className="text-center max-w-[400px]">
          <div className="text-[48px] mb-4">&#9825;</div>
          <h1 className="text-[24px] font-extrabold text-[#07111f] mb-3 tracking-[-0.02em]">Saved Listings & Alerts</h1>
          <p className="text-[14px] text-[#64748b] mb-8 leading-relaxed">
            Sign in to save listings, create search alerts, and get notified when new properties match your criteria.
          </p>
          <Link
            href="/signin"
            className="inline-block bg-[#07111f] text-[#f59e0b] text-[14px] font-bold px-8 py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors"
          >
            Sign in to get started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <section className="bg-[#07111f] px-5 sm:px-11 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb] tracking-[-0.02em]">
              Welcome back{user.firstName ? `, ${user.firstName}` : ""}
            </h1>
            <p className="text-[13px] text-[rgba(248,249,251,0.5)] mt-1">{user.email}</p>
          </div>
          <button
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).then(() => window.location.reload());
            }}
            className="text-[12px] text-[#94a3b8] hover:text-[#f8f9fb] transition-colors self-start"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11">
        <div className="max-w-6xl mx-auto flex gap-0">
          {([["listings", `Saved listings (${user.savedListings.length})`], ["searches", `Search alerts (${searches.length})`]] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-3.5 text-[13px] font-bold border-b-2 transition-colors ${
                  tab === key
                    ? "text-[#07111f] border-[#f59e0b]"
                    : "text-[#94a3b8] border-transparent hover:text-[#07111f]"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-5 sm:px-11 py-8">
        {tab === "listings" && (
          <div>
            {listingsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : savedListings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[48px] mb-3">&#9825;</p>
                <p className="text-[16px] font-bold text-[#07111f] mb-2">No saved listings yet</p>
                <p className="text-[13px] text-[#94a3b8] mb-6">Browse listings and tap the heart to save them here</p>
                <Link
                  href="/listings"
                  className="inline-block bg-[#07111f] text-[#f59e0b] text-[13px] font-bold px-6 py-3 rounded-xl hover:bg-[#0c1e35] transition-colors"
                >
                  Browse listings
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedListings.map((listing) => (
                  <div key={listing.mlsNumber} className="bg-white rounded-xl border border-[#e2e8f0] p-5 relative group">
                    <button
                      onClick={() => handleRemoveListing(listing.mlsNumber)}
                      className="absolute top-3 right-3 text-[18px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from saved"
                    >
                      &times;
                    </button>
                    <Link href={`/listings/${listing.mlsNumber}`}>
                      <p className="text-[14px] font-bold text-[#07111f] mb-1">{listing.address}</p>
                      <p className="text-[20px] font-extrabold text-[#07111f]">${listing.price.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-[#94a3b8]">{listing.propertyType}</span>
                        {listing.bedrooms && <span className="text-[11px] text-[#94a3b8]">{listing.bedrooms} bed</span>}
                        {listing.bathrooms && <span className="text-[11px] text-[#94a3b8]">{listing.bathrooms} bath</span>}
                      </div>
                      <span
                        className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          listing.status === "active"
                            ? "bg-green-100 text-green-700"
                            : listing.status === "sold"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {listing.status}
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "searches" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[13px] text-[#64748b]">Get email alerts when new listings match your criteria</p>
              <button
                onClick={() => setShowNewSearch(!showNewSearch)}
                className="bg-[#07111f] text-[#f59e0b] text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-[#0c1e35] transition-colors"
              >
                {showNewSearch ? "Cancel" : "+ New alert"}
              </button>
            </div>

            {showNewSearch && (
              <form onSubmit={handleCreateSearch} className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Alert name</label>
                    <input
                      type="text"
                      required
                      value={newSearch.name}
                      onChange={(e) => setNewSearch({ ...newSearch, name: e.target.value })}
                      placeholder='e.g. "Detached under $1.2M in Scott"'
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Property type</label>
                    <select
                      value={newSearch.propertyType}
                      onChange={(e) => setNewSearch({ ...newSearch, propertyType: e.target.value })}
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    >
                      <option value="">Any</option>
                      <option value="detached">Detached</option>
                      <option value="semi">Semi-detached</option>
                      <option value="townhouse">Townhouse</option>
                      <option value="condo">Condo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Neighbourhood</label>
                    <input
                      type="text"
                      value={newSearch.neighbourhood}
                      onChange={(e) => setNewSearch({ ...newSearch, neighbourhood: e.target.value })}
                      placeholder="e.g. Scott, Willmott"
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Min price</label>
                    <input
                      type="number"
                      value={newSearch.priceMin}
                      onChange={(e) => setNewSearch({ ...newSearch, priceMin: e.target.value })}
                      placeholder="e.g. 500000"
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Max price</label>
                    <input
                      type="number"
                      value={newSearch.priceMax}
                      onChange={(e) => setNewSearch({ ...newSearch, priceMax: e.target.value })}
                      placeholder="e.g. 1200000"
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Min bedrooms</label>
                    <select
                      value={newSearch.bedsMin}
                      onChange={(e) => setNewSearch({ ...newSearch, bedsMin: e.target.value })}
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    >
                      <option value="">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                      <option value="5">5+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#374151] mb-1">Transaction</label>
                    <select
                      value={newSearch.transactionType}
                      onChange={(e) => setNewSearch({ ...newSearch, transactionType: e.target.value })}
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]"
                    >
                      <option value="For Sale">For Sale</option>
                      <option value="For Lease">For Lease</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-5 bg-[#07111f] text-[#f59e0b] text-[13px] font-bold px-6 py-2.5 rounded-lg hover:bg-[#0c1e35] transition-colors"
                >
                  Create alert
                </button>
              </form>
            )}

            {searchesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searches.length === 0 && !showNewSearch ? (
              <div className="text-center py-12">
                <p className="text-[48px] mb-3">&#128276;</p>
                <p className="text-[16px] font-bold text-[#07111f] mb-2">No search alerts yet</p>
                <p className="text-[13px] text-[#94a3b8] mb-6">Create an alert to get notified when new listings match your criteria</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searches.map((search) => (
                  <div key={search.id} className="bg-white rounded-xl border border-[#e2e8f0] p-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-bold text-[#07111f]">{search.name}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {search.propertyType && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full capitalize">
                            {search.propertyType}
                          </span>
                        )}
                        {search.neighbourhood && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                            {search.neighbourhood}
                          </span>
                        )}
                        {search.priceMin && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                            Min ${(search.priceMin / 1000).toFixed(0)}K
                          </span>
                        )}
                        {search.priceMax && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                            Max ${(search.priceMax / 1000).toFixed(0)}K
                          </span>
                        )}
                        {search.bedsMin && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                            {search.bedsMin}+ beds
                          </span>
                        )}
                        {search.transactionType && (
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                            {search.transactionType}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#94a3b8] mt-2">
                        {search.alertEnabled ? `Daily alerts · ${search.lastMatchCount} matches last check` : "Alerts paused"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSearch(search.id)}
                      className="text-[12px] text-[#94a3b8] hover:text-red-500 transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

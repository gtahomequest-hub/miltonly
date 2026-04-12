"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

interface Listing {
  id: string;
  title: string;
  address: string;
  city: string;
  price: number;
  priceType: string;
  bedsMin: number;
  bedsMax: number;
  baths: number;
  parking: number;
  propertyType: string;
  status: string;
  badge: string;
  description: string;
  photos: string[];
  slug: string;
  sqft: number | null;
  yearBuilt: number | null;
  lotSize: string | null;
  maintenance: number | null;
  taxes: number | null;
  taxYear: number | null;
  heating: string | null;
  cooling: string | null;
  basement: string | null;
  garage: string | null;
  exterior: string | null;
  locker: string | null;
  exposure: string | null;
  petFriendly: boolean | null;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  rooms: unknown;
  createdAt: string;
  updatedAt: string;
}

const emptyDraft: Omit<Listing, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  address: "",
  city: "Milton, ON",
  price: 0,
  priceType: "sale",
  bedsMin: 0,
  bedsMax: 0,
  baths: 0,
  parking: 0,
  propertyType: "Condo",
  status: "active",
  badge: "Exclusive",
  description: "",
  photos: [],
  slug: "",
  sqft: null,
  yearBuilt: null,
  lotSize: null,
  maintenance: null,
  taxes: null,
  taxYear: null,
  heating: null,
  cooling: null,
  basement: null,
  garage: null,
  exterior: null,
  locker: null,
  exposure: null,
  petFriendly: null,
  interiorFeatures: [],
  exteriorFeatures: [],
  rooms: null,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function ExclusiveAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const [editing, setEditing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState({
    ...emptyDraft,
    photosText: "",
    interiorFeaturesText: "",
    exteriorFeaturesText: "",
    roomsText: "",
  });
  const [showForm, setShowForm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exclusive");
      if (res.status === 401) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setListings(data.listings || []);
      setAuthed(true);
    } catch {
      showToast("Failed to load listings");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLoginErr("");
      await loadListings();
    } else {
      setLoginErr("Wrong password");
    }
  };

  const openNew = () => {
    setEditing(null);
    setDraft({
      ...emptyDraft,
      photosText: "",
      interiorFeaturesText: "",
      exteriorFeaturesText: "",
      roomsText: "",
    });
    setShowForm(true);
  };

  const openEdit = (l: Listing) => {
    setEditing(l);
    setDraft({
      title: l.title,
      address: l.address,
      city: l.city,
      price: l.price,
      priceType: l.priceType,
      bedsMin: l.bedsMin,
      bedsMax: l.bedsMax,
      baths: l.baths,
      parking: l.parking,
      propertyType: l.propertyType,
      status: l.status,
      badge: l.badge,
      description: l.description,
      photos: l.photos,
      slug: l.slug,
      sqft: l.sqft,
      yearBuilt: l.yearBuilt,
      lotSize: l.lotSize,
      maintenance: l.maintenance,
      taxes: l.taxes,
      taxYear: l.taxYear,
      heating: l.heating,
      cooling: l.cooling,
      basement: l.basement,
      garage: l.garage,
      exterior: l.exterior,
      locker: l.locker,
      exposure: l.exposure,
      petFriendly: l.petFriendly,
      interiorFeatures: l.interiorFeatures || [],
      exteriorFeatures: l.exteriorFeatures || [],
      rooms: l.rooms,
      photosText: l.photos.join("\n"),
      interiorFeaturesText: (l.interiorFeatures || []).join("\n"),
      exteriorFeaturesText: (l.exteriorFeatures || []).join("\n"),
      roomsText: l.rooms ? JSON.stringify(l.rooms, null, 2) : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const photos = draft.photosText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const interiorFeatures = draft.interiorFeaturesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const exteriorFeatures = draft.exteriorFeaturesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    let rooms: unknown = null;
    if (draft.roomsText.trim()) {
      try {
        rooms = JSON.parse(draft.roomsText);
      } catch {
        showToast("Rooms JSON is invalid — fix it and save again");
        return;
      }
    }
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      title: draft.title,
      address: draft.address,
      city: draft.city,
      price: Number(draft.price) || 0,
      priceType: draft.priceType,
      bedsMin: Number(draft.bedsMin) || 0,
      bedsMax: Number(draft.bedsMax) || 0,
      baths: Number(draft.baths) || 0,
      parking: Number(draft.parking) || 0,
      propertyType: draft.propertyType,
      status: draft.status,
      badge: draft.badge,
      description: draft.description,
      photos,
      slug: draft.slug || slugify(`${draft.address}-${draft.city}`),
      sqft: draft.sqft,
      yearBuilt: draft.yearBuilt,
      lotSize: draft.lotSize,
      maintenance: draft.maintenance,
      taxes: draft.taxes,
      taxYear: draft.taxYear,
      heating: draft.heating,
      cooling: draft.cooling,
      basement: draft.basement,
      garage: draft.garage,
      exterior: draft.exterior,
      locker: draft.locker,
      exposure: draft.exposure,
      petFriendly: draft.petFriendly,
      interiorFeatures,
      exteriorFeatures,
      rooms,
    };
    const res = await fetch("/api/admin/exclusive", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast(editing ? "Listing updated" : "Listing created");
      setShowForm(false);
      setEditing(null);
      await loadListings();
    } else {
      showToast("Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/exclusive?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Deleted");
      await loadListings();
    } else {
      showToast("Delete failed");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
        });
        newUrls.push(blob.url);
        setUploadProgress({ done: i + 1, total: files.length });
      } catch (err) {
        console.error("Upload failed:", err);
        showToast(`Upload failed for ${file.name}`);
      }
    }
    if (newUrls.length > 0) {
      setDraft((d) => {
        const existing = d.photosText.trim();
        const appended = existing ? `${existing}\n${newUrls.join("\n")}` : newUrls.join("\n");
        return { ...d, photosText: appended };
      });
      showToast(`Uploaded ${newUrls.length} photo${newUrls.length === 1 ? "" : "s"}`);
    }
    setUploading(false);
    setUploadProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setDraft((d) => {
      const lines = d.photosText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      lines.splice(idx, 1);
      return { ...d, photosText: lines.join("\n") };
    });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-8 w-full max-w-sm"
        >
          <h1 className="text-[20px] font-extrabold text-[#f8f9fb] mb-1">Exclusive Listings Admin</h1>
          <p className="text-[12px] text-[#64748b] mb-6">Enter your password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-3 py-2.5 text-[13px] bg-[#07111f] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[#334155] outline-none focus:border-[#f59e0b] mb-4"
          />
          <button
            type="submit"
            className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-2.5 hover:bg-[#fbbf24] transition-colors"
          >
            Sign in
          </button>
          {loginErr && <p className="text-[12px] text-red-400 mt-3 text-center">{loginErr}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-extrabold text-[#07111f] tracking-[-0.02em]">Exclusive Listings Admin</h1>
            <p className="text-[12px] text-[#64748b] mt-1">{listings.length} listing{listings.length === 1 ? "" : "s"}</p>
          </div>
          <button
            onClick={openNew}
            className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl px-5 py-2.5 hover:bg-[#fbbf24] transition-colors"
          >
            + Add New Listing
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#64748b]">Loading…</p>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center">
            <p className="text-[14px] text-[#64748b]">No exclusive listings yet. Click &quot;Add New Listing&quot; to create one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#f1f5f9] border-b border-[#e2e8f0]">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Address</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">City</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Beds</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Badge</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-b border-[#f1f5f9] hover:bg-[#f8f9fb]">
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#07111f]">{l.address}</td>
                    <td className="px-4 py-3 text-[12px] text-[#475569]">{l.city}</td>
                    <td className="px-4 py-3 text-[12px] text-[#07111f] font-bold">
                      ${l.price.toLocaleString()}
                      {l.priceType === "rent" && <span className="text-[10px] text-[#64748b] font-normal">/mo</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#475569] capitalize">{l.priceType}</td>
                    <td className="px-4 py-3 text-[12px] text-[#475569]">
                      {l.bedsMax > 0 ? `${l.bedsMin}+${l.bedsMax}` : l.bedsMin}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#475569]">{l.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">{l.badge}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(l)}
                        className="text-[11px] font-bold text-[#f59e0b] hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(l.id)}
                        className="text-[11px] font-bold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-extrabold text-[#07111f]">
                {editing ? "Edit listing" : "New listing"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[18px] text-[#64748b] hover:text-[#07111f]">✕</button>
            </div>
            <div className="space-y-3">
              <Field label="Title">
                <input
                  className="form-input"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="Address">
                <input
                  className="form-input"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  onBlur={() => {
                    if (!draft.slug && draft.address) {
                      setDraft((d) => ({ ...d, slug: slugify(`${d.address}-${d.city}`) }));
                    }
                  }}
                />
              </Field>
              <Field label="City">
                <input
                  className="form-input"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (no $ sign)">
                  <input
                    type="number"
                    className="form-input"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Price Type">
                  <select
                    className="form-input"
                    value={draft.priceType}
                    onChange={(e) => setDraft({ ...draft, priceType: e.target.value })}
                  >
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Beds min">
                  <input
                    type="number"
                    className="form-input"
                    value={draft.bedsMin}
                    onChange={(e) => setDraft({ ...draft, bedsMin: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Beds max (+den)">
                  <input
                    type="number"
                    className="form-input"
                    value={draft.bedsMax}
                    onChange={(e) => setDraft({ ...draft, bedsMax: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Baths">
                  <input
                    type="number"
                    className="form-input"
                    value={draft.baths}
                    onChange={(e) => setDraft({ ...draft, baths: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Parking">
                  <input
                    type="number"
                    className="form-input"
                    value={draft.parking}
                    onChange={(e) => setDraft({ ...draft, parking: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Property Type">
                  <select
                    className="form-input"
                    value={draft.propertyType}
                    onChange={(e) => setDraft({ ...draft, propertyType: e.target.value })}
                  >
                    <option>Detached</option>
                    <option>Semi-Detached</option>
                    <option>Townhouse</option>
                    <option>Condo</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    className="form-input"
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    <option value="active">active</option>
                    <option value="coming-soon">coming-soon</option>
                    <option value="sold">sold</option>
                    <option value="leased">leased</option>
                  </select>
                </Field>
                <Field label="Badge">
                  <select
                    className="form-input"
                    value={draft.badge}
                    onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                  >
                    <option>Exclusive</option>
                    <option>For Rent</option>
                    <option>For Sale</option>
                    <option>Off-Market</option>
                    <option>Coming Soon</option>
                    <option>Just Listed</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  className="form-input min-h-[120px]"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>

              <div className="pt-3 mt-3 border-t border-[#e2e8f0]">
                <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Property details</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Sqft">
                    <input
                      type="number"
                      className="form-input"
                      value={draft.sqft ?? ""}
                      onChange={(e) => setDraft({ ...draft, sqft: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  <Field label="Year built">
                    <input
                      type="number"
                      className="form-input"
                      value={draft.yearBuilt ?? ""}
                      onChange={(e) => setDraft({ ...draft, yearBuilt: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  <Field label="Lot size">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="40 x 110 ft or N/A"
                      value={draft.lotSize ?? ""}
                      onChange={(e) => setDraft({ ...draft, lotSize: e.target.value || null })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="Maintenance / mo">
                    <input
                      type="number"
                      className="form-input"
                      value={draft.maintenance ?? ""}
                      onChange={(e) => setDraft({ ...draft, maintenance: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  <Field label="Taxes / yr">
                    <input
                      type="number"
                      className="form-input"
                      value={draft.taxes ?? ""}
                      onChange={(e) => setDraft({ ...draft, taxes: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  <Field label="Tax year">
                    <input
                      type="number"
                      className="form-input"
                      value={draft.taxYear ?? ""}
                      onChange={(e) => setDraft({ ...draft, taxYear: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Heating">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Forced Air Gas"
                      value={draft.heating ?? ""}
                      onChange={(e) => setDraft({ ...draft, heating: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Cooling">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Central Air"
                      value={draft.cooling ?? ""}
                      onChange={(e) => setDraft({ ...draft, cooling: e.target.value || null })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Basement">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="None / Finished"
                      value={draft.basement ?? ""}
                      onChange={(e) => setDraft({ ...draft, basement: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Garage">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Underground"
                      value={draft.garage ?? ""}
                      onChange={(e) => setDraft({ ...draft, garage: e.target.value || null })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="Exterior">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Brick"
                      value={draft.exterior ?? ""}
                      onChange={(e) => setDraft({ ...draft, exterior: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Locker">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Owned #134"
                      value={draft.locker ?? ""}
                      onChange={(e) => setDraft({ ...draft, locker: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Exposure">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="South"
                      value={draft.exposure ?? ""}
                      onChange={(e) => setDraft({ ...draft, exposure: e.target.value || null })}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.petFriendly ?? false}
                    onChange={(e) => setDraft({ ...draft, petFriendly: e.target.checked })}
                    className="w-4 h-4 accent-[#f59e0b]"
                  />
                  <span className="text-[12px] text-[#07111f] font-semibold">Pet friendly</span>
                </label>
              </div>

              <Field label="Interior features (one per line)">
                <textarea
                  className="form-input min-h-[90px] text-[12px]"
                  placeholder="Ensuite Laundry&#10;Central Air&#10;Open Concept"
                  value={draft.interiorFeaturesText}
                  onChange={(e) => setDraft({ ...draft, interiorFeaturesText: e.target.value })}
                />
              </Field>

              <Field label="Exterior features (one per line)">
                <textarea
                  className="form-input min-h-[70px] text-[12px]"
                  placeholder="Balcony&#10;Visitor Parking"
                  value={draft.exteriorFeaturesText}
                  onChange={(e) => setDraft({ ...draft, exteriorFeaturesText: e.target.value })}
                />
              </Field>

              <Field label="Rooms (JSON array)">
                <textarea
                  className="form-input min-h-[140px] font-mono text-[11px]"
                  placeholder={`[\n  {"name":"Living","level":"Main","size":"17 x 13 ft","notes":"W/O to balcony"}\n]`}
                  value={draft.roomsText}
                  onChange={(e) => setDraft({ ...draft, roomsText: e.target.value })}
                />
                <p className="text-[11px] text-[#64748b] mt-1">
                  JSON array of rooms. Each object needs: name, level, size, notes.
                </p>
              </Field>

              <Field label="Photos">
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-[#07111f] text-[#f8f9fb] text-[12px] font-bold rounded-lg px-4 py-2 hover:bg-[#1e3a5f] disabled:opacity-60"
                  >
                    {uploading
                      ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                      : "📤 Upload photos"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <span className="text-[11px] text-[#64748b] self-center">
                    Choose one or many · auto-added below
                  </span>
                </div>
                {/* Photo thumbnails */}
                {draft.photosText.trim() && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {draft.photosText
                      .split("\n")
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((url, i) => (
                        <div key={`${url}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-[#e2e8f0] bg-[#f1f5f9]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600"
                            aria-label="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                <textarea
                  className="form-input min-h-[80px] font-mono text-[11px]"
                  placeholder="Or paste URLs manually, one per line"
                  value={draft.photosText}
                  onChange={(e) => setDraft({ ...draft, photosText: e.target.value })}
                />
                <p className="text-[11px] text-[#64748b] mt-1">
                  Uploaded photos are stored on Vercel Blob. You can also paste direct image URLs.
                </p>
              </Field>
              <Field label="Slug">
                <input
                  className="form-input"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="auto-generated from address"
                />
              </Field>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl py-3 hover:bg-[#fbbf24]"
              >
                {editing ? "Save changes" : "Create listing"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 text-[13px] font-bold text-[#64748b] hover:text-[#07111f]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#07111f] text-[#f8f9fb] px-5 py-3 rounded-xl text-[13px] font-semibold shadow-lg z-50">
          {toast}
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 10px 12px;
          font-size: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          color: #07111f;
          outline: none;
        }
        .form-input:focus {
          border-color: #f59e0b;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  );
}

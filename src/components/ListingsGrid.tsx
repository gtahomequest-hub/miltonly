import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";

interface Listing {
  mlsNumber: string;
  address: string;
  neighbourhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  status: string;
  photos: string[];
  listedAt: Date | string;
}

export default function ListingsGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return <p className="text-[14px] text-[#94a3b8] text-center py-16">No listings match your filters.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {listings.map((l) => {
        const days = daysAgo(new Date(l.listedAt));
        return (
          <Link
            key={l.mlsNumber}
            href={`/listings/${l.mlsNumber}`}
            className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow group"
          >
            <div className="h-[148px] relative bg-gradient-to-br from-[#b0c4de] to-[#93a8c4]">
              {l.photos.length > 0 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photos[0]} alt={l.address} className="w-full h-full object-cover" />
              )}
              <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#07111f] text-[#f59e0b]">
                {days === 0 ? "New today" : days <= 7 ? "New this week" : `${days}d on market`}
              </span>
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/90 text-[#475569] capitalize">
                {l.propertyType}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[19px] font-extrabold text-[#07111f] tracking-[-0.3px]">
                {formatPriceFull(l.price)}
              </p>
              <p className="text-[12px] text-[#64748b] mt-[3px] truncate">{l.address}</p>
              <div className="flex flex-wrap gap-x-[14px] gap-y-1 mt-3 pt-3 border-t border-[#f8fafc]">
                <span className="text-[11px]"><span className="text-[#94a3b8]">Bed </span><span className="text-[#475569] font-bold">{l.bedrooms}</span></span>
                <span className="text-[11px]"><span className="text-[#94a3b8]">Bath </span><span className="text-[#475569] font-bold">{l.bathrooms}</span></span>
                {l.parking > 0 && <span className="text-[11px]"><span className="text-[#94a3b8]">Park </span><span className="text-[#475569] font-bold">{l.parking}</span></span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

'use client';
// src/components/listings/v2/ListingCard.tsx
// The forest-v2 listing card. Data hierarchy: price (serif) with the listing brokerage inside
// it at the same size (TRREB item 27, MC-029) → specs (mono) → address → hood chip → book CTA.
// States designed here: active sale (default) / lease (/mo + amber type pill) / no-photo /
// no-sqft (spec simply omitted) / redacted address / saved heart. The sold treatment, the
// "new" badge and the day count are gone (MC-029): a card never carries a VOW-only fact
// (src/lib/listings/vow.ts). An acknowledged session's card carries `vow`, rendered below the
// hood chip; anonymous cards have no such field to render.
// Save + book behaviors are props-driven so the island owns wiring.

import Link from 'next/link';
import type { ListingCardData } from './types';
import { fullPrice, titleCase, cleanHood, TYPE_LABELS } from './format';
import ListingBrokerage from '@/components/listings/ListingBrokerage';
import { BedIcon, BathIcon, SqftIcon, CarIcon, HeartIcon, CameraIcon, PinIcon, TourIcon } from './icons';

export interface ListingCardProps {
  listing: ListingCardData;
  saved: boolean;
  onSave: (mls: string) => void;
  onBook: (listing: ListingCardData) => void;
}

export function ListingCard({ listing: l, saved, onSave, onBook }: ListingCardProps) {
  const isLease = l.transactionType === 'For Lease';
  const addr = l.displayAddress ? titleCase(l.address) : 'Address on request';
  const hood = cleanHood(l.neighbourhood);

  return (
    <article className="lv-lcard">
      {/* photo */}
      <div className="lv-lphoto">
        {l.photos[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={l.photos[0]} alt={addr} loading="lazy" />
        ) : (
          <div className="lv-nophoto">
            <PinIcon />
            Photos coming soon
          </div>
        )}

        <div className="lv-badges">
          {l.virtualTourUrl && (
            <span className="lv-badge lv-tour">
              <TourIcon /> 3D tour
            </span>
          )}
        </div>

        {l.photos.length > 1 && (
          <span className="lv-photocount">
            <CameraIcon />
            {l.photos.length}
          </span>
        )}

        <button
          type="button"
          className={`lv-heart${saved ? ' lv-saved' : ''}`}
          aria-label={saved ? 'Remove from saved homes' : 'Save this home'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave(l.mlsNumber);
          }}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>

      {/* body */}
      <div className="lv-lbody">
        <div className="lv-lrow1">
          <div>
            <div className="lv-lprice" data-price>
              {fullPrice(l.price)}
              {isLease && <span className="lv-permo">/mo</span>}
              <ListingBrokerage name={l.listOfficeName} />
            </div>
          </div>
          <span className={`lv-typepill${isLease ? ' lv-lease' : ''}`}>
            {isLease ? `${TYPE_LABELS[l.propertyType] ?? l.propertyType} · Lease` : TYPE_LABELS[l.propertyType] ?? l.propertyType}
          </span>
        </div>

        <div className="lv-lspecs">
          <span>
            <BedIcon />
            {l.bedrooms} bd
          </span>
          <span>
            <BathIcon />
            {l.bathrooms} ba
          </span>
          {l.sqft != null && (
            <span>
              <SqftIcon />
              {l.sqft.toLocaleString()} sqft
            </span>
          )}
          {l.sqft == null && l.parking > 0 && (
            <span>
              <CarIcon />
              {l.parking} pkg
            </span>
          )}
        </div>

        <h3 className={`lv-laddr${l.displayAddress ? '' : ' lv-redacted'}`}>{addr}</h3>

        <div className="lv-lmeta">
          <Link
            className="lv-hoodchip"
            href={`/listings?neighbourhood=${encodeURIComponent(hood)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <PinIcon />
            {hood}
          </Link>
          {l.vow && (
            <span className="lv-dom" data-vow-facts>
              {l.vow.daysOnMarket === 0 ? 'Listed today' : `${l.vow.daysOnMarket}d on market`}
              {l.vow.priorPrice != null && l.vow.priorPrice > 0 && l.vow.priorPrice !== l.price && (
                <> · was {fullPrice(l.vow.priorPrice)}</>
              )}
            </span>
          )}
        </div>

        <div className="lv-lfoot">
          <button
            type="button"
            className="lv-book"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBook(l);
            }}
          >
            Book a showing
          </button>
          <span className="lv-broker">MLS® {l.mlsNumber}</span>
        </div>
      </div>

      {/* whole card clicks through to the detail page */}
      <Link className="lv-stretch" href={`/listings/${l.mlsNumber}`} aria-label={`View ${addr}`} />
    </article>
  );
}

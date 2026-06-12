'use client';
// src/components/listings/v2/ListingCard.tsx
// The forest-v2 listing card. Data hierarchy: price (serif) → specs (mono) →
// address → hood chip + freshness → book CTA + brokerage (compliance).
// States designed here: active sale (default) / lease (/mo + amber type pill) /
// sold (sold price, asking strikethrough, desaturated photo) / new ≤3d /
// price-reduced / no-photo / no-sqft (spec simply omitted) / redacted address /
// saved heart. Save + book behaviors are props-driven so the island owns wiring.

import Link from 'next/link';
import type { ListingCardData } from './types';
import { fullPrice, titleCase, cleanHood, daysSince, TYPE_LABELS } from './format';
import { BedIcon, BathIcon, SqftIcon, CarIcon, HeartIcon, CameraIcon, PinIcon, TourIcon } from './icons';

export interface ListingCardProps {
  listing: ListingCardData;
  saved: boolean;
  onSave: (mls: string) => void;
  onBook: (listing: ListingCardData) => void;
}

export function ListingCard({ listing: l, saved, onSave, onBook }: ListingCardProps) {
  const isLease = l.transactionType === 'For Lease';
  const isSold = l.status === 'sold' || l.status === 'rented';
  const days = daysSince(l.listedAt);
  const dom = l.daysOnMarket ?? days;
  const isNew = !isSold && days <= 3;
  const addr = l.displayAddress ? titleCase(l.address) : 'Address on request';
  const hood = cleanHood(l.neighbourhood);
  const broker = l.listOfficeName ? titleCase(l.listOfficeName) : 'TREB MLS®';
  const headlinePrice = isSold && l.soldPrice ? l.soldPrice : l.price;

  return (
    <article className={`lv-lcard${isSold ? ' lv-sold-card' : ''}`}>
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
          {isNew && <span className="lv-badge lv-new">{days === 0 ? 'New today' : 'New'}</span>}
          {!isSold && l.priceReduced && <span className="lv-badge lv-reduced">Price reduced</span>}
          {isSold && <span className="lv-badge lv-soldb">{l.status === 'rented' ? 'Leased' : 'Sold'}</span>}
          {!isSold && l.virtualTourUrl && (
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
            {isSold && (
              <div className="lv-soldnote">{l.status === 'rented' ? 'Leased' : 'Sold'} for</div>
            )}
            <div className="lv-lprice">
              {fullPrice(headlinePrice)}
              {isLease && !isSold && <span className="lv-permo">/mo</span>}
              {isSold && l.soldPrice && l.soldPrice !== l.price && (
                <span className="lv-was">asking {fullPrice(l.price)}</span>
              )}
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
          <span className={`lv-dom${dom <= 7 && !isSold ? ' lv-fresh' : ''}`}>
            {isSold && l.soldDate
              ? new Date(l.soldDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
              : dom === 0
                ? 'Listed today'
                : `${dom}d on market`}
          </span>
        </div>

        <div className="lv-lfoot">
          {!isSold ? (
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
          ) : (
            <span className="lv-book" style={{ visibility: 'hidden' }} aria-hidden />
          )}
          <span className="lv-broker">
            {broker} · MLS® {l.mlsNumber}
          </span>
        </div>
      </div>

      {/* whole card clicks through to the detail page */}
      <Link className="lv-stretch" href={`/listings/${l.mlsNumber}`} aria-label={`View ${addr}`} />
    </article>
  );
}

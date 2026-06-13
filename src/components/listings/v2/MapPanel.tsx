'use client';
// src/components/listings/v2/MapPanel.tsx
// Zero-dependency map for a one-town site: every listing is in Milton, so a
// fixed-bounds raster-tile map (auto-fit to the pin bbox, +/- zoom) covers the
// real job — "where is this home" — without shipping a map library. Tiles are
// CARTO's free light basemap (OSM data, attribution rendered below-right).
// UPGRADE PATH: if pan/cluster becomes worth it, swap this component for a
// MapLibre GL island with the same props — the seam (MapPin[]) doesn't change.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { MapPin } from './types';
import { shortPrice, titleCase } from './format';
import { CloseIcon, PinIcon } from './icons';

const TILE = 256;
const MIN_Z = 11;
const MAX_Z = 16;

/** world pixel coords at zoom z (Web Mercator) */
function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * scale;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
  return { x, y };
}

export function MapPanel({ pins }: { pins: MapPin[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scene = useMemo(() => {
    if (!size || pins.length === 0) return null;
    const lats = pins.map((p) => p.latitude);
    const lngs = pins.map((p) => p.longitude);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // largest zoom where the pin bbox fits inside the frame (with pin margin)
    let fit = MIN_Z;
    for (let z = MAX_Z; z >= MIN_Z; z--) {
      const a = project(Math.max(...lats), Math.min(...lngs), z);
      const b = project(Math.min(...lats), Math.max(...lngs), z);
      if (Math.abs(b.x - a.x) <= size.w - 90 && Math.abs(b.y - a.y) <= size.h - 110) {
        fit = z;
        break;
      }
    }
    const z = Math.min(MAX_Z, Math.max(MIN_Z, fit + zoomDelta));

    const c = project(cLat, cLng, z);
    const tlx = c.x - size.w / 2;
    const tly = c.y - size.h / 2;

    const tiles: { key: string; x: number; y: number; left: number; top: number; z: number }[] = [];
    const maxTile = Math.pow(2, z);
    for (let tx = Math.floor(tlx / TILE); tx * TILE < tlx + size.w; tx++) {
      for (let ty = Math.floor(tly / TILE); ty * TILE < tly + size.h; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wx = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({ key: `${z}/${tx}/${ty}`, x: wx, y: ty, left: tx * TILE - tlx, top: ty * TILE - tly, z });
      }
    }

    const dots = pins.map((p) => {
      const w = project(p.latitude, p.longitude, z);
      return { pin: p, left: w.x - tlx, top: w.y - tly };
    });

    return { tiles, dots };
  }, [size, pins, zoomDelta]);

  const sel = selected ? pins.find((p) => p.mlsNumber === selected) : null;

  return (
    <div className="lv-map" ref={frameRef}>
      {scene && (
        <div className="lv-tiles" aria-hidden>
          {scene.tiles.map((t) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={t.key}
              src={`https://basemaps.cartocdn.com/light_all/${t.z}/${t.x}/${t.y}.png`}
              alt=""
              style={{ left: t.left, top: t.top }}
              draggable={false}
            />
          ))}
        </div>
      )}

      {scene?.dots.map(({ pin, left, top }) => (
        <button
          key={pin.mlsNumber}
          type="button"
          className={`lv-mappin${pin.transactionType === 'For Lease' ? ' lv-lease-pin' : ''}${
            selected === pin.mlsNumber ? ' lv-on' : ''
          }`}
          style={{ left, top }}
          onClick={() => setSelected(selected === pin.mlsNumber ? null : pin.mlsNumber)}
          aria-label={`${shortPrice(pin.price)} — ${pin.displayAddress ? titleCase(pin.address) : 'Address on request'}`}
        >
          {shortPrice(pin.price)}
        </button>
      ))}

      <span className="lv-mapcount">
        {pins.length} home{pins.length === 1 ? '' : 's'} on map
      </span>

      <div className="lv-mapzoom">
        <button type="button" aria-label="Zoom in" onClick={() => setZoomDelta((d) => Math.min(d + 1, 4))}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => setZoomDelta((d) => Math.max(d - 1, -2))}>
          −
        </button>
      </div>

      {sel && (
        <div className="lv-mapcard">
          {sel.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={sel.photo} alt="" />
          ) : (
            <span className="lv-mapcard-noimg">
              <PinIcon />
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="lv-mapcard-p">
              {shortPrice(sel.price)}
              {sel.transactionType === 'For Lease' ? '/mo' : ''}
            </div>
            <div className="lv-mapcard-a">
              <Link href={`/listings/${sel.mlsNumber}`}>
                {sel.displayAddress ? titleCase(sel.address) : 'Address on request'}
              </Link>
            </div>
            <div className="lv-mapcard-m">
              {sel.bedrooms} bd · {sel.bathrooms} ba · {titleCase(sel.propertyType)}
            </div>
          </div>
          <button type="button" className="lv-mapcard-x" aria-label="Close" onClick={() => setSelected(null)}>
            <CloseIcon />
          </button>
        </div>
      )}

      <span className="lv-mapattr">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · © CARTO
      </span>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Phnom Penh — the view before anything is picked. */
export const DEFAULT_CENTER = { lat: 11.5564, lng: 104.9282 };

export interface MapCoords {
  lat: number;
  lng: number;
}

/** Red teardrop pin, inlined so no bundler-resolved image URL can break it. */
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">' +
  '<path d="M15 1C7.3 1 1 7.3 1 15c0 10.7 14 26 14 26s14-15.3 14-26C29 7.3 22.7 1 15 1z" ' +
  'fill="#dc2626" stroke="#ffffff" stroke-width="2"/>' +
  '<circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>';

const redPinIcon = L.divIcon({
  html: PIN_SVG,
  className: "", // clears .leaflet-div-icon's white box
  iconSize: [30, 42],
  iconAnchor: [15, 42], // bottom tip sits on the point
  popupAnchor: [0, -42],
});

/**
 * The only module that imports Leaflet, and it is only ever reached through
 * `next/dynamic(…, { ssr: false })` — Leaflet touches `window` at module scope.
 *
 * Two modes:
 *  - **pick** (`readOnly` unset) — a centre pin: the marker is drawn in the
 *    middle of the frame and the map moves under it, so the chosen point is
 *    always the map's centre (drag or click the map to move it). Emits the
 *    centre on every `moveend`.
 *  - **view** (`readOnly`) — an anchored marker at `value`, for the post form's
 *    preview strip and the listing detail page.
 */
export default function LocationMapCanvas({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = 12,
  readOnly = false,
  className,
}: {
  value: MapCoords | null;
  onChange?: (value: MapCoords) => void;
  defaultCenter?: MapCoords;
  defaultZoom?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Kept in a ref so parent re-renders never rebuild the map.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: value ?? defaultCenter,
      zoom: defaultZoom,
      scrollWheelZoom: false, // never hijack page scroll
      zoomControl: !readOnly,
      attributionControl: true, // required by the OSM tile policy
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (readOnly) {
      // Anchored marker: the point is fixed, the map carries it around.
      if (value) {
        markerRef.current = L.marker(value, { icon: redPinIcon }).addTo(map);
      }
    } else {
      // Centre pin: panning/zooming moves the *map*, and whatever sits under
      // the middle is the selection.
      const emitCentre = () => {
        const c = map.getCenter();
        onChangeRef.current?.({ lat: c.lat, lng: c.lng });
      };
      map.on("moveend", emitCentre);
      map.on("click", (e: L.LeafletMouseEvent) => map.panTo(e.latlng));
    }

    // The dialog mounts just before the map, so the box is sized a frame later.
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      markerRef.current = null;
    };
    // Deliberately once: coordinate changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // View mode only: follow coordinates set from outside (a different listing).
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !value) return;
    const current = marker.getLatLng();
    if (current.lat !== value.lat || current.lng !== value.lng) {
      marker.setLatLng(value);
    }
  }, [value]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!readOnly && (
        // Sits above Leaflet's panes (z-index 400/800) but takes no events.
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-1000 -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="30"
            height="42"
            viewBox="0 0 30 42"
          >
            <path
              d="M15 1C7.3 1 1 7.3 1 15c0 10.7 14 26 14 26s14-15.3 14-26C29 7.3 22.7 1 15 1z"
              fill="#dc2626"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <circle cx="15" cy="15" r="5" fill="#ffffff" />
          </svg>
        </div>
      )}
    </div>
  );
}

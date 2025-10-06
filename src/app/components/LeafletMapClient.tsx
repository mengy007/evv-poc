// src/app/components/LeafletMapClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// Shape of the props our wrapper will accept
type LatLngTuple = [number, number];

export default function LeafletMapClient({
  center,
  zoom = 15,
  showMarker = true,
  popupTitle,
  popupSubtitle,
}: {
  center: LatLngTuple;
  zoom?: number;
  showMarker?: boolean;
  popupTitle?: string;
  popupSubtitle?: string;
}) {
  // Dynamically load react-leaflet on the client
  type RL = typeof import("react-leaflet");
  const [RL, setRL] = useState<RL | null>(null);

  useEffect(() => {
    let mounted = true;
    import("react-leaflet").then((mod) => {
      if (mounted) setRL(mod);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!RL) {
    // Skeleton while react-leaflet loads
    return (
      <div className="h-72 w-full animate-pulse bg-slate-100 rounded-xl" />
    );
  }

  const { MapContainer, TileLayer, CircleMarker, Popup } = RL;

  const centerLL = center as unknown as LatLngExpression;

  return (
    <div className="h-72 w-full">
      <MapContainer
        center={centerLL}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {showMarker && (
          <CircleMarker
            center={centerLL}
            radius={10}
            pathOptions={{ color: "#2563eb" }}
          >
            <Popup>
              <div className="text-xs">
                {popupTitle && (
                  <div>
                    <b>{popupTitle}</b>
                  </div>
                )}
                {popupSubtitle && <div>{popupSubtitle}</div>}
                <div>
                  Lat, Lon: {center[0].toFixed(5)}, {center[1].toFixed(5)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

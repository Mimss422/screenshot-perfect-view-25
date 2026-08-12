import { useEffect, useRef } from "react";
import L from "leaflet";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  time: string;
};

export default function StaffMap({ markers }: { markers: MapMarker[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([14.5995, 120.9842], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const points: L.LatLngExpression[] = [];
    markers.forEach((m) => {
      points.push([m.lat, m.lng]);
      L.circleMarker([m.lat, m.lng], {
        radius: 9,
        color: "#0e7490",
        fillColor: "#22d3ee",
        fillOpacity: 0.85,
        weight: 2,
      })
        .bindPopup(`<strong>${m.name}</strong><br/>${m.time}`)
        .addTo(layer);
    });
    if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.4), { maxZoom: 15 });
  }, [markers]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-lg" />;
}
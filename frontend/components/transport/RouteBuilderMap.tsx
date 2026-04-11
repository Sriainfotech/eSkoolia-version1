'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Stop {
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  type: 'start' | 'middle' | 'end';
}

interface RouteBuilderMapProps {
  stops: Stop[];
  onMapClick: (lat: number, lng: number) => void;
}

export default function RouteBuilderMap({ stops, onMapClick }: RouteBuilderMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      mapRef.current = L.map('route-builder-map').setView([27.7172, 85.3240], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Handle map clicks
      mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add route line if there are stops
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (stops.length >= 2) {
      const coords = stops.map((s) => [s.latitude, s.longitude] as [number, number]);
      polylineRef.current = L.polyline(coords, {
        color: '#3B82F6',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 5',
      }).addTo(mapRef.current!);
    }

    // Add markers for each stop
    stops.forEach((stop) => {
      const iconColor = stop.type === 'start' ? '#22c55e' : stop.type === 'end' ? '#ef4444' : '#3b82f6';
      const emoji = stop.type === 'start' ? '🟢' : stop.type === 'end' ? '🔴' : '🔵';

      const icon = L.divIcon({
        html: `<div style="
          background: ${iconColor};
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">${emoji}</div>`,
        iconSize: [40, 40],
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon })
        .bindPopup(`<strong>${stop.name}</strong><br/>Stop #${stop.order}`)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple stops
    if (stops.length >= 2 && mapRef.current) {
      const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stops, onMapClick]);

  return (
    <div id="route-builder-map" style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <button
        onClick={() => alert('Click on the map to add stops. First click is START (🟢), last will be END (🔴), others are MIDDLE (🔵).')}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 400,
          padding: '8px 12px',
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'help',
        }}
      >
        ? How to use
      </button>
    </div>
  );
}

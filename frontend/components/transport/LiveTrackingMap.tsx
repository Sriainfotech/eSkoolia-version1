'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Bus {
  id: number;
  vehicle_no: string;
  current_latitude?: number;
  current_longitude?: number;
  current_speed: number;
  status: string;
}

interface LiveTrackingMapProps {
  buses: Bus[];
  selectedBusId?: number | null;
}

export default function LiveTrackingMap({ buses, selectedBusId }: LiveTrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      mapRef.current = L.map('map').setView([27.7172, 85.3240], 13); // Default: Kathmandu

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Update bus markers
    buses.forEach((bus) => {
      if (!bus.current_latitude || !bus.current_longitude) return;

      const icon = L.divIcon({
        html: `<div style="
          background: ${bus.status === 'in_transit' ? '#3B82F6' : '#10B981'};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transform: ${selectedBusId === bus.id ? 'scale(1.3)' : 'scale(1)'};
        ">🚌</div>`,
        iconSize: [30, 30],
        className: 'bus-marker',
      });

      const latLng: [number, number] = [parseFloat(bus.current_latitude.toString()), parseFloat(bus.current_longitude.toString())];

      let marker = markersRef.current.get(bus.id);
      if (marker) {
        marker.setLatLng(latLng).setIcon(icon);
      } else {
        marker = L.marker(latLng, { icon }).bindPopup(`<strong>${bus.vehicle_no}</strong><br/>Speed: ${bus.current_speed} km/h`).addTo(mapRef.current!);
        markersRef.current.set(bus.id, marker);
      }
    });

    // Fit bounds if bus selected
    if (selectedBusId) {
      const bus = buses.find((b) => b.id === selectedBusId);
      if (bus && bus.current_latitude && bus.current_longitude) {
        mapRef.current?.setView([parseFloat(bus.current_latitude.toString()), parseFloat(bus.current_longitude.toString())], 16);
      }
    }
  }, [buses, selectedBusId]);

  return <div id="map" style={{ width: '100%', height: '100%' }} />;
}

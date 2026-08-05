'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SchoolLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  onChange: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // India

const pinIcon = L.divIcon({
  html: `<div style="
    width: 30px;
    height: 30px;
    border-radius: 50% 50% 50% 0;
    background: #6d4aff;
    border: 2px solid #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.35);
    transform: rotate(-45deg);
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function SchoolLocationMap({ latitude, longitude, radiusMeters, onChange }: SchoolLocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (mapRef.current) return;
    const hasPoint = latitude != null && longitude != null;
    const center: [number, number] = hasPoint ? [latitude as number, longitude as number] : DEFAULT_CENTER;

    const map = L.map('school-location-map').setView(center, hasPoint ? 16 : 5);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      // Marker/circle instances belonged to this now-destroyed map — drop the refs
      // so the next mount (e.g. React StrictMode's dev-mode double-invoke) creates
      // fresh ones on the new map instead of calling setLatLng on detached layers.
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    const point: [number, number] = [latitude, longitude];

    if (!markerRef.current) {
      markerRef.current = L.marker(point, { icon: pinIcon, draggable: true })
        .addTo(map)
        .on('dragend', () => {
          const pos = markerRef.current!.getLatLng();
          onChangeRef.current(pos.lat, pos.lng);
        });
    } else {
      markerRef.current.setLatLng(point);
    }

    if (radiusMeters && radiusMeters > 0) {
      if (!circleRef.current) {
        circleRef.current = L.circle(point, {
          radius: radiusMeters,
          color: '#6d4aff',
          fillColor: '#6d4aff',
          fillOpacity: 0.12,
          weight: 1.5,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng(point).setRadius(radiusMeters);
      }
    } else {
      circleRef.current?.remove();
      circleRef.current = null;
    }

    map.setView(point, Math.max(map.getZoom(), 15));
  }, [latitude, longitude, radiusMeters]);

  return <div id="school-location-map" style={{ width: '100%', height: '100%', minHeight: 320, borderRadius: 12 }} />;
}

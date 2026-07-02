import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation, PanelRightOpen, PanelRightClose, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Mission } from "../../types/mission";
import { VehiclePosition } from "../../types/bridge";
import { MissionPlanner, MissionUploadStatus } from "./MissionPlanner";

// Goa bounding box: SW corner to NE corner
const GOA_BOUNDS: L.LatLngBoundsExpression = [
  [14.87, 73.68],  // SW (south Goa coast)
  [15.80, 74.35],  // NE (north-east Goa border)
];

interface MapViewProps {
  vehiclePosition: VehiclePosition | null;
  trail: [number, number][];
  mission: Mission;
  onMissionChange: (m: Mission) => void;
  onAddWaypoint: (position: [number, number]) => void;
  onClearWaypoints: () => void;
  onSendWaypoints: () => void;
  addWaypointMode: boolean;
  setAddWaypointMode: (mode: boolean) => void;
  uploadStatus: MissionUploadStatus;
  /** Optional mission replay waypoints — draws a purple dashed polyline */
  replayTrail?: [number, number][] | null;
  /** Called when the user dismisses the replay overlay */
  onReplayClear?: () => void;
}

export function MapView({
  vehiclePosition,
  trail,
  mission,
  onMissionChange,
  onAddWaypoint,
  onClearWaypoints,
  onSendWaypoints,
  addWaypointMode,
  setAddWaypointMode,
  uploadStatus,
  replayTrail,
  onReplayClear,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const usvMarkerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const waypointPolylineRef = useRef<L.Polyline | null>(null);
  const replayPolylineRef = useRef<L.Polyline | null>(null);
  const replayMarkersRef = useRef<L.Marker[]>([]);

  // Tile layers
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);

  const [isSatellite, setIsSatellite] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = [15.4909, 73.8278]; // Mandovi River, Goa
    const map = L.map(mapContainerRef.current, {
      maxBounds: L.latLngBounds(GOA_BOUNDS).pad(0.1),
      maxBoundsViscosity: 1.0,
      minZoom: 10,
    }).setView(defaultCenter, 13);
    mapRef.current = map;

    // Street layer (default)
    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    street.addTo(map);
    streetLayerRef.current = street;

    // Esri World Imagery (satellite)
    // maxNativeZoom: Esri tiles only exist up to z18 in many regions;
    // Leaflet will upscale z18 tiles at z19 instead of showing grey "not available" placeholders.
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxNativeZoom: 18,
        maxZoom: 19,
      }
    );
    satelliteLayerRef.current = satellite;

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (addWaypointMode) {
        if (!L.latLngBounds(GOA_BOUNDS).contains(e.latlng)) {
          L.popup()
            .setLatLng(e.latlng)
            .setContent("Waypoint must be within Goa")
            .openOn(map);
          return;
        }
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update click handler when mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.off("click");
    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      if (addWaypointMode) {
        if (!L.latLngBounds(GOA_BOUNDS).contains(e.latlng)) {
          L.popup()
            .setLatLng(e.latlng)
            .setContent("Waypoint must be within Goa")
            .openOn(mapRef.current!);
          return;
        }
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    });
  }, [addWaypointMode, onAddWaypoint]);

  // Invalidate map size when planner panel opens/closes
  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 320);
  }, [plannerOpen]);

  // USV marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (!vehiclePosition) {
      if (usvMarkerRef.current) {
        mapRef.current.removeLayer(usvMarkerRef.current);
        usvMarkerRef.current = null;
      }
      return;
    }

    const boatIcon = L.divIcon({
      html: `
        <div style="transform: rotate(${vehiclePosition.heading}deg);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 18L6 12L12 15L18 12L21 18M12 3V12M12 3L9 6M12 3L15 6" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `,
      className: "boat-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const position: [number, number] = [vehiclePosition.lat, vehiclePosition.lon];
    const isFirstTelemetry = !usvMarkerRef.current;

    if (usvMarkerRef.current) {
      usvMarkerRef.current.setLatLng(position);
      usvMarkerRef.current.setIcon(boatIcon);
    } else {
      const marker = L.marker(position, { icon: boatIcon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div class="text-sm">
            <div class="flex items-center gap-2 mb-1">
              <span style="font-weight: 600;">USV Live Position</span>
            </div>
            <div class="text-xs text-gray-600 font-mono">
              ${vehiclePosition.lat.toFixed(6)}°, ${vehiclePosition.lon.toFixed(6)}°
            </div>
            <div class="text-xs text-gray-600 mt-1">Heading: ${Math.round(vehiclePosition.heading)}°</div>
            <div class="text-xs text-gray-600">Speed: ${vehiclePosition.groundspeed.toFixed(1)} m/s</div>
          </div>
        `);
      usvMarkerRef.current = marker;
    }

    if (isFirstTelemetry) {
      mapRef.current.setView(position, mapRef.current.getZoom());
    } else {
      const bounds = mapRef.current.getBounds();
      if (!bounds.contains(position)) mapRef.current.panTo(position);
    }
  }, [vehiclePosition]);

  // Trail
  useEffect(() => {
    if (!mapRef.current) return;
    if (trailPolylineRef.current) mapRef.current.removeLayer(trailPolylineRef.current);
    if (trail.length > 1) {
      trailPolylineRef.current = L.polyline(trail, {
        color: "#3b82f6", weight: 3, opacity: 0.6,
      }).addTo(mapRef.current);
    }
  }, [trail]);

  // Waypoints
  useEffect(() => {
    if (!mapRef.current) return;

    waypointMarkersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    waypointMarkersRef.current = [];
    if (waypointPolylineRef.current) {
      mapRef.current.removeLayer(waypointPolylineRef.current);
      waypointPolylineRef.current = null;
    }

    mission.waypoints.forEach((waypoint) => {
      const icon = L.divIcon({
        html: `
          <div style="background-color: #ef4444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${waypoint.seq + 1}
          </div>
        `,
        className: "waypoint-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([waypoint.x, waypoint.y], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div class="text-sm" style="min-width:160px">
            <div class="mb-1"><span style="font-weight:600">Waypoint ${waypoint.seq + 1}</span></div>
            <div class="text-xs font-mono text-gray-600">${waypoint.x.toFixed(6)}°, ${waypoint.y.toFixed(6)}°</div>
            <hr style="margin:6px 0;border-color:#e5e7eb"/>
            <div class="text-xs text-gray-600">⏱ Dwell: <strong>${waypoint.dwellTime ?? 0}s</strong></div>
            <div class="text-xs text-gray-600">🧪 Samples: <strong>${waypoint.samplesCount ?? 3}</strong></div>
          </div>
        `);

      waypointMarkersRef.current.push(marker);
    });

    if (mission.waypoints.length > 1) {
      waypointPolylineRef.current = L.polyline(
        mission.waypoints.map(wp => [wp.x, wp.y] as [number, number]),
        { color: "#ef4444", weight: 2, opacity: 0.7, dashArray: "5, 10" }
      ).addTo(mapRef.current);
    }
  }, [mission.waypoints]);

  // Mission replay polyline (purple dashed) ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old replay
    if (replayPolylineRef.current) {
      mapRef.current.removeLayer(replayPolylineRef.current);
      replayPolylineRef.current = null;
    }
    replayMarkersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    replayMarkersRef.current = [];

    if (!replayTrail || replayTrail.length === 0) return;

    // Draw purple dashed polyline
    replayPolylineRef.current = L.polyline(replayTrail, {
      color: "#a855f7",
      weight: 3,
      opacity: 0.8,
      dashArray: "8, 8",
    }).addTo(mapRef.current);

    // Draw numbered markers for each replay waypoint
    replayTrail.forEach(([lat, lon], i) => {
      const icon = L.divIcon({
        html: `<div style="background:#a855f7;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
        className: "replay-wp-icon",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([lat, lon], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`<div class="text-sm"><strong>Replay WP ${i + 1}</strong><br/><span class="font-mono text-xs">${lat.toFixed(6)}°, ${lon.toFixed(6)}°</span></div>`);
      replayMarkersRef.current.push(marker);
    });

    // Pan map to show the replay trail
    const bounds = L.latLngBounds(replayTrail);
    mapRef.current.fitBounds(bounds, { padding: [60, 60] });
  }, [replayTrail]);

  return (
    <div className="h-full flex flex-col">
      {/* ── Top bar (telemetry summary + panel toggle) ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between gap-2 text-sm">
        <div className="text-gray-600 dark:text-gray-400">
          {vehiclePosition ? (
            <>
              <span className="font-mono">
                {vehiclePosition.lat.toFixed(6)}°, {vehiclePosition.lon.toFixed(6)}°
              </span>
              <span className="ml-2 text-xs">
                {vehiclePosition.groundspeed.toFixed(1)} m/s
              </span>
            </>
          ) : (
            <span className="text-xs italic">No telemetry</span>
          )}
        </div>

        <button
          id="toggle-mission-planner-btn"
          onClick={() => setPlannerOpen(o => !o)}
          title={plannerOpen ? "Hide mission planner" : "Show mission planner"}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {plannerOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          Mission Planner
          {mission.waypoints.length > 0 && (
            <span className="ml-1 size-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {mission.waypoints.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main split: map + optional planner panel ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Heading indicator overlay */}
          {vehiclePosition && (
            <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 z-[1000]">
              <div className="flex items-center gap-3">
                <div className="size-16 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <Navigation
                    className="size-6 text-blue-600 dark:text-blue-400"
                    style={{ transform: `rotate(${vehiclePosition.heading}deg)` }}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Heading</div>
                  <div className="text-2xl text-gray-900 dark:text-gray-100">{Math.round(vehiclePosition.heading)}°</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {vehiclePosition.heading >= 337.5 || vehiclePosition.heading < 22.5 ? 'N' :
                      vehiclePosition.heading < 67.5 ? 'NE' :
                        vehiclePosition.heading < 112.5 ? 'E' :
                          vehiclePosition.heading < 157.5 ? 'SE' :
                            vehiclePosition.heading < 202.5 ? 'S' :
                              vehiclePosition.heading < 247.5 ? 'SW' :
                                vehiclePosition.heading < 292.5 ? 'W' : 'NW'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Path history badge */}
          <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700 z-[1000]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Path History</div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-900 dark:text-gray-100">{trail.length} pts</span>
            </div>
          </div>

          {/* Replay active banner */}
          {replayTrail && replayTrail.length > 0 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
              <div className="size-2.5 rounded-full bg-purple-200 animate-pulse" />
              Mission Replay — {replayTrail.length} waypoints
              {onReplayClear && (
                <button
                  onClick={onReplayClear}
                  title="Dismiss replay"
                  className="ml-2 hover:text-purple-200 transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          {/* ── Satellite / Map toggle (Google Maps-style) ── */}
          <div className="absolute bottom-6 left-4 z-[1000] flex rounded-lg overflow-hidden shadow-lg border border-white/30" style={{ fontSize: '13px' }}>
            <button
              id="map-layer-street-btn"
              onClick={() => {
                if (isSatellite && mapRef.current) {
                  mapRef.current.removeLayer(satelliteLayerRef.current!);
                  mapRef.current.addLayer(streetLayerRef.current!);
                  setIsSatellite(false);
                }
              }}
              className="px-3 py-1.5 font-semibold transition-colors"
              style={{
                background: isSatellite ? 'rgba(30,30,30,0.75)' : '#fff',
                color: isSatellite ? '#d1d5db' : '#1d4ed8',
                borderRight: '1px solid rgba(255,255,255,0.25)',
              }}
              title="Street map view"
            >
              Map
            </button>
            <button
              id="map-layer-satellite-btn"
              onClick={() => {
                if (!isSatellite && mapRef.current) {
                  mapRef.current.removeLayer(streetLayerRef.current!);
                  mapRef.current.addLayer(satelliteLayerRef.current!);
                  setIsSatellite(true);
                }
              }}
              className="px-3 py-1.5 font-semibold transition-colors"
              style={{
                background: isSatellite ? '#fff' : 'rgba(30,30,30,0.75)',
                color: isSatellite ? '#1d4ed8' : '#d1d5db',
              }}
              title="Esri satellite imagery"
            >
              Satellite
            </button>
          </div>
        </div>

        {/* Mission planner panel */}
        {plannerOpen && (
          <div className="w-72 shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <MissionPlanner
              mission={mission}
              onMissionChange={onMissionChange}
              addWaypointMode={addWaypointMode}
              setAddWaypointMode={setAddWaypointMode}
              onClearWaypoints={onClearWaypoints}
              onSendWaypoints={onSendWaypoints}
              uploadStatus={uploadStatus}
            />
          </div>
        )}
      </div>
    </div>
  );
}
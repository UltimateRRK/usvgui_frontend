import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin, Trash2, Send, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Mission } from "../../types/mission";
import { VehiclePosition } from "../../types/bridge";

interface MapViewProps {
  vehiclePosition: VehiclePosition | null;
  trail: [number, number][];
  mission: Mission;
  onAddWaypoint: (position: [number, number]) => void;
  onClearWaypoints: () => void;
  onSendWaypoints: () => void;
  addWaypointMode: boolean;
  setAddWaypointMode: (mode: boolean) => void;
}

export function MapView({
  vehiclePosition,
  trail,
  mission,
  onAddWaypoint,
  onClearWaypoints,
  onSendWaypoints,
  addWaypointMode,
  setAddWaypointMode,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const usvMarkerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const waypointPolylineRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center (will be updated when telemetry arrives)
    const defaultCenter: [number, number] = [15.4909, 73.8278]; // Mandovi River, Goa
    const map = L.map(mapContainerRef.current).setView(defaultCenter, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Handle map clicks for waypoint addition
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (addWaypointMode) {
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map click handler when addWaypointMode changes
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.off("click");
    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      if (addWaypointMode) {
        onAddWaypoint([e.latlng.lat, e.latlng.lng]);
      }
    });
  }, [addWaypointMode, onAddWaypoint]);

  // Update USV marker from vehicle telemetry
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing marker if no telemetry
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

    // Check if this is the first telemetry (marker doesn't exist yet)
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
            <div class="text-xs text-gray-600 mt-1">
              Heading: ${Math.round(vehiclePosition.heading)}°
            </div>
            <div class="text-xs text-gray-600">
              Speed: ${vehiclePosition.groundspeed.toFixed(1)} m/s
            </div>
          </div>
        `);
      usvMarkerRef.current = marker;
    }

    // Smart centering: only recenter if needed
    // - First telemetry: center immediately
    // - Subsequent updates: only if vehicle is outside viewport
    if (isFirstTelemetry) {
      // First telemetry: center map on vehicle
      mapRef.current.setView(position, mapRef.current.getZoom());
    } else {
      // Check if vehicle is outside viewport bounds
      const bounds = mapRef.current.getBounds();
      if (!bounds.contains(position)) {
        // Vehicle outside viewport: smoothly pan to position
        mapRef.current.panTo(position);
      }
      // Otherwise: vehicle still in viewport, no recentering needed
    }
  }, [vehiclePosition]);

  // Update trail
  useEffect(() => {
    if (!mapRef.current) return;

    if (trailPolylineRef.current) {
      mapRef.current.removeLayer(trailPolylineRef.current);
    }

    if (trail.length > 1) {
      const polyline = L.polyline(trail, {
        color: "#3b82f6",
        weight: 3,
        opacity: 0.6,
      }).addTo(mapRef.current);
      trailPolylineRef.current = polyline;
    }
  }, [trail]);

  // Update waypoints
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old waypoint markers
    waypointMarkersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    waypointMarkersRef.current = [];

    // Remove old waypoint polyline
    if (waypointPolylineRef.current) {
      mapRef.current.removeLayer(waypointPolylineRef.current);
      waypointPolylineRef.current = null;
    }

    // Add new waypoint markers
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
          <div class="text-sm">
            <div class="mb-1">
              <span style="font-weight: 600;">Waypoint ${waypoint.seq + 1}</span>
            </div>
            <div class="text-xs text-gray-600 font-mono">
              ${waypoint.x.toFixed(6)}°, ${waypoint.y.toFixed(6)}°
            </div>
          </div>
        `);

      waypointMarkersRef.current.push(marker);
    });

    // Add waypoint path
    if (mission.waypoints.length > 1) {
      const polyline = L.polyline(
        mission.waypoints.map(wp => [wp.x, wp.y] as [number, number]),
        {
          color: "#ef4444",
          weight: 2,
          opacity: 0.7,
          dashArray: "5, 10",
        }
      ).addTo(mapRef.current);
      waypointPolylineRef.current = polyline;
    }
  }, [mission.waypoints]);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setAddWaypointMode(!addWaypointMode)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${addWaypointMode
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
          >
            <MapPin className="size-4" />
            {addWaypointMode ? "Click Map to Add" : "Add Waypoint"}
          </button>
          <button
            onClick={onClearWaypoints}
            disabled={mission.waypoints.length === 0}
            className="px-4 py-2 rounded-lg flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="size-4" />
            Clear
          </button>
          <button
            onClick={onSendWaypoints}
            disabled={mission.waypoints.length === 0}
            className="px-4 py-2 rounded-lg flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="size-4" />
            Send to USV ({mission.waypoints.length})
          </button>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
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
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Heading Indicator Overlay */}
        {vehiclePosition && (
          <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="size-16 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <Navigation
                    className="size-6 text-blue-600 dark:text-blue-400"
                    style={{ transform: `rotate(${vehiclePosition.heading}deg)` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Heading</div>
                <div className="text-2xl text-gray-900 dark:text-gray-100">{Math.round(vehiclePosition.heading)}°</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {vehiclePosition.heading >= 337.5 || vehiclePosition.heading < 22.5 ? 'N' :
                    vehiclePosition.heading >= 22.5 && vehiclePosition.heading < 67.5 ? 'NE' :
                      vehiclePosition.heading >= 67.5 && vehiclePosition.heading < 112.5 ? 'E' :
                        vehiclePosition.heading >= 112.5 && vehiclePosition.heading < 157.5 ? 'SE' :
                          vehiclePosition.heading >= 157.5 && vehiclePosition.heading < 202.5 ? 'S' :
                            vehiclePosition.heading >= 202.5 && vehiclePosition.heading < 247.5 ? 'SW' :
                              vehiclePosition.heading >= 247.5 && vehiclePosition.heading < 292.5 ? 'W' : 'NW'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Path History Info */}
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Path History</div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-900 dark:text-gray-100">{trail.length} points</span>
          </div>
        </div>
      </div>
    </div>
  );
}
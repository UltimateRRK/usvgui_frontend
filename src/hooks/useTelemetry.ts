/**
 * useTelemetry
 *
 * Firebase /telemetry/{DEVICE_ID}/current listener hook.
 * Returns vehicle position, GPS trail, and derived connection quality.
 */

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { database, authReady } from "../services/firebase";
import { VehiclePosition } from "../types/bridge";

const DEVICE_ID = "usv-01";
const MAX_TRAIL_POINTS = 300;

export interface UseTelemetryResult {
    vehiclePosition: VehiclePosition | null;
    trail: [number, number][];
}

export function useTelemetry(): UseTelemetryResult {
    const [vehiclePosition, setVehiclePosition] = useState<VehiclePosition | null>(null);
    const [trail, setTrail] = useState<[number, number][]>([]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        authReady.then(() => {
            const posRef = ref(database, `telemetry/${DEVICE_ID}/current`);
            unsubscribe = onValue(posRef, (snapshot) => {
                const pos = snapshot.val();
                if (!pos) return;

                const vehiclePos: VehiclePosition = {
                    // ── Core movement ──
                    lat: pos.lat,
                    lon: pos.lon,
                    alt: pos.alt ?? 0,
                    heading: pos.heading ?? 0,
                    groundspeed: pos.groundspeed ?? 0,
                    timestamp: pos.timestamp ?? new Date().toISOString(),
                    // ── Battery ──
                    batteryVoltage: pos.batteryVoltage ?? undefined,
                    batteryPercent: pos.batteryPercent ?? undefined,
                    // ── GPS quality ──
                    satellites: pos.satellites ?? undefined,
                    hdop: pos.hdop ?? undefined,
                    fixType: pos.fixType ?? undefined,
                    // ── Vehicle state ──
                    mode: pos.mode ?? undefined,
                    armed: pos.armed ?? undefined,
                    currentWp: pos.currentWp ?? undefined,
                    lastHeartbeatAt: pos.lastHeartbeatAt ?? undefined,
                };

                setVehiclePosition(vehiclePos);
                setTrail((prevTrail) => {
                    const lastPoint = prevTrail[prevTrail.length - 1];
                    // Only add to the trail if the boat actually moved (GPS jitter filter: ~1.1 meters)
                    if (lastPoint) {
                        const dLat = Math.abs(lastPoint[0] - vehiclePos.lat);
                        const dLon = Math.abs(lastPoint[1] - vehiclePos.lon);
                        if (dLat < 0.00001 && dLon < 0.00001) {
                            return prevTrail;
                        }
                    }
                    const next: [number, number][] = [
                        ...prevTrail,
                        [vehiclePos.lat, vehiclePos.lon],
                    ];
                    return next.slice(-MAX_TRAIL_POINTS);
                });
            });
        });

        return () => unsubscribe?.();
    }, []);

    return { vehiclePosition, trail };
}

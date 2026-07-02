/**
 * useSensorData
 *
 * Firebase /readings listener hook.
 * Returns live sensor readings, chart history, and connection state.
 */

import { useState, useEffect } from "react";
import { ref, onValue, query, limitToLast } from "firebase/database";
import { database, authReady } from "../services/firebase";

export interface SensorData {
    ph: number;
    temperature: number;
    tds: number;
    turbidity: number;
}

export interface ChartDataPoint {
    timestamp: string;
    ph: number;
    temperature: number;
    turbidity: number;
    tds: number;
    lat?: number;
    lon?: number;
    waypoint_seq?: number;
    wqi?: number;
    wqi_label?: string;
}

export interface UseSensorDataResult {
    sensorData: SensorData;
    chartData: ChartDataPoint[];
    isOnline: boolean;
    hasGpsFix: boolean;
    lastUpdate: Date;
}

export function useSensorData(): UseSensorDataResult {
    const [sensorData, setSensorData] = useState<SensorData>({
        ph: 0, temperature: 0, tds: 0, turbidity: 0,
    });
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isOnline, setIsOnline] = useState(false);
    const [hasGpsFix, setHasGpsFix] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    useEffect(() => {
        let unsubConn: (() => void) | undefined;
        let unsubReadings: (() => void) | undefined;

        authReady.then(() => {
            // Monitor Firebase connection state
            unsubConn = onValue(ref(database, ".info/connected"), (snap) => {
                if (!snap.val()) setIsOnline(false);
            });

            const readingsQuery = query(ref(database, "readings"), limitToLast(20));
            unsubReadings = onValue(
                readingsQuery,
                (snapshot) => {
                    const data = snapshot.val();
                    if (!data) return;

                    const entries = Object.values(data) as any[];
                    const latest = entries[entries.length - 1];

                    setIsOnline(true);
                    setLastUpdate(new Date(latest.timestamp || Date.now()));

                    const newSensorData: SensorData = {
                        ph: latest.ph ?? 0,
                        temperature: latest.temperature ?? 0,
                        tds: latest.tds ?? 0,
                        turbidity: latest.turbidity ?? 0,
                    };
                    setSensorData(newSensorData);

                    if (latest.lat && latest.lon && (latest.lat !== 0 || latest.lon !== 0)) {
                        setHasGpsFix(true);
                    }

                    setChartData(
                        entries.map((e: any) => ({
                            timestamp: new Date(e.timestamp || Date.now()).toLocaleTimeString(
                                "en-US",
                                { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                            ),
                            ph: e.ph ?? 0,
                            temperature: e.temperature ?? 0,
                            turbidity: e.turbidity ?? 0,
                            tds: e.tds ?? 0,
                            lat: e.lat,
                            lon: e.lon,
                            waypoint_seq: e.waypoint_seq,
                            wqi: e.wqi,
                            wqi_label: e.wqi_label,
                        }))
                    );
                },
                (error) => {
                    console.error("Firebase /readings error:", error.message);
                }
            );
        });

        return () => {
            unsubConn?.();
            unsubReadings?.();
        };
    }, []);

    return { sensorData, chartData, isOnline, hasGpsFix, lastUpdate };
}

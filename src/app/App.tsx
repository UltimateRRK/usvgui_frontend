import { useState, useEffect, useMemo } from "react";
import { Droplets, Thermometer, Gauge, Waves } from "lucide-react";
import { Header } from "./components/Header";
import { SensorCard } from "./components/SensorCard";
import { MapView } from "./components/MapView";
import { SystemSettings } from "./components/SystemSettings";
import { CombinedScientificData } from "./components/CombinedScientificData";
import { AlertsThresholds } from "./components/AlertsThresholds";
import { DataExport } from "./components/DataExport";
import { MissionLog } from "./components/MissionLog";
import { USVHealthStrip } from "./components/USVHealthStrip";
import { NavPanel } from "./components/NavPanel";
import { SystemConsole } from "./components/SystemConsole";
import { ThemeProvider } from "./components/ThemeProvider";
import { database, authReady } from "../services/firebase";
import { ref, set, get } from "firebase/database";
import { makeLog, ConsoleEntry } from "../types/console";

// Hooks
import { useSensorData } from "../hooks/useSensorData";
import { useTelemetry } from "../hooks/useTelemetry";
import { useMission } from "../hooks/useMission";

// Types
import { MissionPhase } from "../types/missionStatus";

const DEVICE_ID = "usv-01";

// ── Water quality scoring ──────────────────────────────────────────────────────

function calculateWaterQuality(data: {
    ph: number; temperature: number; tds: number; turbidity: number;
}): "good" | "moderate" | "poor" {
    let score = 0;
    if (data.ph >= 6.5 && data.ph <= 8.5) score++;
    else if (data.ph >= 6.0 && data.ph <= 9.0) score += 0.5;
    if (data.temperature >= 20 && data.temperature <= 28) score++;
    else if (data.temperature >= 15 && data.temperature <= 32) score += 0.5;
    if (data.tds < 500) score++;
    else if (data.tds < 600) score += 0.5;
    if (data.turbidity < 5) score++;
    else if (data.turbidity < 10) score += 0.5;
    if (score >= 3.5) return "good";
    if (score >= 2) return "moderate";
    return "poor";
}

// ── Connection quality (online / degraded / offline) ──────────────────────────

function deriveConnectionStatus(
    isOnline: boolean,
    lastUpdate: Date
): "online" | "degraded" | "offline" {
    if (!isOnline) return "offline";
    const ageSecs = (Date.now() - lastUpdate.getTime()) / 1000;
    if (ageSecs < 10) return "online";
    if (ageSecs < 60) return "degraded";
    return "offline";
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
    // ── System Console log ──
    const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>(() => [
        makeLog("system", "USV Ground Control Station initialised."),
    ]);
    const addLog = (entry: ConsoleEntry) =>
        setConsoleLogs((prev) => [...prev.slice(-199), entry]); // keep last 200

    // ── Data hooks ──
    const { sensorData, chartData, isOnline, hasGpsFix, lastUpdate } = useSensorData();
    const { vehiclePosition, trail } = useTelemetry();
    const {
        mission, setMission,
        addWaypointMode, setAddWaypointMode,
        uploadStatus, missionLog,
        handleAddWaypoint, handleClearWaypoints, handleSendWaypoints,
    } = useMission(addLog);

    // ── Sensor interval (sampling mode) ──
    const [sensorInterval, setSensorInterval] = useState(5);

    // ── Mission replay ──
    const [replayTrail, setReplayTrail] = useState<[number, number][] | null>(null);

    // ── Derived state ──

    const waterQuality = useMemo(() => calculateWaterQuality(sensorData), [sensorData]);
    const connectionStatus = useMemo(
        () => deriveConnectionStatus(isOnline, lastUpdate),
        [isOnline, lastUpdate]
    );
    const samplingMode = useMemo(() => {
        if (sensorInterval <= 60)  return "Survey Mode";
        if (sensorInterval <= 900) return "Routine Monitoring";
        return "Low-Power / Standby";
    }, [sensorInterval]);

    // Derive mission phase from upload status
    const missionPhase = useMemo((): MissionPhase => {
        if (uploadStatus === "idle")      return "idle";
        if (uploadStatus === "pending")   return "queued";
        if (uploadStatus === "accepted")  return "auto";
        if (uploadStatus === "executing") return "auto";
        if (uploadStatus === "completed") return "completed";
        if (uploadStatus === "rejected")  return "idle";
        return "idle";
    }, [uploadStatus]);

    // ── Sensor status from localStorage thresholds ──
    const getSensorStatus = (
        param: "ph" | "temperature" | "tds" | "turbidity"
    ): "normal" | "warning" | "alert" => {
        const defaults = {
            ph:          { min: 6.5, max: 8.5 },
            temperature: { min: 15,  max: 30  },
            turbidity:   { min: 0,   max: 5   },
            tds:         { min: 0,   max: 500 },
        };
        let thresholds = defaults;
        try {
            const saved = localStorage.getItem("waterQualityThresholds");
            if (saved) thresholds = { ...defaults, ...JSON.parse(saved) };
        } catch { /* use defaults */ }

        const value = sensorData[param];
        const t = thresholds[param];

        const critical: Record<string, (v: number) => boolean> = {
            ph:          (v) => v < 6.0 || v > 9.0,
            temperature: (v) => v < 10   || v > 35,
            turbidity:   (v) => v > 10,
            tds:         (v) => v > 1000,
        };

        if (critical[param](value)) return "alert";
        if (param === "turbidity" || param === "tds") {
            if (value > t.max) return "warning";
        } else {
            if (value < t.min || value > t.max) return "warning";
        }
        return "normal";
    };

    // ── Sampling interval — read from Firebase on mount, write on change ──
    useEffect(() => {
        authReady.then(() => {
            get(ref(database, `config/${DEVICE_ID}/sensorInterval`)).then((snap) => {
                const val = snap.val();
                if (val && typeof val === "number" && val >= 1) setSensorInterval(val);
            }).catch(() => {/* use default */});
        });
    }, []);

    const handleIntervalChange = (seconds: number) => {
        setSensorInterval(seconds);
        authReady.then(() => {
            set(ref(database, `config/${DEVICE_ID}/sensorInterval`), seconds)
                .then(() => addLog(makeLog("system", `Sampling interval updated to ${seconds}s.`)))
                .catch(() => addLog(makeLog("error", "Failed to sync sampling interval to Pi.")));
        });
    };

    // ── Console: mission status events (handled inside useMission via onLog) ──
    // ── Console: connection status ──
    useEffect(() => {
        if (isOnline)
            addLog(makeLog("success", "Firebase RTDB connected — live data streaming."));
        else
            addLog(makeLog("warn", "Firebase connection lost. Reconnecting..."));
    }, [isOnline]);

    // ── Console: GPS fix ──
    useEffect(() => {
        if (hasGpsFix)
            addLog(makeLog("success", "GPS fix acquired."));
        else
            addLog(makeLog("warn", "GPS fix lost."));
    }, [hasGpsFix]);

    // ── Dev debug ──
    useEffect(() => {
        if (import.meta.env.DEV) {
            (window as any).currentMission = mission;
            (window as any).vehiclePosition = vehiclePosition;
        }
    }, [mission, vehiclePosition]);

    // ── Replay handlers ──
    const handleMissionSelect = (wps: [number, number][]) => {
        setReplayTrail(wps);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleReplayClear = () => {
        setReplayTrail(null);
    };

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

                <Header
                    isOnline={isOnline}
                    hasGpsFix={hasGpsFix}
                    lastUpdate={lastUpdate}
                />

                <USVHealthStrip
                    connectionStatus={connectionStatus}
                    lastTelemetryTimestamp={lastUpdate}
                    samplingMode={samplingMode}
                    vehiclePosition={vehiclePosition}
                    missionPhase={missionPhase}
                />

                <main className="flex-1 p-6">
                    {/* Main Split View */}
                    <div
                        className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6"
                        style={{ height: "calc(100vh - 280px)", minHeight: "600px" }}
                    >
                        {/* Left Panel — Map */}
                        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                            <MapView
                                vehiclePosition={vehiclePosition}
                                trail={trail}
                                mission={mission}
                                onMissionChange={setMission}
                                onAddWaypoint={handleAddWaypoint}
                                onClearWaypoints={handleClearWaypoints}
                                onSendWaypoints={handleSendWaypoints}
                                addWaypointMode={addWaypointMode}
                                setAddWaypointMode={setAddWaypointMode}
                                uploadStatus={uploadStatus}
                                replayTrail={replayTrail}
                                onReplayClear={handleReplayClear}
                            />
                        </div>

                        {/* Right Panel — Sensor Telemetry */}
                        <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2">
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-xl font-bold mb-3 text-gray-700 dark:text-gray-200 text-center">
                                    Sensor Data
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                                    <SensorCard
                                        title="pH Level"
                                        value={sensorData.ph}
                                        unit="pH"
                                        icon={<Droplets className="size-5 text-white" />}
                                        status={getSensorStatus("ph")}
                                        timestamp={lastUpdate.toLocaleTimeString("en-US")}
                                    />
                                    <SensorCard
                                        title="Temperature"
                                        value={sensorData.temperature}
                                        unit="°C"
                                        icon={<Thermometer className="size-5 text-white" />}
                                        status={getSensorStatus("temperature")}
                                        timestamp={lastUpdate.toLocaleTimeString("en-US")}
                                    />
                                    <SensorCard
                                        title="TDS"
                                        value={sensorData.tds}
                                        unit="ppm"
                                        icon={<Gauge className="size-5 text-white" />}
                                        status={getSensorStatus("tds")}
                                        timestamp={lastUpdate.toLocaleTimeString("en-US")}
                                    />
                                    <SensorCard
                                        title="Turbidity"
                                        value={sensorData.turbidity}
                                        unit="NTU"
                                        icon={<Waves className="size-5 text-white" />}
                                        status={getSensorStatus("turbidity")}
                                        timestamp={lastUpdate.toLocaleTimeString("en-US")}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nav Panel + System Console */}
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: "280px" }}>
                        <NavPanel
                            vehiclePosition={vehiclePosition}
                            targetBearing={null}
                            distanceToWp={null}
                        />
                        <SystemConsole entries={consoleLogs} />
                    </div>

                    {/* Combined Scientific Data */}
                    <div className="mt-6">
                        <CombinedScientificData data={chartData} currentData={sensorData} />
                    </div>

                    {/* Alerts & Thresholds */}
                    <div className="mt-6">
                        <AlertsThresholds sensorData={sensorData} />
                    </div>

                    {/* Data Export */}
                    <div className="mt-6">
                        <DataExport
                            data={chartData}
                            onMissionSelect={handleMissionSelect}
                        />
                    </div>

                    {/* System Settings */}
                    <div className="mt-6">
                        <SystemSettings
                            sensorInterval={sensorInterval}
                            onIntervalChange={handleIntervalChange}
                            vehiclePosition={vehiclePosition}
                        />
                    </div>

                    {/* Mission Log */}
                    <div className="mt-6">
                        <MissionLog
                            missions={missionLog}
                            chartData={chartData}
                            onMissionSelect={handleMissionSelect}
                        />
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-gray-800 dark:bg-gray-950 text-gray-300 py-4 px-6">
                    <div className="flex items-center justify-center text-sm">
                        <div>Made with rrk</div>
                    </div>
                </footer>
            </div>
        </ThemeProvider>
    );
}

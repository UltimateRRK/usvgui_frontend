import { useEffect, useState } from "react";
import {
    Wifi, WifiOff, Battery, Radio, Clock, Satellite,
    Navigation2, Shield, ShieldOff, Activity, AlertTriangle,
    Gauge, MapPin, Zap,
} from "lucide-react";
import { VehiclePosition } from "../../types/bridge";
import { MissionPhase, MISSION_PHASE_CONFIG } from "../../types/missionStatus";

interface USVHealthStripProps {
    connectionStatus: "online" | "degraded" | "offline";
    lastTelemetryTimestamp: Date;
    batteryLevel?: number; // kept for compatibility; overridden by vehiclePosition.batteryPercent
    samplingMode: string;
    vehiclePosition?: VehiclePosition | null;
    missionPhase?: MissionPhase;
}

// How many seconds of silence before we consider Pi "stale"
const STALE_THRESHOLD_S = 30;

// ── Small reusable health field ──────────────────────────────────────────────

interface HealthFieldProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    valueClass?: string;
}

function HealthField({ icon, label, value, valueClass = "text-gray-900 dark:text-gray-100" }: HealthFieldProps) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0 text-gray-400">{icon}</div>
            <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</div>
                <div className={`text-sm font-semibold whitespace-nowrap ${valueClass}`}>{value}</div>
            </div>
        </div>
    );
}

// ── GPS fix label ─────────────────────────────────────────────────────────────

function gpsFixLabel(fixType?: number): { text: string; cls: string } {
    if (fixType === undefined || fixType === null)
        return { text: "–", cls: "text-gray-400" };
    if (fixType <= 1) return { text: "No Fix", cls: "text-red-500 dark:text-red-400" };
    if (fixType === 2) return { text: "2D",    cls: "text-yellow-500 dark:text-yellow-400" };
    if (fixType === 3) return { text: "3D",    cls: "text-green-500 dark:text-green-400" };
    if (fixType === 4) return { text: "DGPS",  cls: "text-green-400 dark:text-green-300" };
    return { text: "RTK", cls: "text-cyan-500 dark:text-cyan-400" };
}

function hdopClass(hdop?: number): string {
    if (hdop === undefined) return "text-gray-400";
    if (hdop < 1.5) return "text-green-500 dark:text-green-400";
    if (hdop < 3.0) return "text-yellow-500 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
}

function batteryClass(pct?: number): string {
    if (pct === undefined) return "text-gray-400";
    if (pct > 60) return "text-green-500 dark:text-green-400";
    if (pct > 30) return "text-yellow-500 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
}

// ── Mission phase badge ──────────────────────────────────────────────────────

function MissionPhaseBadge({ phase }: { phase: MissionPhase }) {
    const cfg = MISSION_PHASE_CONFIG[phase];
    if (phase === "idle") return null;

    const colorMap: Record<string, string> = {
        gray:   "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
        cyan:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
        green:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse",
    };

    return (
        <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border border-transparent ${colorMap[cfg.color] ?? colorMap.gray}`}
            title={cfg.description}
        >
            {cfg.label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function USVHealthStrip({
    connectionStatus,
    lastTelemetryTimestamp,
    batteryLevel,
    samplingMode,
    vehiclePosition,
    missionPhase = "idle",
}: USVHealthStripProps) {
    const [now, setNow] = useState(new Date());

    // Re-render every second so "last update" and stale banner stay current
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const ageSecs = Math.floor((now.getTime() - lastTelemetryTimestamp.getTime()) / 1000);
    const isStale = ageSecs > STALE_THRESHOLD_S;

    const formatAge = (secs: number) => {
        if (secs < 60) return `${secs}s ago`;
        if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
        return lastTelemetryTimestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    };

    const connColor =
        connectionStatus === "online"
            ? "text-green-500 dark:text-green-400"
            : connectionStatus === "degraded"
            ? "text-yellow-500 dark:text-yellow-400"
            : "text-red-500 dark:text-red-400";

    // Resolve battery: prefer real telemetry, fall back to prop
    const bPct = vehiclePosition?.batteryPercent ?? batteryLevel;
    const bV   = vehiclePosition?.batteryVoltage;

    // GPS
    const sats    = vehiclePosition?.satellites;
    const hdop    = vehiclePosition?.hdop;
    const fixType = vehiclePosition?.fixType;
    const fix     = gpsFixLabel(fixType);

    // Mode / armed
    const mode   = vehiclePosition?.mode;
    const armed  = vehiclePosition?.armed;
    const currWp = vehiclePosition?.currentWp;

    // Pi heartbeat age (separate from sensor data age)
    const heartbeatAt = vehiclePosition?.lastHeartbeatAt;
    const heartbeatAgeSecs = heartbeatAt
        ? Math.floor((now.getTime() - new Date(heartbeatAt).getTime()) / 1000)
        : null;

    return (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* ── Pi Silent / Stale banner ─────────────────────────────────── */}
            {isStale && (
                <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-1.5 text-amber-700 dark:text-amber-300 text-xs font-medium">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Pi Silent — last data {formatAge(ageSecs)}. Check vehicle connectivity.
                </div>
            )}

            {/* ── Health fields row ────────────────────────────────────────── */}
            <div className="px-6 py-2.5 overflow-x-auto">
                <div className="flex items-center gap-6 min-w-max mx-auto justify-center flex-wrap">

                    {/* Firebase link */}
                    <HealthField
                        icon={connectionStatus === "offline"
                            ? <WifiOff className="size-4" />
                            : <Wifi className="size-4" />
                        }
                        label="Link"
                        value={<span className="capitalize">{connectionStatus}</span>}
                        valueClass={connColor}
                    />

                    {/* Divider */}
                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 shrink-0" />

                    {/* Last Pi update */}
                    <HealthField
                        icon={<Clock className="size-4" />}
                        label="Last Data"
                        value={formatAge(ageSecs)}
                        valueClass={isStale ? "text-amber-500" : "text-gray-900 dark:text-gray-100"}
                    />

                    {/* Pi Heartbeat (Pixhawk link quality) */}
                    {heartbeatAt !== undefined && (
                        <HealthField
                            icon={<Activity className="size-4" />}
                            label="Px Heartbeat"
                            value={
                                heartbeatAgeSecs !== null
                                    ? heartbeatAgeSecs < 5
                                        ? "OK"
                                        : `${heartbeatAgeSecs}s ago`
                                    : "–"
                            }
                            valueClass={
                                heartbeatAgeSecs === null ? "text-gray-400"
                                : heartbeatAgeSecs < 5   ? "text-green-500 dark:text-green-400"
                                : heartbeatAgeSecs < 15  ? "text-yellow-500 dark:text-yellow-400"
                                : "text-red-500 dark:text-red-400"
                            }
                        />
                    )}

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 shrink-0" />

                    {/* Battery */}
                    <HealthField
                        icon={<Battery className={`size-4 ${batteryClass(bPct)}`} />}
                        label="Battery"
                        value={
                            bPct !== undefined
                                ? <span>{bPct}%{bV !== undefined ? <span className="ml-1 text-xs font-normal text-gray-500">{bV.toFixed(1)}V</span> : null}</span>
                                : "–"
                        }
                        valueClass={batteryClass(bPct)}
                    />

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 shrink-0" />

                    {/* GPS Satellites */}
                    <HealthField
                        icon={<Satellite className="size-4" />}
                        label="Sats / Fix"
                        value={
                            sats !== undefined
                                ? <span>{sats} <span className={`text-xs ${fix.cls}`}>{fix.text}</span></span>
                                : "–"
                        }
                        valueClass={
                            sats === undefined ? "text-gray-400"
                            : sats >= 6 ? "text-green-500 dark:text-green-400"
                            : sats >= 4 ? "text-yellow-500 dark:text-yellow-400"
                            : "text-red-500 dark:text-red-400"
                        }
                    />

                    {/* HDOP */}
                    <HealthField
                        icon={<Gauge className="size-4" />}
                        label="HDOP"
                        value={hdop !== undefined ? hdop.toFixed(1) : "–"}
                        valueClass={hdopClass(hdop)}
                    />

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 shrink-0" />

                    {/* Armed state */}
                    <HealthField
                        icon={armed
                            ? <Shield className="size-4 text-green-500 dark:text-green-400" />
                            : <ShieldOff className="size-4 text-gray-400" />
                        }
                        label="Armed"
                        value={armed === undefined ? "–" : armed ? "ARMED" : "Disarmed"}
                        valueClass={
                            armed === undefined ? "text-gray-400"
                            : armed ? "text-green-500 dark:text-green-400"
                            : "text-gray-500 dark:text-gray-400"
                        }
                    />

                    {/* Flight mode */}
                    <HealthField
                        icon={<Navigation2 className="size-4 text-blue-400" />}
                        label="Mode"
                        value={mode ?? "–"}
                        valueClass={mode ? "text-blue-600 dark:text-blue-300 font-bold" : "text-gray-400"}
                    />

                    {/* Current waypoint */}
                    {currWp !== undefined && (
                        <HealthField
                            icon={<MapPin className="size-4 text-red-400" />}
                            label="Current WP"
                            value={`WP ${currWp}`}
                            valueClass="text-gray-900 dark:text-gray-100"
                        />
                    )}

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 shrink-0" />

                    {/* Sampling mode */}
                    <HealthField
                        icon={<Radio className="size-4 text-purple-400" />}
                        label="Sampling"
                        value={samplingMode}
                    />

                    {/* Mission phase badge (only when not idle) */}
                    {missionPhase !== "idle" && (
                        <div className="flex items-center gap-2">
                            <Zap className="size-4 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Mission</div>
                                <MissionPhaseBadge phase={missionPhase} />
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

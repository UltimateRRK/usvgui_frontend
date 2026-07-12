/**
 * NavPanel.tsx
 *
 * Live navigation visualizer showing:
 *  - Compass rose with current heading needle and target bearing pointer
 *  - Heading error and turn direction
 *  - Left / Right thruster bar gauges
 *  - Distance to active waypoint
 */

import { useMemo } from "react";
import { Navigation, Crosshair, Gauge } from "lucide-react";
import { VehiclePosition } from "../../types/bridge";

interface NavPanelProps {
    vehiclePosition: VehiclePosition | null;
    targetBearing?: number | null;   // degrees, null when no active waypoint
    distanceToWp?: number | null;    // metres, null when no active waypoint
}

const TURN_THRESHOLD = 45; // Must match usv_main.py
const KP_TURN        = 0.015;

function normalizeError(error: number): number {
    let e = error % 360;
    if (e > 180)  e -= 360;
    if (e < -180) e += 360;
    return e;
}

function computeThrusters(error: number): { left: number; right: number; phase: "turn" | "drive" } {
    if (Math.abs(error) > TURN_THRESHOLD) {
        const effort = Math.max(0.2, Math.min(1.0, Math.abs(error) * KP_TURN));
        return error > 0
            ? { left: effort, right: 0,      phase: "turn" }
            : { left: 0,      right: effort, phase: "turn" };
    }
    const correction = (error / TURN_THRESHOLD);
    return {
        left:  Math.max(0, Math.min(1, 1.0 + correction)),
        right: Math.max(0, Math.min(1, 1.0 - correction)),
        phase: "drive",
    };
}

// SVG Compass rose
function Compass({ heading, targetBearing }: { heading: number; targetBearing?: number | null }) {
    const cx = 80, cy = 80, r = 64;

    // Heading needle end point
    const headingRad = ((heading - 90) * Math.PI) / 180;
    const hx = cx + r * 0.7 * Math.cos(headingRad);
    const hy = cy + r * 0.7 * Math.sin(headingRad);

    // Target bearing pointer
    let tx: number | null = null, ty: number | null = null;
    if (targetBearing != null) {
        const targetRad = ((targetBearing - 90) * Math.PI) / 180;
        tx = cx + r * 0.55 * Math.cos(targetRad);
        ty = cy + r * 0.55 * Math.sin(targetRad);
    }

    const cardinals = [
        { label: "N", angle: -90 },
        { label: "E", angle:   0 },
        { label: "S", angle:  90 },
        { label: "W", angle: 180 },
    ];

    return (
        <svg viewBox="0 0 160 160" className="w-40 h-40">
            {/* Outer ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="2" />
            {/* Tick marks */}
            {Array.from({ length: 36 }).map((_, i) => {
                const a = ((i * 10 - 90) * Math.PI) / 180;
                const isMajor = i % 9 === 0;
                const ri = isMajor ? r - 8 : r - 4;
                return (
                    <line
                        key={i}
                        x1={cx + r * Math.cos(a)}
                        y1={cy + r * Math.sin(a)}
                        x2={cx + ri * Math.cos(a)}
                        y2={cy + ri * Math.sin(a)}
                        stroke={isMajor ? "#64748b" : "#1e293b"}
                        strokeWidth={isMajor ? 2 : 1}
                    />
                );
            })}
            {/* Cardinal labels */}
            {cardinals.map(({ label, angle }) => {
                const a = (angle * Math.PI) / 180;
                return (
                    <text
                        key={label}
                        x={cx + (r - 16) * Math.cos(a)}
                        y={cy + (r - 16) * Math.sin(a)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-slate-400 font-bold"
                        fontSize="11"
                    >
                        {label}
                    </text>
                );
            })}
            {/* Target bearing arc (dashed) */}
            {tx != null && ty != null && (
                <line
                    x1={cx} y1={cy} x2={tx} y2={ty}
                    stroke="#f59e0b" strokeWidth="2.5"
                    strokeDasharray="4 3" strokeLinecap="round"
                />
            )}
            {/* Heading needle */}
            <line
                x1={cx} y1={cy} x2={hx} y2={hy}
                stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"
            />
            {/* Center dot */}
            <circle cx={cx} cy={cy} r="4" fill="#38bdf8" />
            {/* Heading label */}
            <text
                x={cx} y={cy + r + 14}
                textAnchor="middle"
                className="fill-slate-300"
                fontSize="12"
                fontFamily="monospace"
            >
                {heading.toFixed(1)}°
            </text>
        </svg>
    );
}

// Single thruster bar
function ThrusterBar({
    label, value, pin, color,
}: {
    label: string; value: number; pin: string; color: string;
}) {
    const pct = Math.round(value * 100);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs text-slate-400">
                <span>{label} <span className="text-slate-600">(GPIO {pin})</span></span>
                <span className="font-mono font-bold" style={{ color }}>{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    );
}

export function NavPanel({ vehiclePosition, targetBearing, distanceToWp }: NavPanelProps) {
    const heading = vehiclePosition?.heading ?? 0;

    const { error, thrusters } = useMemo(() => {
        if (targetBearing == null) return { error: null, thrusters: null };
        const e = normalizeError(targetBearing - heading);
        return { error: e, thrusters: computeThrusters(e) };
    }, [heading, targetBearing]);

    const hasTarget = targetBearing != null;

    const actionLabel = (() => {
        if (!hasTarget || error == null) return "Standby — no active waypoint";
        if (thrusters!.phase === "turn") return error > 0 ? ">>> TURNING RIGHT >>>" : "<<< TURNING LEFT <<<";
        return "^^^ DRIVING FORWARD ^^^";
    })();

    const actionColor = (() => {
        if (!hasTarget) return "text-slate-500";
        if (thrusters!.phase === "turn") return "text-amber-400";
        return "text-emerald-400";
    })();

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
                <Navigation size={16} className="text-sky-400" />
                <span className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
                    Navigation
                </span>
                {hasTarget && (
                    <span className={`ml-auto text-xs font-mono font-bold ${actionColor}`}>
                        {actionLabel}
                    </span>
                )}
            </div>

            {/* Compass + Stats */}
            <div className="flex items-center gap-6">
                <Compass heading={heading} targetBearing={targetBearing} />

                <div className="flex-1 flex flex-col gap-3 text-sm font-mono">
                    {/* Heading row */}
                    <div className="flex justify-between">
                        <span className="text-slate-500">Current Heading</span>
                        <span className="text-sky-400 font-bold">{heading.toFixed(1)}°</span>
                    </div>
                    {/* Target bearing row */}
                    <div className="flex justify-between">
                        <span className="text-slate-500">Target Bearing</span>
                        <span className="text-amber-400 font-bold">
                            {hasTarget ? `${targetBearing!.toFixed(1)}°` : "—"}
                        </span>
                    </div>
                    {/* Heading error */}
                    <div className="flex justify-between">
                        <span className="text-slate-500">Heading Error</span>
                        <span className={`font-bold ${error != null && Math.abs(error) > TURN_THRESHOLD ? "text-red-400" : "text-emerald-400"}`}>
                            {error != null ? `${error > 0 ? "+" : ""}${error.toFixed(1)}°` : "—"}
                        </span>
                    </div>
                    {/* Distance to WP */}
                    <div className="flex justify-between border-t border-slate-800 pt-2">
                        <span className="text-slate-500 flex items-center gap-1">
                            <Crosshair size={12} /> Distance to WP
                        </span>
                        <span className="text-violet-400 font-bold">
                            {distanceToWp != null ? `${distanceToWp.toFixed(1)} m` : "—"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Thruster bars */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                    <Gauge size={11} /> Thruster Output
                </div>
                <ThrusterBar
                    label="Left"  pin="12"
                    value={thrusters?.left  ?? 0}
                    color="#38bdf8"
                />
                <ThrusterBar
                    label="Right" pin="13"
                    value={thrusters?.right ?? 0}
                    color="#a78bfa"
                />
            </div>
        </div>
    );
}

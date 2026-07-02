import { useState } from "react";
import { CheckCircle, XCircle, Clock, MapPin, Play, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { Mission } from "../../types/mission";
import { MissionLogEntry } from "../../types/missionLog";

// ChartDataPoint is defined inline here to avoid a hook import in a component file
interface ChartDataPoint {
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

interface MissionLogProps {
    missions: MissionLogEntry[];
    chartData?: ChartDataPoint[];                           // for per-mission WQI summary
    onMissionSelect?: (wps: [number, number][]) => void;    // trigger map replay
}

// ── Per-mission WQI summary (from chartData filtered by waypoint_seq) ─────────

interface WQISummary {
    avgWqi: number | null;
    avgPh: number | null;
    sampleCount: number;
}

function getMissionSummary(entry: MissionLogEntry, chartData?: ChartDataPoint[]): WQISummary {
    if (!chartData || chartData.length === 0) {
        return { avgWqi: null, avgPh: null, sampleCount: 0 };
    }

    // Collect samples that have a waypoint_seq matching any WP in this mission
    const wpSeqs = new Set(entry.mission.waypoints.map((wp) => wp.seq));
    const matching = chartData.filter(
        (d) => d.waypoint_seq !== undefined && wpSeqs.has(d.waypoint_seq)
    );

    if (matching.length === 0) return { avgWqi: null, avgPh: null, sampleCount: 0 };

    const wqiVals = matching.filter((d) => d.wqi !== undefined && d.wqi !== null).map((d) => d.wqi as number);
    const phVals  = matching.filter((d) => d.ph !== undefined).map((d) => d.ph);

    return {
        avgWqi: wqiVals.length > 0 ? parseFloat((wqiVals.reduce((a, b) => a + b, 0) / wqiVals.length).toFixed(1)) : null,
        avgPh:  phVals.length  > 0 ? parseFloat((phVals.reduce((a, b) => a + b, 0)  / phVals.length).toFixed(2))  : null,
        sampleCount: matching.length,
    };
}

function wqiColor(wqi: number): string {
    if (wqi >= 90) return "text-green-500 dark:text-green-400";
    if (wqi >= 70) return "text-lime-500 dark:text-lime-400";
    if (wqi >= 50) return "text-yellow-500 dark:text-yellow-400";
    if (wqi >= 25) return "text-orange-500 dark:text-orange-400";
    return "text-red-500 dark:text-red-400";
}

// ── Single mission card ───────────────────────────────────────────────────────

interface MissionCardProps {
    entry: MissionLogEntry;
    chartData?: ChartDataPoint[];
    onMissionSelect?: (wps: [number, number][]) => void;
}

function MissionCard({ entry, chartData, onMissionSelect }: MissionCardProps) {
    const [expanded, setExpanded] = useState(false);
    const summary = getMissionSummary(entry, chartData);

    const borderCls =
        entry.status === "Accepted"
            ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
            : entry.status === "Rejected"
            ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800";

    const handleReplay = () => {
        if (!onMissionSelect) return;
        const coords = entry.mission.waypoints.map((wp): [number, number] => [wp.x, wp.y]);
        onMissionSelect(coords);
    };

    return (
        <div className={`border rounded-lg p-4 ${borderCls}`}>
            {/* ── Header row ── */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-gray-600 dark:text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {entry.waypointCount} WP{entry.waypointCount !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {entry.status === "Accepted" ? (
                        <>
                            <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs px-2 py-1 rounded bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-300">Accepted</span>
                        </>
                    ) : entry.status === "Rejected" ? (
                        <>
                            <XCircle className="size-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs px-2 py-1 rounded bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-300">Rejected</span>
                        </>
                    ) : (
                        <>
                            <Clock className="size-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-300">Pending</span>
                        </>
                    )}

                    {/* Replay on map button */}
                    {onMissionSelect && entry.mission.waypoints.length > 0 && (
                        <button
                            onClick={handleReplay}
                            title="Replay waypoints on map"
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                        >
                            <Play className="size-3" /> Replay
                        </button>
                    )}
                </div>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono">{entry.timestamp}</div>

            {/* WQI Summary row (from sensor data) */}
            {summary.sampleCount > 0 && (
                <div className="flex items-center gap-3 mb-2 text-xs">
                    <FlaskConical className="size-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400">{summary.sampleCount} samples</span>
                    {summary.avgWqi !== null && (
                        <span className={`font-semibold ${wqiColor(summary.avgWqi)}`}>
                            WQI {summary.avgWqi}
                        </span>
                    )}
                    {summary.avgPh !== null && (
                        <span className="text-gray-500 dark:text-gray-400">pH {summary.avgPh}</span>
                    )}
                </div>
            )}

            {/* Status message */}
            {entry.message && (
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    {entry.message}
                </div>
            )}

            {/* Expandable waypoint details */}
            <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {expanded ? "Hide" : "Show"} waypoints
            </button>

            {expanded && (
                <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {entry.mission.waypoints.map((wp) => (
                        <div key={wp.seq} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                            {wp.seq + 1}. {wp.x.toFixed(6)}°, {wp.y.toFixed(6)}° — {wp.dwellTime}s / {wp.samplesCount} samples
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MissionLog({ missions, chartData, onMissionSelect }: MissionLogProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg text-gray-900 dark:text-gray-100">Mission Log</h2>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {missions.length} mission{missions.length !== 1 ? "s" : ""} logged
                    {onMissionSelect && (
                        <span className="ml-2 text-purple-500 dark:text-purple-400">• Replay available</span>
                    )}
                </div>
            </div>

            {missions.length === 0 ? (
                <div className="text-center py-8">
                    <Clock className="size-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">No missions logged yet</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                        Waypoint missions will appear here once sent to the USV
                    </div>
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {missions.map((entry) => (
                        <MissionCard
                            key={entry.id}
                            entry={entry}
                            chartData={chartData}
                            onMissionSelect={onMissionSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}


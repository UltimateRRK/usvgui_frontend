import {
    MapPin, Trash2, Send, ChevronUp, ChevronDown,
    Clock, FlaskConical, Navigation2, CheckCircle2,
    Loader2, XCircle, AlertTriangle, Info, Route,
    PlusCircle, Timer,
} from "lucide-react";
import {
    Mission,
    updateWaypointInMission,
    removeWaypointFromMission,
    moveWaypointInMission,
    haversineMetres,
    missionTotalDistanceMetres,
    missionEstimatedSeconds,
} from "../../types/mission";

// ── Upload status ─────────────────────────────────────────────────────────────

export type MissionUploadStatus = "idle" | "pending" | "accepted" | "rejected" | "executing" | "completed";

const STATUS_CONFIG: Record<MissionUploadStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle:      { label: "Not sent",   icon: null,                                                  cls: "hidden" },
    pending:   { label: "Pending…",   icon: <Loader2   className="size-3.5 animate-spin" />,       cls: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
    accepted:  { label: "Accepted",   icon: <CheckCircle2 className="size-3.5" />,                 cls: "text-green-600  dark:text-green-400  bg-green-50  dark:bg-green-900/30  border-green-300  dark:border-green-700"  },
    rejected:  { label: "Rejected",   icon: <XCircle   className="size-3.5" />,                    cls: "text-red-600    dark:text-red-400    bg-red-50    dark:bg-red-900/30    border-red-300    dark:border-red-700"    },
    executing: { label: "Executing",  icon: <Loader2   className="size-3.5 animate-spin" />,       cls: "text-blue-600   dark:text-blue-400   bg-blue-50   dark:bg-blue-900/30   border-blue-300   dark:border-blue-700"  },
    completed: { label: "Completed",  icon: <CheckCircle2 className="size-3.5" />,                 cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700" },
};

// ── Goa bounding box (mirrors MapView) ───────────────────────────────────────

const GOA_BOUNDS = {
    minLat: 14.87, maxLat: 15.80,
    minLon: 73.68, maxLon: 74.35,
};

function isInGoaBounds(lat: number, lon: number): boolean {
    return (
        lat >= GOA_BOUNDS.minLat && lat <= GOA_BOUNDS.maxLat &&
        lon >= GOA_BOUNDS.minLon && lon <= GOA_BOUNDS.maxLon
    );
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationIssue {
    severity: "error" | "warning";
    message: string;
}

function validateMission(mission: Mission): ValidationIssue[] {
    const wps = mission.waypoints;
    const issues: ValidationIssue[] = [];

    if (wps.length === 0) return issues;

    if (wps.length > 50) {
        issues.push({ severity: "warning", message: `${wps.length} waypoints — ArduRover supports up to 50 items.` });
    }

    for (let i = 0; i < wps.length; i++) {
        const wp = wps[i];
        if (!isInGoaBounds(wp.x, wp.y)) {
            issues.push({ severity: "error", message: `WP${i + 1} is outside the Goa operational area.` });
        }
    }

    for (let i = 1; i < wps.length; i++) {
        const dist = haversineMetres(wps[i - 1].x, wps[i - 1].y, wps[i].x, wps[i].y);
        if (dist < 5) {
            issues.push({
                severity: "error",
                message: `WP${i} and WP${i + 1} are only ${dist.toFixed(1)} m apart — minimum spacing is 5 m.`,
            });
        }
    }

    if (wps.some((wp) => wp.dwellTime === 0)) {
        issues.push({ severity: "warning", message: "Some waypoints have 0 s dwell — no samples will be collected there." });
    }

    return issues;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatDistance(m: number): string {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MissionPlannerProps {
    mission: Mission;
    onMissionChange: (m: Mission) => void;
    addWaypointMode: boolean;
    setAddWaypointMode: (v: boolean) => void;
    onClearWaypoints: () => void;
    onSendWaypoints: () => void;
    uploadStatus: MissionUploadStatus;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MissionPlanner({
    mission,
    onMissionChange,
    addWaypointMode,
    setAddWaypointMode,
    onClearWaypoints,
    onSendWaypoints,
    uploadStatus,
}: MissionPlannerProps) {
    const wps = mission.waypoints;
    const issues = validateMission(mission);
    const hasErrors = issues.some((i) => i.severity === "error");

    const totalDist  = wps.length >= 2 ? missionTotalDistanceMetres(mission) : 0;
    const estSecs    = wps.length >= 1 ? missionEstimatedSeconds(mission)    : 0;
    const totalSamples = wps.reduce((s, w) => s + (w.samplesCount ?? 0), 0);

    const handleDwellChange = (seq: number, val: number) => {
        if (isNaN(val) || val < 0) return;
        onMissionChange(updateWaypointInMission(mission, seq, { dwellTime: val, param1: val }));
    };

    const handleSamplesChange = (seq: number, val: number) => {
        if (isNaN(val) || val < 1) return;
        onMissionChange(updateWaypointInMission(mission, seq, { samplesCount: val }));
    };

    const handleDelete = (seq: number) => {
        onMissionChange(removeWaypointFromMission(mission, seq));
    };

    const handleMove = (seq: number, dir: "up" | "down") => {
        onMissionChange(moveWaypointInMission(mission, seq, dir));
    };

    const statusCfg = STATUS_CONFIG[uploadStatus];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">

            {/* ── Header toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
                <button
                    id="add-waypoint-btn"
                    onClick={() => setAddWaypointMode(!addWaypointMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        addWaypointMode
                            ? "bg-blue-600 text-white shadow-inner"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                >
                    <PlusCircle className="size-4" />
                    {addWaypointMode ? "Click map…" : "Add WP"}
                </button>

                <button
                    id="clear-waypoints-btn"
                    onClick={onClearWaypoints}
                    disabled={wps.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Trash2 className="size-4" />
                    Clear
                </button>

                <button
                    id="send-waypoints-btn"
                    onClick={onSendWaypoints}
                    disabled={wps.length === 0 || hasErrors}
                    title={hasErrors ? "Fix validation errors before sending" : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
                >
                    <Send className="size-4" />
                    Send ({wps.length})
                </button>

                {/* Upload status badge */}
                {uploadStatus !== "idle" && (
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${statusCfg.cls}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                    </span>
                )}
            </div>

            {/* ── Validation issues ── */}
            {issues.length > 0 && (
                <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
                    {issues.map((issue, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start gap-1.5 text-xs ${
                                issue.severity === "error"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-yellow-600 dark:text-yellow-400"
                            }`}
                        >
                            {issue.severity === "error"
                                ? <XCircle className="size-3.5 shrink-0 mt-0.5" />
                                : <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                            }
                            {issue.message}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Mission preview summary ── */}
            {wps.length >= 2 && (
                <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-750">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                        <Info className="size-3.5" />
                        Mission Preview
                    </div>

                    {/* Leg distances */}
                    <div className="space-y-0.5 mb-2">
                        {wps.slice(1).map((wp, idx) => {
                            const prev = wps[idx];
                            const d = haversineMetres(prev.x, prev.y, wp.x, wp.y);
                            return (
                                <div key={wp.seq} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    <Route className="size-3 text-red-400 shrink-0" />
                                    WP{idx + 1} → WP{idx + 2}: {formatDistance(d)}
                                </div>
                            );
                        })}
                    </div>

                    {/* Totals row */}
                    <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <Route className="size-3 text-blue-400" />
                            <span className="font-semibold">{formatDistance(totalDist)}</span> total
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <Timer className="size-3 text-purple-400" />
                            <span className="font-semibold">~{formatDuration(estSecs)}</span> est.
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <FlaskConical className="size-3 text-green-400" />
                            <span className="font-semibold">{totalSamples}</span> samples
                        </div>
                    </div>
                </div>
            )}

            {/* ── Waypoint list ── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {wps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                        <Navigation2 className="size-10 text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No waypoints yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Click <strong>Add WP</strong> then tap on the map
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {wps.map((wp, idx) => {
                            const outOfBounds = !isInGoaBounds(wp.x, wp.y);
                            const tooClose =
                                idx > 0 &&
                                haversineMetres(wps[idx - 1].x, wps[idx - 1].y, wp.x, wp.y) < 5;

                            return (
                                <li
                                    key={wp.seq}
                                    className={`px-3 py-2.5 transition-colors ${
                                        outOfBounds || tooClose
                                            ? "bg-red-50 dark:bg-red-900/10"
                                            : "hover:bg-gray-50 dark:hover:bg-gray-750"
                                    }`}
                                >
                                    {/* ── Row header ── */}
                                    <div className="flex items-center gap-2 mb-2">
                                        {/* Sequence badge */}
                                        <span className="size-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                            {wp.seq + 1}
                                        </span>

                                        {/* Coordinates */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="size-3 text-gray-400 shrink-0" />
                                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                                                    {wp.x.toFixed(5)}°, {wp.y.toFixed(5)}°
                                                </span>
                                            </div>
                                            {/* Distance to previous WP */}
                                            {idx > 0 && (
                                                <div className="text-xs text-gray-400 dark:text-gray-500 pl-4 font-mono">
                                                    ↑ {formatDistance(haversineMetres(wps[idx - 1].x, wps[idx - 1].y, wp.x, wp.y))} from WP{idx}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reorder + Delete */}
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                onClick={() => handleMove(wp.seq, "up")}
                                                disabled={idx === 0}
                                                title="Move up"
                                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronUp className="size-3.5 text-gray-500 dark:text-gray-400" />
                                            </button>
                                            <button
                                                onClick={() => handleMove(wp.seq, "down")}
                                                disabled={idx === wps.length - 1}
                                                title="Move down"
                                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronDown className="size-3.5 text-gray-500 dark:text-gray-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(wp.seq)}
                                                title="Remove waypoint"
                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Per-waypoint parameters ── */}
                                    <div className="flex flex-wrap gap-2 pl-8">
                                        {/* Dwell time */}
                                        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <Clock className="size-3.5 text-blue-400 shrink-0" />
                                            Dwell
                                            <input
                                                type="number"
                                                min={0}
                                                max={600}
                                                step={5}
                                                value={wp.dwellTime}
                                                onChange={(e) => handleDwellChange(wp.seq, parseInt(e.target.value))}
                                                className="w-14 px-1.5 py-0.5 text-xs font-mono text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            s
                                        </label>

                                        {/* Samples per waypoint */}
                                        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <FlaskConical className="size-3.5 text-purple-400 shrink-0" />
                                            Samples
                                            <input
                                                type="number"
                                                min={1}
                                                max={50}
                                                value={wp.samplesCount}
                                                onChange={(e) => handleSamplesChange(wp.seq, parseInt(e.target.value))}
                                                className="w-12 px-1.5 py-0.5 text-xs font-mono text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                            />
                                        </label>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* ── Footer summary ── */}
            {wps.length > 0 && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{wps.length} waypoint{wps.length !== 1 ? "s" : ""}</span>
                    <span>Total dwell: {wps.reduce((s, w) => s + (w.dwellTime ?? 0), 0)}s</span>
                    <span>Total samples: {totalSamples}</span>
                    {hasErrors && (
                        <span className="ml-auto text-red-500 dark:text-red-400 flex items-center gap-1">
                            <XCircle className="size-3.5" /> Fix errors to send
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

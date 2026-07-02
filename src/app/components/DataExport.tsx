import { useState } from "react";
import { Download, FileText, RefreshCw, Database, History, Play, MapPin, AlertTriangle } from "lucide-react";
import { ref, query, limitToLast, get } from "firebase/database";
import { database, authReady } from "../../services/firebase";
import { ChartDataPoint } from "../../hooks/useSensorData";

interface DataExportProps {
    data: ChartDataPoint[];                                  // session data (last 20 in memory)
    onMissionSelect?: (wps: [number, number][]) => void;    // trigger map replay from Firebase missions
}

// ── Firebase full-history fetch ───────────────────────────────────────────────

async function fetchFullHistory(limit = 500): Promise<ChartDataPoint[]> {
    await authReady;
    const q = query(ref(database, "readings"), limitToLast(limit));
    const snap = await get(q);
    const data = snap.val();
    if (!data) return [];

    return (Object.values(data) as any[]).map((e) => ({
        timestamp: new Date(e.timestamp || Date.now()).toLocaleString("en-US"),
        ph: e.ph ?? 0,
        temperature: e.temperature ?? 0,
        turbidity: e.turbidity ?? 0,
        tds: e.tds ?? 0,
        lat: e.lat,
        lon: e.lon,
        waypoint_seq: e.waypoint_seq,
        wqi: e.wqi,
        wqi_label: e.wqi_label,
    }));
}

// ── Firebase missions loader ──────────────────────────────────────────────────

interface FirebaseMission {
    key: string;
    status: string;
    created_at: string;
    waypoints: Array<{ lat: number; lon: number; seq: number; dwellTime?: number; samplesCount?: number }>;
}

async function fetchFirebaseMissions(limit = 50): Promise<FirebaseMission[]> {
    await authReady;
    const q = query(ref(database, "missions"), limitToLast(limit));
    const snap = await get(q);
    const data = snap.val();
    if (!data) return [];

    return Object.entries(data as Record<string, any>)
        .map(([key, val]) => ({
            key,
            status: val.status ?? "unknown",
            created_at: val.created_at ?? "",
            waypoints: Array.isArray(val.waypoints) ? val.waypoints : [],
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ── CSV builder ───────────────────────────────────────────────────────────────

function buildCSV(rows: ChartDataPoint[]): string {
    const headers = ["Timestamp", "pH Level", "Temperature (°C)", "Turbidity (NTU)", "TDS (ppm)", "Latitude", "Longitude", "WP Index", "WQI", "WQI Label"];
    const csvRows = [headers.join(",")];
    rows.forEach((r) => {
        csvRows.push([
            `"${r.timestamp}"`,
            (r.ph ?? 0).toFixed(2),
            (r.temperature ?? 0).toFixed(2),
            (r.turbidity ?? 0).toFixed(2),
            (r.tds ?? 0).toFixed(0),
            r.lat !== undefined ? r.lat.toFixed(7) : "",
            r.lon !== undefined ? r.lon.toFixed(7) : "",
            r.waypoint_seq !== undefined ? r.waypoint_seq.toString() : "",
            r.wqi !== undefined ? r.wqi.toFixed(2) : "",
            r.wqi_label ?? "",
        ].join(","));
    });
    return csvRows.join("\n");
}

function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = filename;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function tsFilename() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

// ── Status pill ───────────────────────────────────────────────────────────────

function statusPill(status: string) {
    const map: Record<string, string> = {
        pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
        accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        completed:"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
            {status}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataExport({ data, onMissionSelect }: DataExportProps) {
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<ChartDataPoint[] | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const [missionsLoading, setMissionsLoading] = useState(false);
    const [firebaseMissions, setFirebaseMissions] = useState<FirebaseMission[] | null>(null);
    const [missionsError, setMissionsError] = useState<string | null>(null);

    // Determine active dataset for export
    const activeData = historyData ?? data;

    // ── Download handlers ──

    const handleDownloadCSV = (rows: ChartDataPoint[]) => {
        if (rows.length === 0) return;
        downloadBlob(buildCSV(rows), `usv_water_quality_${tsFilename()}.csv`, "text/csv;charset=utf-8;");
    };

    const handleDownloadJSON = (rows: ChartDataPoint[]) => {
        if (rows.length === 0) return;
        downloadBlob(JSON.stringify(rows, null, 2), `usv_water_quality_${tsFilename()}.json`, "application/json;charset=utf-8;");
    };

    // ── Full Firebase history fetch ──

    const handleFetchHistory = async () => {
        setHistoryLoading(true);
        setHistoryError(null);
        try {
            const rows = await fetchFullHistory(500);
            setHistoryData(rows);
        } catch (e: any) {
            setHistoryError(e.message ?? "Unknown error");
        } finally {
            setHistoryLoading(false);
        }
    };

    // ── Mission replay loader ──

    const handleFetchMissions = async () => {
        setMissionsLoading(true);
        setMissionsError(null);
        try {
            const missions = await fetchFirebaseMissions(50);
            setFirebaseMissions(missions);
        } catch (e: any) {
            setMissionsError(e.message ?? "Unknown error");
        } finally {
            setMissionsLoading(false);
        }
    };

    const handleReplayMission = (mission: FirebaseMission) => {
        if (!onMissionSelect || mission.waypoints.length === 0) return;
        const coords = mission.waypoints
            .sort((a, b) => a.seq - b.seq)
            .map((wp): [number, number] => [wp.lat, wp.lon]);
        onMissionSelect(coords);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <h2 className="text-lg text-gray-900 dark:text-gray-100">Data Export</h2>

            {/* ── Session export ── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <FileText className="size-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Session Data</h3>
                    <span className="text-xs text-gray-400">(last {data.length} in-memory readings)</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">Records</div>
                        <div className="text-xl text-gray-900 dark:text-gray-100">{data.length}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">First</div>
                        <div className="text-xs text-gray-900 dark:text-gray-100">{data.length > 0 ? data[0].timestamp : "N/A"}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">Latest</div>
                        <div className="text-xs text-gray-900 dark:text-gray-100">{data.length > 0 ? data[data.length - 1].timestamp : "N/A"}</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => handleDownloadCSV(data)}
                        disabled={data.length === 0}
                        className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        <Download className="size-4" /> CSV
                    </button>
                    <button
                        onClick={() => handleDownloadJSON(data)}
                        disabled={data.length === 0}
                        className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        <Download className="size-4" /> JSON
                    </button>
                </div>
            </section>

            {/* ── Full Firebase history ── */}
            <section className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Database className="size-4 text-green-500" />
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Full Firebase History</h3>
                        <span className="text-xs text-gray-400">(up to 500 readings)</span>
                    </div>
                    <button
                        onClick={handleFetchHistory}
                        disabled={historyLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`size-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                        {historyLoading ? "Loading…" : historyData ? "Reload" : "Fetch"}
                    </button>
                </div>

                {historyError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-2">
                        <AlertTriangle className="size-3.5" /> {historyError}
                    </div>
                )}

                {historyData && (
                    <>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {historyData.length} readings fetched — includes lat/lon, WP index, WQI, and WQI label columns.
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleDownloadCSV(historyData)}
                                className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors text-sm"
                            >
                                <Download className="size-4" /> CSV ({historyData.length})
                            </button>
                            <button
                                onClick={() => handleDownloadJSON(historyData)}
                                className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors text-sm"
                            >
                                <Download className="size-4" /> JSON
                            </button>
                        </div>
                    </>
                )}
            </section>

            {/* ── Mission Replay ── */}
            {onMissionSelect && (
                <section className="border-t border-gray-200 dark:border-gray-700 pt-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <History className="size-4 text-purple-500" />
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mission Replay</h3>
                            <span className="text-xs text-gray-400">(last 50 from Firebase)</span>
                        </div>
                        <button
                            onClick={handleFetchMissions}
                            disabled={missionsLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={`size-3.5 ${missionsLoading ? "animate-spin" : ""}`} />
                            {missionsLoading ? "Loading…" : firebaseMissions ? "Reload" : "Load"}
                        </button>
                    </div>

                    {missionsError && (
                        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-2">
                            <AlertTriangle className="size-3.5" /> {missionsError}
                        </div>
                    )}

                    {firebaseMissions && firebaseMissions.length === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                            No missions found in Firebase.
                        </div>
                    )}

                    {firebaseMissions && firebaseMissions.length > 0 && (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {firebaseMissions.map((m) => (
                                <div
                                    key={m.key}
                                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <MapPin className="size-3.5 text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                                                {m.created_at
                                                    ? new Date(m.created_at).toLocaleString("en-US", {
                                                          month: "short", day: "numeric",
                                                          hour: "2-digit", minute: "2-digit",
                                                      })
                                                    : m.key}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {m.waypoints.length} WP{m.waypoints.length !== 1 ? "s" : ""}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {statusPill(m.status)}
                                        <button
                                            onClick={() => handleReplayMission(m)}
                                            disabled={m.waypoints.length === 0}
                                            title="Show waypoints on map"
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                                        >
                                            <Play className="size-3" /> Replay
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Files are timestamped for record keeping. Full export includes GPS coordinates and WQI data.
            </p>
        </div>
    );
}

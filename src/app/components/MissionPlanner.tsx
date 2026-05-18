import {
  MapPin, Trash2, Send, ChevronUp, ChevronDown,
  Clock, FlaskConical, Navigation2, CheckCircle2,
  Loader2, XCircle, PlusCircle,
} from "lucide-react";
import { Mission, updateWaypointInMission, removeWaypointFromMission, moveWaypointInMission } from "../../types/mission";

export type MissionUploadStatus = "idle" | "pending" | "accepted" | "rejected";

interface MissionPlannerProps {
  mission: Mission;
  onMissionChange: (m: Mission) => void;
  addWaypointMode: boolean;
  setAddWaypointMode: (v: boolean) => void;
  onClearWaypoints: () => void;
  onSendWaypoints: () => void;
  uploadStatus: MissionUploadStatus;
}

const STATUS_CONFIG: Record<MissionUploadStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  idle:     { label: "Not sent",  icon: null,                                                  cls: "hidden" },
  pending:  { label: "Pending…",  icon: <Loader2   className="size-3.5 animate-spin" />,       cls: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
  accepted: { label: "Accepted",  icon: <CheckCircle2 className="size-3.5" />,                 cls: "text-green-600  dark:text-green-400  bg-green-50  dark:bg-green-900/30  border-green-300  dark:border-green-700"  },
  rejected: { label: "Rejected",  icon: <XCircle   className="size-3.5" />,                    cls: "text-red-600    dark:text-red-400    bg-red-50    dark:bg-red-900/30    border-red-300    dark:border-red-700"    },
};

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

  const handleMove = (seq: number, dir: 'up' | 'down') => {
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
          disabled={wps.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
        >
          <Send className="size-4" />
          Send ({wps.length})
        </button>

        {/* Upload status badge */}
        {uploadStatus !== "idle" && (
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${statusCfg.cls}`}
          >
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        )}
      </div>

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
            {wps.map((wp, idx) => (
              <li
                key={wp.seq}
                className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
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
                  </div>

                  {/* Reorder + Delete */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMove(wp.seq, 'up')}
                      disabled={idx === 0}
                      title="Move up"
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="size-3.5 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleMove(wp.seq, 'down')}
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
                      onChange={e => handleDwellChange(wp.seq, parseInt(e.target.value))}
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
                      onChange={e => handleSamplesChange(wp.seq, parseInt(e.target.value))}
                      className="w-12 px-1.5 py-0.5 text-xs font-mono text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer summary ── */}
      {wps.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{wps.length} waypoint{wps.length !== 1 ? 's' : ''}</span>
          <span>
            Total dwell: {wps.reduce((s, w) => s + (w.dwellTime ?? 0), 0)}s
          </span>
          <span>
            Total samples: {wps.reduce((s, w) => s + (w.samplesCount ?? 0), 0)}
          </span>
        </div>
      )}
    </div>
  );
}

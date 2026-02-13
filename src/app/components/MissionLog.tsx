import { CheckCircle, XCircle, Clock, MapPin } from "lucide-react";
import { Mission } from "../../types/mission";

export interface MissionLogEntry {
  id: string;
  timestamp: string;
  mission: Mission;
  waypointCount: number;
  status: "Accepted" | "Rejected" | "Pending";
  message?: string;
}

interface MissionLogProps {
  missions: MissionLogEntry[];
}

export function MissionLog({ missions }: MissionLogProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-gray-900 dark:text-gray-100">Mission Log</h2>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {missions.length} mission{missions.length !== 1 ? "s" : ""} logged
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
          {missions.map((mission) => (
            <div
              key={mission.id}
              className={`border rounded-lg p-4 ${mission.status === "Accepted"
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : mission.status === "Rejected"
                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {mission.waypointCount} waypoint{mission.waypointCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {mission.status === "Accepted" ? (
                    <>
                      <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
                      <span className="text-xs px-2 py-1 rounded bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-300">
                        Accepted
                      </span>
                    </>
                  ) : mission.status === "Rejected" ? (
                    <>
                      <XCircle className="size-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs px-2 py-1 rounded bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-300">
                        Rejected
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="size-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-300">
                        Pending
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-mono">{mission.timestamp}</span>
              </div>

              {mission.message && (
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  {mission.message}
                </div>
              )}

              {/* Waypoint coordinates preview */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Waypoint Coordinates:</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {mission.mission.waypoints.slice(0, 3).map((wp) => (
                    <div key={wp.seq} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {wp.seq + 1}. {wp.x.toFixed(6)}°, {wp.y.toFixed(6)}°
                    </div>
                  ))}
                  {mission.mission.waypoints.length > 3 && (
                    <div className="text-xs text-gray-500 italic">
                      +{mission.mission.waypoints.length - 3} more waypoints
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

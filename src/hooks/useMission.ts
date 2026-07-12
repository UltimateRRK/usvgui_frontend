/**
 * useMission
 *
 * All mission planning state and Firebase handshake logic.
 * Encapsulates: mission state, upload flow, mission log, waypoint handlers.
 *
 * All user-facing status messages are routed to the System Console via
 * the onLog callback — toast popups are no longer used here.
 */

import { useState, useEffect } from "react";
import { ref, push, set, onValue, get } from "firebase/database";
import { database, authReady } from "../services/firebase";
import { Mission, createEmptyMission, addWaypointToMission } from "../types/mission";
import { MissionLogEntry } from "../types/missionLog";
import { ConsoleEntry, makeLog } from "../types/console";

export type MissionUploadStatus = "idle" | "pending" | "accepted" | "rejected" | "executing" | "completed";

export interface UseMissionResult {
    mission: Mission;
    setMission: (m: Mission) => void;
    addWaypointMode: boolean;
    setAddWaypointMode: (v: boolean) => void;
    uploadStatus: MissionUploadStatus;
    missionLog: MissionLogEntry[];
    handleAddWaypoint: (position: [number, number]) => void;
    handleClearWaypoints: () => void;
    handleSendWaypoints: () => void;
}

export function useMission(onLog: (entry: ConsoleEntry) => void): UseMissionResult {
    const [mission, setMission] = useState<Mission>(createEmptyMission());
    const [addWaypointMode, setAddWaypointMode] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<MissionUploadStatus>("idle");
    const [lastMissionRef, setLastMissionRef] = useState<string | null>(null);
    const [missionLog, setMissionLog] = useState<MissionLogEntry[]>([]);

    // Listen for Pi status updates on the most-recently-sent mission
    useEffect(() => {
        if (!lastMissionRef) return;
        let unsub: (() => void) | undefined;

        authReady.then(() => {
            const mRef = ref(database, `missions/${lastMissionRef}/status`);
            unsub = onValue(mRef, (snap) => {
                const status = snap.val() as string | null;
                if (!status || status === "pending") return;

                if (status === "accepted") {
                    setUploadStatus("accepted");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Accepted", message: "Mission accepted by USV — executing." }
                                : e
                        )
                    );
                    onLog(makeLog("success", "USV accepted the mission — executing!"));

                } else if (status === "active") {
                    setUploadStatus("executing");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Accepted", message: "Mission executing on USV." }
                                : e
                        )
                    );
                    onLog(makeLog("nav", "Mission is now ACTIVE on the USV. Navigating to first waypoint..."));

                } else if (status === "rejected") {
                    setUploadStatus("rejected");
                    get(ref(database, `missions/${lastMissionRef}/reason`)).then((rSnap) => {
                        const reason = rSnap.val() || "Check Pi logs";
                        setMissionLog((prev) =>
                            prev.map((e, i) =>
                                i === 0
                                    ? { ...e, status: "Rejected", message: `Rejected: ${reason}` }
                                    : e
                            )
                        );
                        onLog(makeLog("error", `Mission REJECTED by USV: ${reason}`));
                    });

                } else if (status === "failsafe") {
                    setUploadStatus("rejected");
                    get(ref(database, `missions/${lastMissionRef}/reason`)).then((rSnap) => {
                        const reason = rSnap.val() || "Unknown hardware/timeout failure";
                        setMissionLog((prev) =>
                            prev.map((e, i) =>
                                i === 0
                                    ? { ...e, status: "Rejected", message: `⚠️ FAILSAFE: ${reason}` }
                                    : e
                            )
                        );
                        onLog(makeLog("error", `⚠️  FAILSAFE TRIGGERED — ${reason}`));
                    });

                } else if (status === "completed") {
                    setUploadStatus("completed");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Accepted", message: "Mission completed successfully." }
                                : e
                        )
                    );
                    onLog(makeLog("success", "Mission completed successfully. USV returning home."));
                }
            });
        });

        return () => unsub?.();
    }, [lastMissionRef]);

    const handleAddWaypoint = (position: [number, number]) => {
        setMission((prev) => {
            const updated = addWaypointToMission(prev, position[0], position[1]);
            onLog(makeLog("info", `Waypoint ${updated.waypoints.length} added at (${position[0].toFixed(5)}, ${position[1].toFixed(5)}).`));
            return updated;
        });
        setAddWaypointMode(false);
    };

    const handleClearWaypoints = () => {
        setMission(createEmptyMission());
        setUploadStatus("idle");
        onLog(makeLog("system", "All waypoints cleared."));
    };

    const handleSendWaypoints = () => {
        if (mission.waypoints.length === 0) {
            onLog(makeLog("warn", "Send aborted — no waypoints defined."));
            return;
        }

        authReady.then(() => {
            const missionRef = push(ref(database, "missions"));
            const missionKey = missionRef.key!;

            set(missionRef, {
                waypoints: mission.waypoints.map((wp) => ({
                    lat: wp.x,
                    lon: wp.y,
                    seq: wp.seq,
                    dwellTime: wp.dwellTime ?? 0,
                    samplesCount: wp.samplesCount ?? 3,
                })),
                status: "pending",
                created_at: new Date().toISOString(),
            });

            setLastMissionRef(missionKey);
            setUploadStatus("pending");

            const missionEntry: MissionLogEntry = {
                id: Date.now().toString(),
                firebaseKey: missionKey,
                timestamp: new Date().toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }),
                mission,
                waypointCount: mission.waypoints.length,
                status: "Pending",
                message: `Mission uploaded. Waiting for USV acknowledgement (${mission.waypoints.length} WP${mission.waypoints.length !== 1 ? "s" : ""}).`,
            };

            setMissionLog((prev) => [missionEntry, ...prev]);
            onLog(makeLog("info", `Mission uploaded to Firebase (${mission.waypoints.length} waypoint${mission.waypoints.length !== 1 ? "s" : ""}). Waiting for USV acknowledgement...`));
        });
    };

    return {
        mission,
        setMission,
        addWaypointMode,
        setAddWaypointMode,
        uploadStatus,
        missionLog,
        handleAddWaypoint,
        handleClearWaypoints,
        handleSendWaypoints,
    };
}

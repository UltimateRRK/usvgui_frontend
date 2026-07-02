/**
 * useMission
 *
 * All mission planning state and Firebase handshake logic.
 * Encapsulates: mission state, upload flow, mission log, waypoint handlers.
 */

import { useState, useEffect } from "react";
import { ref, push, set, onValue } from "firebase/database";
import { database, authReady } from "../services/firebase";
import { toast } from "sonner";
import { Mission, createEmptyMission, addWaypointToMission } from "../types/mission";
import { MissionLogEntry } from "../types/missionLog";

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

export function useMission(): UseMissionResult {
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
                    toast.success("USV accepted the mission — executing!");
                } else if (status === "active") {
                    // Pi transitions accepted → active once the mission starts running
                    setUploadStatus("executing");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Accepted", message: "Mission executing on USV." }
                                : e
                        )
                    );
                } else if (status === "rejected") {
                    setUploadStatus("rejected");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Rejected", message: "Mission rejected by USV. Check Pi logs." }
                                : e
                        )
                    );
                    toast.error("USV rejected the mission.");
                } else if (status === "failsafe") {
                    setUploadStatus("rejected");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Rejected", message: "⚠️ FAILSAFE triggered — mission aborted. Check vehicle." }
                                : e
                        )
                    );
                    toast.error("⚠️ FAILSAFE — USV mission aborted!", { duration: 8000 });
                } else if (status === "completed") {
                    setUploadStatus("completed");
                    setMissionLog((prev) =>
                        prev.map((e, i) =>
                            i === 0
                                ? { ...e, status: "Accepted", message: "Mission completed successfully." }
                                : e
                        )
                    );
                    toast.success("Mission completed!");
                }
            });
        });

        return () => unsub?.();
    }, [lastMissionRef]);

    const handleAddWaypoint = (position: [number, number]) => {
        setMission((prev) => addWaypointToMission(prev, position[0], position[1]));
        setAddWaypointMode(false);
        toast.success(`Waypoint added`);
    };

    const handleClearWaypoints = () => {
        setMission(createEmptyMission());
        setUploadStatus("idle");
        toast.info("Waypoints cleared");
    };

    const handleSendWaypoints = () => {
        if (mission.waypoints.length === 0) return;

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
            toast.success(`${mission.waypoints.length} waypoints sent to USV`);
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

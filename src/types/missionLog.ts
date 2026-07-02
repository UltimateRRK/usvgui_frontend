/**
 * MissionLogEntry
 * 
 * Shared type for mission log entries.
 * Lives here (not in the component file) to avoid circular imports
 * between hooks and components.
 */
import { Mission } from "./mission";

export interface MissionLogEntry {
    id: string;
    /** Firebase push key — used for replay lookup */
    firebaseKey?: string;
    timestamp: string;
    mission: Mission;
    waypointCount: number;
    status: "Accepted" | "Rejected" | "Pending";
    message?: string;
}

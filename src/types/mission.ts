/**
 * ArduPilot / Pixhawk Mission Data Types
 * 
 * This module defines TypeScript interfaces that match the MAVLink MISSION_ITEM
 * format used by ArduPilot / Mission Planner for autonomous vehicle missions.
 * 
 * Designed for USV (Unmanned Surface Vehicle) applications with ArduRover.
 */

/**
 * MAVLink command types
 * See: https://mavlink.io/en/messages/common.html#mav_commands
 */
export enum MavCmd {
    /** Navigate to waypoint */
    MAV_CMD_NAV_WAYPOINT = 16,
    /** Loiter at position indefinitely */
    MAV_CMD_NAV_LOITER_UNLIM = 17,
    /** Loiter at position for specified turns */
    MAV_CMD_NAV_LOITER_TURNS = 18,
    /** Loiter at position for specified time */
    MAV_CMD_NAV_LOITER_TIME = 19,
    /** Return to launch */
    MAV_CMD_NAV_RETURN_TO_LAUNCH = 20,
}

/**
 * MAVLink coordinate frame types
 * See: https://mavlink.io/en/messages/common.html#MAV_FRAME
 */
export enum MavFrame {
    /** Global (WGS84) coordinate frame with absolute altitude (MSL) */
    MAV_FRAME_GLOBAL = 0,
    /** Global (WGS84) coordinate frame with altitude relative to home position */
    MAV_FRAME_GLOBAL_RELATIVE_ALT = 3,
}

/**
 * Waypoint interface matching MAVLink MISSION_ITEM format
 * 
 * This matches the structure expected by ArduPilot autopilots.
 * Field names use MAVLink conventions (x/y/z instead of lat/lon/alt).
 */
export interface Waypoint {
    /** Sequence number (0-based, must be contiguous) */
    seq: number;

    /** Coordinate frame (use MAV_FRAME_GLOBAL_RELATIVE_ALT for ArduRover) */
    frame: MavFrame;

    /** MAVLink command type */
    command: MavCmd;

    /** 
     * Current waypoint flag
     * IMPORTANT: Always false in frontend state.
     * Only seq=0 is marked current=true during MAVLink upload.
     */
    current: boolean;

    /** Auto-continue to next waypoint after reaching this one */
    autocontinue: boolean;

    /** 
     * param1: Command-specific parameter
     * For MAV_CMD_NAV_WAYPOINT: Hold time at waypoint (seconds)
     * 
     * IMPORTANT: Keep generic. Different commands use params differently.
     * Do NOT add semantic names like 'holdTime' - breaks MAVLink parity.
     */
    param1: number;

    /** 
     * param2: Command-specific parameter
     * For MAV_CMD_NAV_WAYPOINT: Acceptance radius (meters)
     * 
     * IMPORTANT: Keep generic. Different commands use params differently.
     */
    param2: number;

    /** 
     * param3: Command-specific parameter
     * For MAV_CMD_NAV_WAYPOINT: Pass radius (meters)
     * 
     * IMPORTANT: Keep generic. Different commands use params differently.
     */
    param3: number;

    /** 
     * param4: Command-specific parameter
     * For MAV_CMD_NAV_WAYPOINT: Yaw angle (degrees, NaN=ignore)
     * 
     * IMPORTANT: Keep generic. Different commands use params differently.
     */
    param4: number;

    /** x: Latitude (degrees) */
    x: number;

    /** y: Longitude (degrees) */
    y: number;

    /** 
     * z: Altitude (meters)
     * For USV: always 0 (surface vehicle)
     */
    z: number;
}

/**
 * Mission metadata
 */
export interface MissionMetadata {
    /** Human-readable mission name */
    name: string;

    /** Mission creation timestamp (ISO 8601) */
    createdAt: string;

    /** Last modification timestamp (ISO 8601) */
    updatedAt: string;
}

/**
 * Mission container matching ArduPilot mission structure
 */
export interface Mission {
    /** Array of waypoints in sequence order */
    waypoints: Waypoint[];

    /** 
     * Current waypoint index (0-based)
     * 
     * IMPORTANT: Frontend-owned, display-only field.
     * - Set to 0 on mission creation
     * - Do NOT sync with Pixhawk's current waypoint
     * - Pixhawk determines current waypoint internally via telemetry
     * - This is advisory for UI display only
     * - Will be replaced by telemetry data in future implementation
     */
    currentWaypointIndex: number;

    /** Mission metadata */
    metadata: MissionMetadata;
}

/**
 * Create an empty mission with no waypoints
 */
export function createEmptyMission(): Mission {
    const now = new Date().toISOString();
    return {
        waypoints: [],
        currentWaypointIndex: 0,
        metadata: {
            name: 'USV Mission',
            createdAt: now,
            updatedAt: now,
        },
    };
}

/**
 * Create a waypoint with USV-appropriate defaults
 * 
 * @param seq - Sequence number (0-based)
 * @param lat - Latitude in degrees
 * @param lon - Longitude in degrees
 * @returns Waypoint object with ArduRover defaults
 */
function createWaypoint(seq: number, lat: number, lon: number): Waypoint {
    return {
        seq,
        frame: MavFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
        command: MavCmd.MAV_CMD_NAV_WAYPOINT,
        current: false, // Always false in frontend; only seq=0 marked true during upload
        autocontinue: true,
        param1: 0,  // Hold time: 0 seconds
        param2: 2,  // Acceptance radius: 2 meters (safe USV default)
        param3: 0,  // Pass radius: 0 (pass through)
        param4: 0,  // Yaw: 0 (auto-yaw to next waypoint)
        x: lat,     // MAVLink uses 'x' for latitude
        y: lon,     // MAVLink uses 'y' for longitude
        z: 0,       // Altitude: 0 for surface vehicle
    };
}

/**
 * Add a waypoint to an existing mission
 * 
 * Creates a new mission object with the waypoint appended.
 * Ensures contiguous sequence numbering.
 * 
 * @param mission - Existing mission
 * @param lat - Latitude in degrees
 * @param lon - Longitude in degrees
 * @returns New mission with waypoint added
 */
export function addWaypointToMission(
    mission: Mission,
    lat: number,
    lon: number
): Mission {
    const seq = mission.waypoints.length; // Ensures contiguous 0-based indexing
    const newWaypoint = createWaypoint(seq, lat, lon);

    return {
        ...mission,
        waypoints: [...mission.waypoints, newWaypoint],
        metadata: {
            ...mission.metadata,
            updatedAt: new Date().toISOString(),
        },
    };
}



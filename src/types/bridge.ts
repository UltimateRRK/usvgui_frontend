/**
 * Bridge API Contract
 * 
 * Data contract between Frontend ↔ Bridge ↔ Pixhawk (MAVLink)
 * 
 * Vehicle: USV / ArduRover
 * 
 * CRITICAL: Frontend stores lat/lon in degrees.
 * Bridge handles MAVLink scaling (1e7) internally.
 */

// ============================================================================
// VEHICLE TELEMETRY
// ============================================================================

/**
 * Vehicle position and movement telemetry
 * 
 * Derived from:
 * - GLOBAL_POSITION_INT (lat, lon, alt, velocities)
 * - VFR_HUD (heading, groundspeed)
 */
export interface VehiclePosition {
    /** Latitude in degrees (WGS84) */
    lat: number;

    /** Longitude in degrees (WGS84) */
    lon: number;

    /** 
     * Altitude in meters (MSL or relative depending on frame)
     * From GLOBAL_POSITION_INT.alt (scaled from mm)
     */
    alt: number;

    /** 
     * Heading in degrees (0-360, 0=North)
     * From VFR_HUD.heading or GLOBAL_POSITION_INT.hdg
     */
    heading: number;

    /** 
     * Ground speed in m/s
     * From VFR_HUD.groundspeed
     */
    groundspeed: number;

    /** 
     * Vertical speed in m/s (positive = up)
     * From GLOBAL_POSITION_INT.vz (scaled from cm/s)
     */
    verticalSpeed?: number;

    /** Telemetry timestamp (ISO 8601) */
    timestamp: string;
}

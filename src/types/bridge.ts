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
 * Vehicle position, movement, and health telemetry.
 * 
 * Core fields (existing, always present when Pi is online):
 *   - GLOBAL_POSITION_INT → lat, lon, alt
 *   - VFR_HUD → heading, groundspeed
 *
 * Health fields (new, optional — Pi writes when available):
 *   - BATTERY_STATUS → batteryVoltage, batteryPercent
 *   - GPS_RAW_INT    → satellites, hdop, fixType
 *   - HEARTBEAT      → mode, armed
 *   - MISSION_CURRENT → currentWp
 *   - Pi process     → lastHeartbeatAt
 *
 * All optional fields degrade gracefully — the health strip shows "–" when absent.
 */
export interface VehiclePosition {
    // ── Core movement ──────────────────────────────────────────────────────

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

    // ── Battery ────────────────────────────────────────────────────────────

    /**
     * Battery voltage in volts.
     * From BATTERY_STATUS.voltages[0] / 1000.
     * Optional — only present when Pi reads BATTERY_STATUS from Pixhawk.
     */
    batteryVoltage?: number;

    /**
     * Battery charge percentage (0–100).
     * From BATTERY_STATUS.battery_remaining.
     * -1 from MAVLink means unknown — Pi should omit or set null.
     */
    batteryPercent?: number;

    // ── GPS quality ────────────────────────────────────────────────────────

    /**
     * Number of visible GPS satellites.
     * From GPS_RAW_INT.satellites_visible.
     */
    satellites?: number;

    /**
     * Horizontal dilution of precision.
     * From GPS_RAW_INT.eph / 100.0.
     * Lower is better (< 2.0 = good, < 5.0 = acceptable).
     */
    hdop?: number;

    /**
     * GPS fix type.
     * From GPS_RAW_INT.fix_type.
     * 0=No GPS, 1=No fix, 2=2D, 3=3D, 4=DGPS, 5=RTK float, 6=RTK fixed.
     */
    fixType?: number;

    // ── Vehicle state ──────────────────────────────────────────────────────

    /**
     * ArduRover flight mode name (e.g. "AUTO", "MANUAL", "HOLD", "RTL", "GUIDED").
     * From HEARTBEAT.custom_mode via pix.mav.mode_mapping() inverse lookup.
     */
    mode?: string;

    /**
     * Whether the vehicle is armed.
     * From HEARTBEAT.base_mode & MAV_MODE_FLAG_SAFETY_ARMED.
     */
    armed?: boolean;

    /**
     * Index of the current MAVLink waypoint being navigated to (0-based).
     * From MISSION_CURRENT.seq.
     */
    currentWp?: number;

    /**
     * Timestamp of the last HEARTBEAT received from the Pixhawk (ISO 8601).
     * Written by the Pi each time it processes a HEARTBEAT message.
     * Frontend uses this to detect Pixhawk link loss independently of sensor data.
     */
    lastHeartbeatAt?: string;
}


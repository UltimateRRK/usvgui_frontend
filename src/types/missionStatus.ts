/**
 * Mission Phase — USV Operational Lifecycle
 *
 * Tracks the richer state of a mission beyond the coarse pending/accepted/rejected
 * Firebase handshake. Some phases are written by the Pi to Firebase; others are
 * derived locally by the frontend.
 *
 * Pi-written phases (written to /missions/{key}/phase):
 *   "queued"    — Pi has read the mission, queued it
 *   "uploading" — Pi is uploading waypoints to Pixhawk via MAVLink
 *   "armed"     — Pixhawk armed, waiting to enter AUTO
 *   "auto"      — Pixhawk in AUTO mode, en-route to first WP
 *   "at_wp"     — Arrived at a waypoint, station-keeping
 *   "sampling"  — Actively taking water samples at a WP
 *   "rtl"       — Mission complete, returning to launch
 *   "completed" — Mission fully done
 *   "failsafe"  — Safety condition triggered (low battery, GPS loss, etc.)
 *
 * Frontend-only phases (not written to Firebase):
 *   "idle"      — No active mission
 */
export type MissionPhase =
  | "idle"
  | "queued"
  | "uploading"
  | "armed"
  | "auto"
  | "at_wp"
  | "sampling"
  | "rtl"
  | "completed"
  | "failsafe";

/**
 * Human-readable label and style for each mission phase.
 */
export const MISSION_PHASE_CONFIG: Record<
  MissionPhase,
  { label: string; color: string; description: string }
> = {
  idle:      { label: "Idle",       color: "gray",   description: "No active mission" },
  queued:    { label: "Queued",     color: "blue",   description: "Mission queued on USV" },
  uploading: { label: "Uploading",  color: "blue",   description: "Uploading waypoints to Pixhawk" },
  armed:     { label: "Armed",      color: "yellow", description: "Pixhawk armed, ready for AUTO" },
  auto:      { label: "En Route",   color: "cyan",   description: "Navigating to waypoint" },
  at_wp:     { label: "At WP",      color: "green",  description: "Station-keeping at waypoint" },
  sampling:  { label: "Sampling",   color: "green",  description: "Collecting water samples" },
  rtl:       { label: "RTL",        color: "orange", description: "Returning to launch" },
  completed: { label: "Completed",  color: "green",  description: "Mission successfully completed" },
  failsafe:  { label: "FAILSAFE",   color: "red",    description: "Safety condition triggered" },
};

// ============================================================================
// Pi Telemetry Spec (for reference)
// ============================================================================
//
// The Pi should extend its push to /telemetry/{DEVICE_ID}/current with these
// additional fields so the frontend health strip can display real operational data.
//
// Recommended push shape (all fields optional, existing ones preserved):
//
//   /telemetry/usv-01/current:
//   {
//     // existing
//     "lat":              15.4909,
//     "lon":              73.8278,
//     "alt":              0.0,
//     "heading":          270.0,
//     "groundspeed":      1.5,
//     "timestamp":        "2026-05-30T10:00:00.000Z",
//
//     // new — vehicle health
//     "batteryVoltage":   11.4,        // float, volts from BATTERY_STATUS MAVLink msg
//     "batteryPercent":   78,          // int 0-100, from BATTERY_STATUS.battery_remaining
//     "satellites":       9,           // int, from GPS_RAW_INT.satellites_visible
//     "hdop":             1.2,         // float, from GPS_RAW_INT.eph / 100.0
//     "fixType":          3,           // int, GPS_RAW_INT.fix_type (0=no fix, 3=3D, 4=DGPS)
//     "mode":             "AUTO",      // string, from mode_mapping() reverse lookup
//     "armed":            true,        // bool, from heartbeat.base_mode & MAV_MODE_FLAG_SAFETY_ARMED
//     "currentWp":        1,           // int, current waypoint index from MISSION_CURRENT.seq
//     "lastHeartbeatAt":  "2026-05-30T10:00:01.000Z"  // ISO 8601, time Pi received last Pixhawk heartbeat
//   }
//
// Pi implementation notes:
//   - BATTERY_STATUS: listen with mav.recv_match(type='BATTERY_STATUS')
//   - GPS_RAW_INT:    listen with mav.recv_match(type='GPS_RAW_INT')
//   - Mode string:    pix.mav.mode_mapping() gives {name: id}; invert for id→name
//   - Armed:          heartbeat.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED
//   - MISSION_CURRENT: mav.recv_match(type='MISSION_CURRENT')
// ============================================================================

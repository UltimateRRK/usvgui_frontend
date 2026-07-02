# USV Monitoring & Navigation Dashboard — Handoff Document

> **Generated:** June 2026  
> **Repo:** `usvgui_frontend` (Vite + React + TypeScript + TailwindCSS v4)  
> **Live URL:** Deployed on Vercel (see `vercel.json`)

---

## Project Overview

A mission-driven autonomous water-sampling boat that navigates with a Pixhawk 2.4.8 flight controller (ArduRover V4.5.5), measures water quality at waypoints, and syncs data to Firebase and MQTT for live monitoring and storage.

**What it does**  
The boat reads water sensors (pH, TDS, turbidity, temperature), calculates a Water Quality Index (WQI), and labels the result from "Excellent" to "Very Poor." It also tracks GPS position, heading, speed, battery, waypoint distance, and mission state through the Pixhawk telemetry link. The system accepts missions, uploads waypoints to the Pixhawk, moves to each waypoint, holds station for a set time, takes multiple samples, and then returns via RTL mode.

**Main software components**

| File | Role |
|------|------|
| `pixhawk_link.py` | MAVLink helper layer — opens serial on `/dev/ttyAMA0`, listens for heartbeat and telemetry messages, exposes clean methods: `get_position()`, `get_gps_status()`, `get_wp_info()`, `distance_to()` |
| `usv_main.py` | Main control program — initialises thruster PWM, ADS1115, DS18B20, MQTT, Firebase, SQLite, and Pixhawk; starts background threads for telemetry push, mission polling, and periodic sampling |
| `src/` (this repo) | React/TypeScript frontend — shows live sensor data, map with GPS trail, mission planner, health strip, data export |

**Data flow**  
Sensor readings → SQLite (local) + JSONL log + MQTT + Firebase `/readings`.  
Telemetry → Firebase `/telemetry/usv-01/current` (updated every second).  
Missions → written to Firebase `/missions/{key}` by frontend; Pi polls and executes.

**Safety**  
Checks Pixhawk heartbeat, arming state, low battery (< 10.0 V), satellite count (≥ 6), and HDOP (≤ 2.5). On failure: stop thruster → write `status='failsafe'` to Firebase → log reason.

**Hardware**

| Component | Detail |
|-----------|--------|
| SBC | Raspberry Pi 5 |
| Flight controller | Pixhawk 2.4.8, TELEM2 `/dev/ttyAMA0` @ 57600 baud |
| ESC | SimonK 30A, GPIO12 hardware PWM |
| ADC | ADS1115 over I2C |
| Temperature | DS18B20 over 1-wire |
| Connectivity | SIM7600 LTE |
| Key paths | Firebase key: `/home/admin5/firebase-key.json` · Logs: `/home/admin5/usv_logs/` · DB: `/home/admin5/sensor_data.db` |

---


## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Structure](#4-repository-structure)
5. [Firebase / Backend Contract](#5-firebase--backend-contract)
   - [Authentication](#51-authentication)
   - [Database Paths](#52-firebase-realtime-database-paths)
   - [Data Flow Diagrams](#53-data-flow)
6. [TypeScript Type Definitions](#6-typescript-type-definitions)
   - [mission.ts](#61-missionts)
   - [bridge.ts](#62-bridgets)
7. [Frontend Components](#7-frontend-components)
   - [App.tsx (Root)](#71-apptsx--root-orchestrator)
   - [Header](#72-header)
   - [USVHealthStrip](#73-usvhealthstrip)
   - [MapView](#74-mapview)
   - [MissionPlanner (side panel)](#75-missionplanner)
   - [SensorCard](#76-sensorcard)
   - [WaterQualityStatus](#77-waterqualitystatus)
   - [CombinedScientificData](#78-combinedscientificdata)
   - [AlertsThresholds](#79-alertsthresholds)
   - [DataExport](#710-dataexport)
   - [SystemSettings](#711-systemsettings)
   - [MissionLog](#712-missionlog)
   - [ThemeProvider & DarkModeToggle](#713-themeprovider--darkmodetoggle)
8. [State Management](#8-state-management)
9. [Sensor Logic & Thresholds](#9-sensor-logic--thresholds)
10. [Deployment](#10-deployment)
11. [Environment Variables](#11-environment-variables)
12. [Pi / Backend Side Notes](#12-pi--backend-side-notes)
13. [Known Limitations & TODOs](#13-known-limitations--todos)

---

## 1. System Overview

This is the **ground-control GUI** for an autonomous Unmanned Surface Vehicle (USV) that monitors water quality in Goa's Mandovi River estuary. 

The system has two halves:

| Half | What it does |
|------|-------------|
| **Pi Backend** | Runs on a Raspberry Pi aboard the USV. Reads water sensors, sends readings to Firebase RTDB, polls Firebase for new missions, executes missions via MAVLink to a Pixhawk autopilot, and writes mission acknowledgements back to Firebase. |
| **This Frontend** | React web app hosted on Vercel. Displays live sensor data and GPS telemetry. Lets operators plan waypoint missions on an interactive map and upload them to Firebase for the Pi to pick up. |

**Firebase Realtime Database is the only communication channel** between the Pi and the GUI — there is no direct socket or REST link between them.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        OPERATOR BROWSER                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  React App (Vite, deployed on Vercel)                       │ │
│  │                                                             │ │
│  │  App.tsx ──► Firebase onValue listeners (readings,          │ │
│  │              telemetry, mission status)                     │ │
│  │           ──► Firebase set/push (missions, config)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │  Firebase Realtime DB (cloud)
                              │
┌──────────────────────────────────────────────────────────────────┐
│                        RASPBERRY PI (USV)                        │
│                                                                  │
│  sensor_loop.py ──► Firebase push (readings)                    │
│  mission_watcher.py ─► Firebase onValue (missions)              │
│                     ─► MAVLink to Pixhawk                       │
│                     ─► Firebase set (mission status)            │
│  telemetry_bridge.py ─► MAVLink read from Pixhawk              │
│                      ─► Firebase set (telemetry/current)        │
└──────────────────────────────────────────────────────────────────┘
                              │  MAVLink (Serial/UART)
                              │
                    ┌─────────────────┐
                    │  Pixhawk / ArduRover │
                    │  (navigation, GPS)   │
                    └─────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.3.1 |
| Build Tool | Vite | 6.3.5 |
| Language | TypeScript | via `@types/react ^19` |
| Styling | TailwindCSS v4 | 4.1.12 |
| Map | Leaflet | 1.9.4 |
| Charts | Recharts | 2.15.2 |
| Icons | lucide-react | 0.487.0 |
| Toast Notifications | sonner | 2.0.3 |
| Dark mode | next-themes | 0.4.6 |
| Backend / Realtime DB | Firebase RTDB | ^12.9.0 |
| Auth | Firebase Anonymous Auth | (same SDK) |
| Hosting | Vercel | — |

---

## 4. Repository Structure

```
usvgui_frontend/
├── index.html                  # Vite entry HTML
├── vite.config.ts              # Vite config (React plugin, TailwindCSS v4 plugin, @ alias)
├── vercel.json                 # Vercel build/install commands
├── package.json
├── guidelines/
│   └── Guidelines.md           # AI prompt guidelines (empty template)
└── src/
    ├── main.tsx                # ReactDOM.createRoot → <App />
    ├── vite-env.d.ts           # import.meta.env types
    ├── styles/
    │   ├── index.css           # Entrypoint: @import tailwind.css + theme.css
    │   ├── tailwind.css        # Tailwind base/components/utilities
    │   ├── theme.css           # CSS custom properties (colors, spacing, dark mode tokens)
    │   └── fonts.css           # Font-face declarations
    ├── services/
    │   └── firebase.ts         # Firebase init, anonymous auth, exports `database` + `authReady`
    ├── types/
    │   ├── mission.ts          # Mission/Waypoint interfaces + pure helper functions
    │   └── bridge.ts           # VehiclePosition interface (MAVLink telemetry contract)
    └── app/
        ├── App.tsx             # Root component: all state, Firebase subscriptions, layout
        └── components/
            ├── Header.tsx
            ├── USVHealthStrip.tsx
            ├── MapView.tsx
            ├── MissionPlanner.tsx
            ├── SensorCard.tsx
            ├── WaterQualityStatus.tsx
            ├── CombinedScientificData.tsx
            ├── AlertsThresholds.tsx
            ├── DataExport.tsx
            ├── SystemSettings.tsx
            ├── MissionLog.tsx
            ├── ThemeProvider.tsx
            └── DarkModeToggle.tsx
```

---

## 5. Firebase / Backend Contract

### 5.1 Authentication

The frontend uses **Firebase Anonymous Authentication**. Before any reads or writes, it calls `signInAnonymously()` and exports a promise called `authReady`. Every Firebase subscription in `App.tsx` chains off `.then(() => ...)` to wait for a valid auth token. This avoids "permission denied" race conditions on page load.

```ts
// src/services/firebase.ts
export const authReady: Promise<void> = signInAnonymously(auth)
    .then(() => { /* ok */ })
    .catch((error) => { console.error(...) });
```

> **Pi must also authenticate** (e.g. with a service account or anonymous auth) before reading/writing — Firebase Security Rules gate access.

---

### 5.2 Firebase Realtime Database Paths

#### `/readings` — Sensor Data (Pi → Frontend)

The Pi **pushes** a new child here each time sensors are sampled.

**Shape of each child:**
```json
{
  "timestamp": "2026-05-30T10:00:00.000Z",
  "ph": 7.2,
  "temperature": 26.5,
  "tds": 320,
  "turbidity": 2.1,
  "lat": 15.4909,
  "lon": 73.8278,
  "waypoint_seq": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 string | When the reading was taken |
| `ph` | number | pH value (0–14) |
| `temperature` | number | °C |
| `tds` | number | Total Dissolved Solids (ppm) |
| `turbidity` | number | NTU |
| `lat` | number | GPS latitude (degrees) — optional if no GPS fix |
| `lon` | number | GPS longitude (degrees) — optional if no GPS fix |
| `waypoint_seq` | number | 0-based index of the current waypoint — used for per-waypoint analytics. Optional. |

The frontend queries: `query(ref(database, "readings"), limitToLast(20))` — only the last 20 readings are kept in memory for charts.

---

#### `/missions/{pushKey}` — Mission Upload (Frontend → Pi)

The frontend **pushes** a new child here when the operator clicks "Send".

**Shape:**
```json
{
  "status": "pending",
  "created_at": "2026-05-30T10:00:00.000Z",
  "waypoints": [
    { "lat": 15.4909, "lon": 73.8278, "seq": 0, "dwellTime": 10, "samplesCount": 3 },
    { "lat": 15.4950, "lon": 73.8300, "seq": 1, "dwellTime": 10, "samplesCount": 3 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"pending"` \| `"accepted"` \| `"rejected"` | Written by Pi after reading the mission. Frontend listens for changes. |
| `created_at` | ISO 8601 string | Upload timestamp |
| `waypoints[].lat` | number | Latitude (degrees) |
| `waypoints[].lon` | number | Longitude (degrees) |
| `waypoints[].seq` | number | 0-based sequence number |
| `waypoints[].dwellTime` | number | Seconds to hold at waypoint for sampling |
| `waypoints[].samplesCount` | number | Number of sensor readings to collect at waypoint |

**Pi handshake:** After the Pi reads and processes a pending mission it writes:
- `status = "accepted"` if it has started executing
- `status = "rejected"` if it cannot execute (e.g. GPS no fix, arming fail)

The frontend listens at `missions/{key}/status` and shows a toast + updates the MissionLog.

---

#### `/telemetry/{DEVICE_ID}/current` — GPS/Telemetry (Pi → Frontend)

The Pi writes this continuously as it receives MAVLink telemetry from the Pixhawk.

**Shape:**
```json
{
  "lat": 15.4909,
  "lon": 73.8278,
  "alt": 0.0,
  "heading": 270.0,
  "groundspeed": 1.5,
  "timestamp": "2026-05-30T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lat` | number | WGS84 latitude |
| `lon` | number | WGS84 longitude |
| `alt` | number | Altitude in metres (0 for surface) |
| `heading` | number | Degrees 0–360, 0 = North |
| `groundspeed` | number | m/s |
| `timestamp` | ISO 8601 string | Telemetry timestamp |

The frontend builds a **trail** from this: up to 300 recent positions are stored as `[number, number][]` and drawn as a blue polyline on the map.

---

#### `/config/{DEVICE_ID}/sensorInterval` — Sampling Interval (Frontend → Pi)

A single number (seconds). The frontend writes here when the operator changes the sampling mode via SystemSettings. The Pi reads this each cycle and adjusts its sleep duration.

```json
30
```

**Device ID constant:** `DEVICE_ID = "usv-01"` — this must match the `DEVICE_ID` constant set on the Pi.

---

### 5.3 Data Flow

```
SENSOR SAMPLING FLOW
Pi sensors → Pi script → Firebase /readings/{pushKey}
                                         │
                                         ▼
                          App.tsx onValue listener (limitToLast 20)
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              setSensorData         setChartData        setHasGpsFix
                    │
                    ▼
          calculateWaterQuality → setWaterQuality
          getSensorStatus('ph'/'temperature'/...) → SensorCard status

MISSION FLOW
Operator clicks "Send" in MissionPlanner
        │
        ▼
App.tsx handleSendWaypoints()
  → push(missions) → Firebase /missions/{key}
  → setLastMissionRef(key)
  → setUploadStatus("pending")
  → addMissionLogEntry(Pending)
        │
        ▼ (Pi picks up)
Pi executes mission
  → set(missions/{key}/status, "accepted"|"rejected")
        │
        ▼ (App.tsx listener)
App.tsx useEffect on lastMissionRef
  → onValue(missions/{key}/status)
  → setUploadStatus("accepted"|"rejected")
  → update MissionLog entry
  → toast.success/error

INTERVAL CONFIG FLOW
Operator changes sampling mode in SystemSettings
  → onIntervalChange(seconds) [App.tsx]
  → set(config/usv-01/sensorInterval, seconds)
  → Firebase /config/usv-01/sensorInterval
  → Pi reads on next cycle, adjusts sleep
```

---

## 6. TypeScript Type Definitions

### 6.1 `mission.ts`

Located at `src/types/mission.ts`. Defines MAVLink-compatible data structures for missions.

#### Key Types

```ts
enum MavCmd {
  MAV_CMD_NAV_WAYPOINT = 16,
  MAV_CMD_NAV_LOITER_UNLIM = 17,
  MAV_CMD_NAV_LOITER_TURNS = 18,
  MAV_CMD_NAV_LOITER_TIME = 19,
  MAV_CMD_NAV_RETURN_TO_LAUNCH = 20,
}

enum MavFrame {
  MAV_FRAME_GLOBAL = 0,
  MAV_FRAME_GLOBAL_RELATIVE_ALT = 3,
}

interface Waypoint {
  seq: number;           // 0-based
  frame: MavFrame;       // Always MAV_FRAME_GLOBAL_RELATIVE_ALT for ArduRover
  command: MavCmd;       // Always MAV_CMD_NAV_WAYPOINT in practice
  current: boolean;      // Always false in frontend; Pi marks seq=0 as current on upload
  autocontinue: boolean; // Always true
  param1: number;        // Hold time (seconds) — mirrors dwellTime on upload
  param2: number;        // Acceptance radius (2m default)
  param3: number;        // Pass radius (0 = pass through)
  param4: number;        // Yaw angle (0 = auto)
  x: number;             // Latitude (MAVLink uses x/y not lat/lon!)
  y: number;             // Longitude
  z: number;             // Altitude (always 0 for USV)
  dwellTime: number;     // USV-specific: seconds to hold for sampling
  samplesCount: number;  // USV-specific: number of samples to collect
}

interface Mission {
  waypoints: Waypoint[];
  currentWaypointIndex: number; // Display-only; do not sync with Pixhawk
  metadata: {
    name: string;
    createdAt: string;  // ISO 8601
    updatedAt: string;  // ISO 8601
  };
}
```

> **Critical naming:** MAVLink uses `x` for latitude and `y` for longitude — not `lat`/`lon`. When displaying coordinates, always use `wp.x` as lat and `wp.y` as lon. When sending to Firebase for the Pi, the conversion is done explicitly in `handleSendWaypoints` in `App.tsx`.

#### Helper Functions

| Function | Description |
|----------|-------------|
| `createEmptyMission()` | Returns a fresh `Mission` with no waypoints |
| `addWaypointToMission(mission, lat, lon)` | Appends a new waypoint with USV defaults (10s dwell, 3 samples, 2m acceptance radius) |
| `updateWaypointInMission(mission, seq, patch)` | Immutably patches a single waypoint's fields |
| `removeWaypointFromMission(mission, seq)` | Removes a waypoint and re-indexes remaining ones |
| `moveWaypointInMission(mission, seq, 'up'|'down')` | Swaps waypoint position and re-indexes |

All functions are **pure** — they return a new `Mission` object.

---

### 6.2 `bridge.ts`

Located at `src/types/bridge.ts`. Defines the data contract between the frontend and the Pi's telemetry bridge (via Firebase).

```ts
interface VehiclePosition {
  lat: number;           // WGS84 degrees
  lon: number;           // WGS84 degrees
  alt: number;           // metres MSL
  heading: number;       // 0–360°, 0=North
  groundspeed: number;   // m/s
  verticalSpeed?: number; // m/s, positive=up
  timestamp: string;     // ISO 8601
}
```

> **MAVLink scaling note:** The Pi receives `lat`/`lon` from MAVLink as integers scaled by 1e7. The telemetry bridge divides by 1e7 before writing to Firebase so the frontend always works in plain degrees.

---

## 7. Frontend Components

### 7.1 `App.tsx` — Root Orchestrator

**File:** `src/app/App.tsx`

The single source of truth for all application state. Contains:
- All `useState` declarations
- All Firebase `useEffect` subscriptions
- All mission action handlers
- Page layout (Header → HealthStrip → main grid → footer)

#### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `isOnline` | `boolean` | True when Firebase `/readings` has delivered data |
| `hasGpsFix` | `boolean` | True when a reading has non-zero lat/lon |
| `lastUpdate` | `Date` | Timestamp of the latest reading |
| `sensorData` | `SensorData` | `{ph, temperature, tds, turbidity}` — latest reading |
| `waterQuality` | `"good"\|"moderate"\|"poor"` | Computed from sensor data |
| `vehiclePosition` | `VehiclePosition\|null` | Latest GPS telemetry |
| `trail` | `[number, number][]` | Last 300 GPS positions for map trail |
| `mission` | `Mission` | Current planned (not-yet-sent) mission |
| `addWaypointMode` | `boolean` | When true, map clicks add waypoints |
| `uploadStatus` | `MissionUploadStatus` | `"idle"\|"pending"\|"accepted"\|"rejected"` |
| `lastMissionRef` | `string\|null` | Firebase push key of the last sent mission (used to subscribe to status updates) |
| `chartData` | `ChartDataPoint[]` | Last 20 readings formatted for Recharts |
| `sensorInterval` | `number` | Current sampling interval in seconds |
| `missionLog` | `MissionLogEntry[]` | History of sent missions (in-memory, not persisted) |
| `batteryLevel` | `number` | **Simulated** at 85% — not yet wired to real telemetry |

#### Key Handlers

| Handler | Trigger | Effect |
|---------|---------|--------|
| `handleAddWaypoint(position)` | Map click in waypoint mode | Calls `addWaypointToMission`, exits waypoint mode |
| `handleClearWaypoints()` | Clear button | Resets mission to empty |
| `handleSendWaypoints()` | Send button | Pushes mission to Firebase `/missions`, sets `lastMissionRef`, adds log entry |
| `handleIntervalChange(seconds)` | Settings change | Sets local state + writes to Firebase `/config/usv-01/sensorInterval` |

#### Water Quality Scoring (`calculateWaterQuality`)

Scores 4 parameters (0–1 each, 0.5 for borderline) and classifies:
- ≥ 3.5 → `"good"`
- ≥ 2.0 → `"moderate"`
- < 2.0 → `"poor"`

| Parameter | Good range | Borderline |
|-----------|-----------|------------|
| pH | 6.5–8.5 | 6.0–9.0 |
| Temperature | 20–28°C | 15–32°C |
| TDS | < 500 ppm | < 600 ppm |
| Turbidity | < 5 NTU | < 10 NTU |

#### Dev Mode Debug

In development, `window.currentMission` and `window.vehiclePosition` are exposed for console inspection.

---

### 7.2 `Header`

**File:** `src/app/components/Header.tsx`

Simple navbar with the dashboard title and a `DarkModeToggle`. Receives `isOnline`, `hasGpsFix`, `lastUpdate` as props (currently only uses them for possible future expansion — the health strip handles display).

Background color: `#0B2038` (dark navy — hardcoded inline style).

---

### 7.3 `USVHealthStrip`

**File:** `src/app/components/USVHealthStrip.tsx`

A horizontal status bar below the header showing at-a-glance USV health:

| Field | Source | Notes |
|-------|--------|-------|
| Connection | `connectionStatus` prop | `"online"` / `"degraded"` / `"offline"` — derived from `isOnline` in App |
| Last Update | `lastTelemetryTimestamp` | Shows relative time (`"5s ago"`, `"2m ago"`) |
| Battery | `batteryLevel` | Optional; **currently hardcoded to 85%** in App.tsx |
| Sampling Mode | `samplingMode` | Derived from `sensorInterval`: ≤60s → Survey, ≤900s → Routine, else Standby |

---

### 7.4 `MapView`

**File:** `src/app/components/MapView.tsx`

Interactive Leaflet map occupying the left 3/5 of the main grid. Handles all map rendering imperatively via refs (Leaflet is not React-compatible natively).

#### Map Features

| Feature | Implementation |
|---------|---------------|
| Default center | Mandovi River, Goa: `[15.4909, 73.8278]`, zoom 13 |
| Map bounds | Goa bounding box `[14.87, 73.68]` → `[15.80, 74.35]`. Waypoints outside this are rejected with a popup. |
| Street tiles | OpenStreetMap |
| Satellite tiles | Esri World Imagery (maxNativeZoom: 18, upsizes at z19) |
| Layer toggle | Bottom-left "Map / Satellite" pill buttons |
| USV marker | Blue SVG boat icon, rotates with `vehiclePosition.heading` |
| USV popup | Shows lat/lon, heading, groundspeed on click |
| Trail | Blue polyline from last 300 positions |
| Waypoint markers | Red numbered circles (1-based display) |
| Waypoint route | Red dashed polyline connecting waypoints in order |
| Waypoint popup | Shows dwell time and sample count |
| Heading indicator | Overlaid compass widget (top-left), visible only when `vehiclePosition` is set |
| Path history badge | Shows count of trail points (top-right) |

#### Mission Planner Panel

A collapsible right panel (`w-72`) hosts the `MissionPlanner` component. Toggle button in the map's top bar shows waypoint count badge when hidden. Panel toggling calls `mapRef.current.invalidateSize()` after a 320ms delay to fix Leaflet tile rendering after resize.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `vehiclePosition` | `VehiclePosition\|null` | Current GPS position for marker |
| `trail` | `[number, number][]` | Historical path for polyline |
| `mission` | `Mission` | Waypoints to render |
| `onMissionChange` | `(m: Mission) => void` | Called when planner modifies a waypoint |
| `onAddWaypoint` | `(pos: [number, number]) => void` | Called on valid map click in waypoint mode |
| `onClearWaypoints` | `() => void` | Clear all waypoints |
| `onSendWaypoints` | `() => void` | Upload mission to Firebase |
| `addWaypointMode` | `boolean` | Whether map clicks place waypoints |
| `setAddWaypointMode` | `(v: boolean) => void` | Toggle waypoint placement mode |
| `uploadStatus` | `MissionUploadStatus` | Shown as badge in MissionPlanner |

---

### 7.5 `MissionPlanner`

**File:** `src/app/components/MissionPlanner.tsx`

Side panel rendered inside `MapView`. Manages the list of waypoints for the current mission.

#### `MissionUploadStatus` type

```ts
type MissionUploadStatus = "idle" | "pending" | "accepted" | "rejected";
```

Displayed as a colored pill badge:
- `idle` → hidden
- `pending` → yellow spinner "Pending…"
- `accepted` → green checkmark "Accepted"
- `rejected` → red X "Rejected"

#### Per-Waypoint Controls

Each waypoint row shows:
- Sequence number badge (1-based red circle)
- Lat/lon in monospace
- Up/Down reorder arrows
- Delete button
- **Dwell time** (seconds, 0–600, step 5) → updates `param1` and `dwellTime`
- **Samples count** (1–50) → updates `samplesCount`

Footer shows totals: waypoint count, total dwell time, total sample count.

---

### 7.6 `SensorCard`

**File:** `src/app/components/SensorCard.tsx`

Reusable card for a single sensor reading. Used 4× in App.tsx (pH, Temperature, TDS, Turbidity).

| Status | Card background | Icon background | Badge |
|--------|----------------|-----------------|-------|
| `normal` | Green-tinted | Green | "NORMAL" |
| `warning` | Yellow-tinted | Yellow | "WARNING" |
| `alert` | Red-tinted | Red | "ALERT" |

Status is computed by `getSensorStatus()` in `App.tsx`, which reads thresholds from `localStorage` (set by `AlertsThresholds`).

---

### 7.7 `WaterQualityStatus`

**File:** `src/app/components/WaterQualityStatus.tsx`

Simple styled badge showing the computed `"good"/"moderate"/"poor"` water quality label with an appropriate icon. **Currently unused in the main layout** (was removed from the visible page — but the component exists and the logic still runs in App.tsx via `setWaterQuality`).

---

### 7.8 `CombinedScientificData`

**File:** `src/app/components/CombinedScientificData.tsx`

The most complex component. A tabbed scientific analysis dashboard with 4 views.

#### Data Inputs

- `data: ChartData[]` — the rolling 20-reading history from Firebase
- `currentData: {ph, temperature, turbidity, tds}` — latest snapshot

#### Tabs

**1. Temporal Diagnostics** (`temporal`)
- Select a parameter (pH / Temperature / Turbidity / TDS)
- ComposedChart showing:
  - Raw signal (blue, faint line)
  - 5-point rolling mean (solid blue line)
  - Anomaly markers (red dots — readings > 2 std deviations from mean)
  - Green shaded band = normal operating range
- Change Summary Cards for all 4 parameters:
  - Direction (Rising 📈 / Falling 📉 / Stable ─)
  - Rate of change (linear regression over last 10 points)
  - Status (Stable 🟢 / Watch 🟡 / Alert 🔴)

**2. Relationship Analysis** (`relationship`)
- ScatterChart with user-selectable X and Y axes (any two of the 4 parameters)
- Time window filter (10min / 30min / Mission)
- **Pearson Correlation Coefficient** displayed (r = -1 to 1)
- Auto-generated interpretation text (e.g. "Strong positive correlation between Temperature and TDS. Thermal stratification can influence particle suspension.")

**3. State Deviation** (`deviation`)
- Horizontal bar chart showing each parameter as a % of its acceptable range (0% = at minimum, 100% = at maximum)
- Red dashed line at 100%
- Bars colored green/yellow/orange/red based on percentage
- Priority Attention cards for any parameter > 70% of range

**4. Waypoint Analytics** (`waypoints`)
- Table of per-waypoint statistics (avg/min/max for each parameter)
- Uses `waypoint_seq` field from sensor readings to group data spatially
- Only shows data from readings that include a `waypoint_seq` (i.e. mission-mode readings)

#### Analysis Window Selector

- **Live** → last 15 readings
- **Short-term** → last 30 readings
- **Mission** → all readings

#### Waypoint Filter

Dropdown to filter the analysis to a specific waypoint's readings only.

---

### 7.9 `AlertsThresholds`

**File:** `src/app/components/AlertsThresholds.tsx`

Displays active threshold violations and allows editing threshold values.

#### Threshold Persistence

Thresholds are stored in `localStorage` under the key `waterQualityThresholds` as a JSON object:

```json
{
  "ph":          { "min": 6.5, "max": 8.5,  "optimal": 7.0 },
  "temperature": { "min": 15,  "max": 30,   "optimal": 22  },
  "turbidity":   { "min": 0,   "max": 5,    "optimal": 2   },
  "tds":         { "min": 0,   "max": 500,  "optimal": 300 }
}
```

These are also read by `getSensorStatus()` in `App.tsx` to color the `SensorCard` components — so changing thresholds here instantly recolors the cards.

#### Alert Logic

| Parameter | Warning | Critical |
|-----------|---------|---------|
| pH | Outside `[min, max]` | < 6.0 or > 9.0 |
| Temperature | Outside `[min, max]` | < 10°C or > 35°C |
| Turbidity | > max | > 10 NTU |
| TDS | > max | > 1000 ppm |

New alerts trigger `toast.error` (critical) or `toast.warning` (warning) via sonner. Uses `previousAlerts` state to only toast on **newly** triggered alerts.

#### Inline Editing

Clicking a threshold value turns it into an input. Press Enter or blur to save. Escape cancels.

---

### 7.10 `DataExport`

**File:** `src/app/components/DataExport.tsx`

Exports the in-memory `chartData` (last 20 readings) to CSV or JSON. Shows a summary of record count, first/last timestamps.

**CSV columns:** Timestamp, pH Level, Temperature (°C), Turbidity (NTU), TDS (ppm)

Files are named: `water_quality_data_{ISO-timestamp}.csv` / `.json`

> **Note:** Only the currently-loaded 20 readings are exported. Historical data from Firebase is not fetched here. For full historical exports, data would need to be queried from Firebase directly.

---

### 7.11 `SystemSettings`

**File:** `src/app/components/SystemSettings.tsx`

Two tabs: **Sensors** and **Info**.

#### Sensors Tab

Three preset sampling modes:

| Mode | Interval | Power | Data Rate | Max Duration |
|------|----------|-------|-----------|-------------|
| Survey Mode | 30s | Medium | 120 readings/hr | 4–6 hours |
| Routine Monitoring | 300s (5 min) | Low | 12 readings/hr | 12–24 hours |
| Low-Power / Standby | 1800s (30 min) | Minimal | 2 readings/hr | 48+ hours |

Selecting a mode calls `onIntervalChange(mode.interval)` → propagates to Firebase.

**Advanced Settings** (collapsible, warns about bypassing safeguards): allows either selecting from a preset list (5s to 5hr) or typing a raw seconds value.

**Estimated Impact Panel** shows current power level (1–5 bar indicator), data rate, max duration, and mission context for the active interval.

#### Info Tab

Static system information (vehicle name, navigation system, telemetry protocol, firmware version, sensor hardware models, communication details).

---

### 7.12 `MissionLog`

**File:** `src/app/components/MissionLog.tsx`

Scrollable list of past mission uploads (in-memory, cleared on page refresh). Each entry shows:
- Waypoint count
- Status badge (Accepted / Rejected / Pending) with appropriate color
- Upload timestamp
- Status message
- Preview of first 3 waypoint coordinates (with "+N more" truncation)

**`MissionLogEntry` interface:**
```ts
interface MissionLogEntry {
  id: string;            // Date.now().toString()
  timestamp: string;     // Formatted locale string
  mission: Mission;      // Full mission snapshot at time of upload
  waypointCount: number;
  status: "Accepted" | "Rejected" | "Pending";
  message?: string;      // Status message (updated when Pi responds)
}
```

---

### 7.13 `ThemeProvider` & `DarkModeToggle`

**ThemeProvider** (`src/app/components/ThemeProvider.tsx`): Wraps the entire app in `next-themes`'s `NextThemesProvider` with `attribute="class"` (adds `dark` class to `<html>`), `defaultTheme="dark"`, and `enableSystem`.

**DarkModeToggle** (`src/app/components/DarkModeToggle.tsx`): A button in the Header that toggles between `"dark"` and `"light"` themes. Uses a mount guard (`useState(false)` + `useEffect`) to avoid hydration flicker.

---

## 8. State Management

There is **no global state library** (no Redux, Zustand, etc.). All state lives in `App.tsx` and is passed down as props. This is intentional for simplicity.

The one exception is `AlertsThresholds`: it reads/writes threshold config to **`localStorage`**, and `App.tsx`'s `getSensorStatus()` also reads from `localStorage`. This is the only cross-component shared state that bypasses React's prop system.

---

## 9. Sensor Logic & Thresholds

### Default Thresholds

Used by both `getSensorStatus()` (App.tsx) and `AlertsThresholds.tsx`:

| Sensor | Min | Max | Critical low | Critical high |
|--------|-----|-----|-------------|--------------|
| pH | 6.5 | 8.5 | < 6.0 | > 9.0 |
| Temperature | 15°C | 30°C | < 10°C | > 35°C |
| Turbidity | 0 | 5 NTU | — | > 10 NTU |
| TDS | 0 | 500 ppm | — | > 1000 ppm |

### Status → Card Color Mapping

```
normal  → green  (within threshold min–max)
warning → yellow (outside threshold but not critical)
alert   → red    (exceeds critical threshold)
```

### Sampling Mode → Human Label

```ts
sensorInterval <= 60   → "Survey Mode"
sensorInterval <= 900  → "Routine Monitoring"
else                   → "Low-Power / Standby"
```

---

## 10. Deployment

### Local Development

```bash
npm install --legacy-peer-deps
npm run dev          # Starts Vite dev server
```

> `--legacy-peer-deps` is required because `@types/react@19` has a peer conflict with some packages.

### Production Build

```bash
npm run build        # Outputs to /dist
```

### Vercel

The `vercel.json` sets:
```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install --legacy-peer-deps"
}
```

Vercel auto-deploys on push to the connected branch. The app is a pure SPA with no server-side rendering — Vercel serves `dist/index.html` for all routes.

### Path Alias

`@` resolves to `src/` (configured in `vite.config.ts`):
```ts
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

---

## 11. Environment Variables

All Firebase config is loaded from `.env` (or Vercel environment variables). Create a `.env` file in the repo root:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> All variables **must** start with `VITE_` to be exposed to the browser by Vite.

On Vercel, set these under **Project Settings → Environment Variables**.

---

## 12. Pi / Backend Side Notes

The Pi side is a separate codebase not in this repo. Here is what it must implement to match the frontend contract:

### What the Pi must write

| Path | When | Shape |
|------|------|-------|
| `/readings/{pushKey}` | Each sensor cycle | `{timestamp, ph, temperature, tds, turbidity, lat, lon, waypoint_seq?}` |
| `/telemetry/usv-01/current` | Continuously (from MAVLink) | `{lat, lon, alt, heading, groundspeed, timestamp}` |
| `/missions/{key}/status` | After evaluating a pending mission | `"accepted"` or `"rejected"` |

### What the Pi must read

| Path | When | Action |
|------|------|--------|
| `/missions` | Continuously (onValue or polling) | Pick up any child where `status === "pending"`, execute, then write status |
| `/config/usv-01/sensorInterval` | Each cycle | Adjust sleep duration accordingly |

### Sensor hardware (documented in SystemSettings Info tab)

- **pH:** Atlas Scientific EZO-pH
- **Temperature:** DS18B20 Waterproof
- **TDS:** Gravity Analog TDS Sensor
- **Turbidity:** DFRobot SEN0189

### Communication (documented in SystemSettings Info tab)

- Protocol: MQTT over 4G LTE (note: the GUI uses Firebase, not MQTT directly — this may be a legacy label)
- MAVLink serial connection to Pixhawk

---

## 13. Known Limitations & TODOs

| Area | Issue | Notes |
|------|-------|-------|
| Battery Level | Hardcoded to 85% in `App.tsx` | Needs to be wired to real telemetry from Pixhawk (via `BATTERY_STATUS` MAVLink message) |
| Data Export | Only exports last 20 in-memory readings | Should query Firebase with a larger `limitToLast` or date range for full export |
| Mission Log | In-memory only — lost on page refresh | Could be persisted to Firebase or localStorage |
| Trail | Max 300 points hardcoded | Consider making configurable or persisting across sessions |
| `WaterQualityStatus` component | Imported but not rendered | Either add it back to the layout or remove the import |
| Security Rules | Anonymous auth is used | Firebase Security Rules need to be configured to gate write access appropriately |
| `DEVICE_ID` | Hardcoded as `"usv-01"` | Should be configurable for multi-USV deployments |
| Pi telemetry | Only reads `GLOBAL_POSITION_INT` / `VFR_HUD` | No mission progress feedback (current waypoint index) is sent back to the frontend |
| Offline mode | No offline handling | If Firebase is unreachable, the UI shows stale data with no warning |
| Alert persistence | Alerts reset on page reload | Toast history and alert state are not persisted |
| Leaflet dark mode | Map tiles don't adapt to dark mode | Could use dark-styled tiles (e.g. Stadia Dark) in dark mode |

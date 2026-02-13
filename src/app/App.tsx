import { useState, useEffect } from "react";
import { Droplets, Thermometer, Gauge, Waves } from "lucide-react";
import { Header } from "./components/Header";
import { SensorCard } from "./components/SensorCard";
import { WaterQualityStatus } from "./components/WaterQualityStatus";
import { MapView } from "./components/MapView";
import { SystemSettings } from "./components/SystemSettings";
import { CombinedScientificData } from "./components/CombinedScientificData";
import { AlertsThresholds } from "./components/AlertsThresholds";
import { DataExport } from "./components/DataExport";
import { MissionLog, MissionLogEntry } from "./components/MissionLog";
import { USVHealthStrip } from "./components/USVHealthStrip";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/ThemeProvider";
import { Mission, createEmptyMission, addWaypointToMission } from "../types/mission";
import { VehiclePosition } from "../types/bridge";
import { database } from "../services/firebase";
import { ref, onValue, query, limitToLast, push, set } from "firebase/database";


interface SensorData {
  ph: number;
  temperature: number;
  tds: number;
  turbidity: number;
}

interface ChartDataPoint {
  timestamp: string;
  ph: number;
  temperature: number;
  turbidity: number;
  tds: number;
}

// Device ID must match the Pi's DEVICE_ID
const DEVICE_ID = "usv-01";

// Calculate water quality status based on sensor readings
function calculateWaterQuality(data: SensorData): "good" | "moderate" | "poor" {
  let score = 0;

  // pH should be between 6.5 and 8.5
  if (data.ph >= 6.5 && data.ph <= 8.5) score++;
  else if (data.ph >= 6.0 && data.ph <= 9.0) score += 0.5;

  // Temperature should be between 20-28°C
  if (data.temperature >= 20 && data.temperature <= 28) score++;
  else if (data.temperature >= 15 && data.temperature <= 32) score += 0.5;

  // TDS should be less than 500 ppm
  if (data.tds < 500) score++;
  else if (data.tds < 600) score += 0.5;

  // Turbidity should be less than 5 NTU
  if (data.turbidity < 5) score++;
  else if (data.turbidity < 10) score += 0.5;

  if (score >= 3.5) return "good";
  if (score >= 2) return "moderate";
  return "poor";
}

export default function App() {
  // Connection and GPS state
  const [isOnline, setIsOnline] = useState(false);
  const [hasGpsFix, setHasGpsFix] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Sensor data
  const [sensorData, setSensorData] = useState<SensorData>({ ph: 0, temperature: 0, tds: 0, turbidity: 0 });
  const [waterQuality, setWaterQuality] = useState<"good" | "moderate" | "poor">("good");

  // Vehicle telemetry (from bridge)
  const [vehiclePosition, setVehiclePosition] = useState<VehiclePosition | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);

  // Mission planning
  const [mission, setMission] = useState<Mission>(createEmptyMission());
  const [addWaypointMode, setAddWaypointMode] = useState(false);

  // Expose mission in dev mode for debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).currentMission = mission;
      (window as any).vehiclePosition = vehiclePosition;
    }
  }, [mission, vehiclePosition]);

  // Chart data
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // System settings
  const [sensorInterval, setSensorInterval] = useState(2); // in seconds

  // Mission log
  const [missionLog, setMissionLog] = useState<MissionLogEntry[]>([]);

  // Battery level (simulated)
  const [batteryLevel, setBatteryLevel] = useState(85);

  // Derive sampling mode from sensor interval
  const getSamplingMode = () => {
    if (sensorInterval <= 60) return 'Survey Mode';
    if (sensorInterval <= 900) return 'Routine Monitoring';
    return 'Low-Power / Standby';
  };

  // =============================================
  // FIREBASE: Listen to real sensor data from Pi
  // =============================================
  useEffect(() => {
    console.log("Firebase DB object:", database);
    console.log("Connecting to /readings...");

    // Check Firebase connection state
    const connRef = ref(database, ".info/connected");
    onValue(connRef, (snap) => {
      console.log("Connected to Firebase:", snap.val());
    });

    const readingsQuery = query(ref(database, "readings"), limitToLast(20));
    const unsubscribe = onValue(
      readingsQuery,
      (snapshot) => {
        const data = snapshot.val();
        console.log("Firebase snapshot received:", data);
        if (!data) {
          console.log("No data at /readings");
          return;
        }

        const entries = Object.values(data) as any[];
        const latest = entries[entries.length - 1];

        // Update connection status — data is flowing
        setIsOnline(true);
        setLastUpdate(new Date(latest.timestamp || Date.now()));

        // Update sensor cards with latest reading
        const newSensorData: SensorData = {
          ph: latest.ph ?? 0,
          temperature: latest.temperature ?? 0,
          tds: latest.tds ?? 0,
          turbidity: latest.turbidity ?? 0,
        };
        setSensorData(newSensorData);
        setWaterQuality(calculateWaterQuality(newSensorData));

        // Check GPS
        if (latest.lat && latest.lon && (latest.lat !== 0 || latest.lon !== 0)) {
          setHasGpsFix(true);
        }

        // Update chart data from all entries
        setChartData(
          entries.map((e: any) => ({
            timestamp: new Date(e.timestamp || Date.now()).toLocaleTimeString(
              "en-US",
              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
            ),
            ph: e.ph ?? 0,
            temperature: e.temperature ?? 0,
            turbidity: e.turbidity ?? 0,
            tds: e.tds ?? 0,
          }))
        );
      },
      (error) => {
        console.error("Firebase READ ERROR:", error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  // =============================================
  // FIREBASE: Listen to vehicle position (future: Pixhawk GPS)
  // =============================================
  useEffect(() => {
    const posRef = ref(database, `telemetry/${DEVICE_ID}/current`);
    const unsubscribe = onValue(posRef, (snapshot) => {
      const pos = snapshot.val();
      if (!pos) return;

      const vehiclePos: VehiclePosition = {
        lat: pos.lat,
        lon: pos.lon,
        alt: pos.alt ?? 0,
        heading: pos.heading ?? 0,
        groundspeed: pos.groundspeed ?? 0,
        timestamp: pos.timestamp ?? new Date().toISOString(),
      };

      setVehiclePosition(vehiclePos);
      setTrail((prevTrail) => {
        const newTrail = [
          ...prevTrail,
          [vehiclePos.lat, vehiclePos.lon] as [number, number],
        ];
        return newTrail.slice(-300);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleAddWaypoint = (position: [number, number]) => {
    setMission(prev => addWaypointToMission(prev, position[0], position[1]));
    setAddWaypointMode(false);
    toast.success(`Waypoint ${mission.waypoints.length + 1} added`);
  };

  const handleClearWaypoints = () => {
    setMission(createEmptyMission());
    toast.info("Waypoints cleared");
  };

  const handleSendWaypoints = () => {
    if (mission.waypoints.length > 0) {
      // Push mission to Firebase for the Pi to pick up
      const missionRef = push(ref(database, "missions"));
      set(missionRef, {
        waypoints: mission.waypoints.map((wp) => ({
          lat: wp.x,
          lon: wp.y,
          seq: wp.seq,
        })),
        status: "pending",
        created_at: new Date().toISOString(),
      });

      // Create mission log entry
      const missionEntry: MissionLogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        mission: mission,
        waypointCount: mission.waypoints.length,
        status: "Pending",
        message: `Mission uploaded to Firebase. Waiting for USV acknowledgement (${mission.waypoints.length} waypoint${mission.waypoints.length !== 1 ? 's' : ''}).`,
      };

      setMissionLog(prev => [missionEntry, ...prev]);

      toast.success(`${mission.waypoints.length} waypoints sent to Firebase for USV`);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Toaster position="top-right" />

        <Header
          isOnline={isOnline}
          hasGpsFix={hasGpsFix}
          lastUpdate={lastUpdate}
        />

        <USVHealthStrip
          connectionStatus={isOnline ? 'online' : 'offline'}
          lastTelemetryTimestamp={lastUpdate}
          batteryLevel={batteryLevel}
          samplingMode={getSamplingMode()}
        />

        <main className="flex-1 p-6">
          {/* Main Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6" style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
            {/* Left Panel - Map */}
            <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <MapView
                vehiclePosition={vehiclePosition}
                trail={trail}
                mission={mission}
                onAddWaypoint={handleAddWaypoint}
                onClearWaypoints={handleClearWaypoints}
                onSendWaypoints={handleSendWaypoints}
                addWaypointMode={addWaypointMode}
                setAddWaypointMode={setAddWaypointMode}
              />
            </div>

            {/* Right Panel - Telemetry */}
            <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2">
              <div>
                <h2 className="text-lg mb-3 text-gray-700 dark:text-gray-200">Live Sensor Data</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SensorCard
                    title="pH Level"
                    value={sensorData.ph}
                    unit="pH"
                    icon={<Droplets className="size-5 text-white" />}
                    timestamp={lastUpdate.toLocaleTimeString('en-US')}
                  />
                  <SensorCard
                    title="Temperature"
                    value={sensorData.temperature}
                    unit="°C"
                    icon={<Thermometer className="size-5 text-white" />}
                    timestamp={lastUpdate.toLocaleTimeString('en-US')}
                  />
                  <SensorCard
                    title="TDS"
                    value={sensorData.tds}
                    unit="ppm"
                    icon={<Gauge className="size-5 text-white" />}
                    timestamp={lastUpdate.toLocaleTimeString('en-US')}
                  />
                  <SensorCard
                    title="Turbidity"
                    value={sensorData.turbidity}
                    unit="NTU"
                    icon={<Waves className="size-5 text-white" />}
                    timestamp={lastUpdate.toLocaleTimeString('en-US')}
                  />
                </div>
              </div>

              <div>
                <WaterQualityStatus status={waterQuality} />
              </div>

            </div>
          </div>

          {/* Combined Scientific Data */}
          <div className="mt-6">
            <CombinedScientificData data={chartData} currentData={sensorData} />
          </div>

          {/* Alerts Thresholds */}
          <div className="mt-6">
            <AlertsThresholds sensorData={sensorData} />
          </div>

          {/* Data Export */}
          <div className="mt-6">
            <DataExport data={chartData} />
          </div>

          {/* System Settings */}
          <div className="mt-6">
            <SystemSettings
              sensorInterval={sensorInterval}
              onIntervalChange={setSensorInterval}
            />
          </div>

          {/* Mission Log */}
          <div className="mt-6">
            <MissionLog missions={missionLog} />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 dark:bg-gray-950 text-gray-300 py-4 px-6">
          <div className="flex items-center justify-center text-sm">
            <div>Made with rrk</div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
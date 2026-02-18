import { useState } from "react";
import { Settings, Gauge, Info, AlertTriangle, ChevronDown, Zap, Radio } from "lucide-react";

interface SystemSettingsProps {
  sensorInterval: number;
  onIntervalChange: (seconds: number) => void;
}

interface SamplingMode {
  id: string;
  name: string;
  interval: number;
  intervalLabel: string;
  power: 'High' | 'Medium' | 'Low' | 'Minimal';
  powerLevel: number;
  useCase: string;
  safetyNote?: string;
  dataRate: string;
  maxDuration: string;
  context: string;
}

export function SystemSettings({ sensorInterval, onIntervalChange }: SystemSettingsProps) {
  const [activeTab, setActiveTab] = useState<"sensors" | "info">("sensors");
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const samplingModes: SamplingMode[] = [
    {
      id: 'survey',
      name: 'Survey Mode',
      interval: 30,
      intervalLabel: '30-60 s',
      power: 'Medium',
      powerLevel: 3,
      useCase: 'Spatial mapping and transects',
      dataRate: '120 readings/hour',
      maxDuration: '4-6 hours',
      context: 'Standard operation'
    },
    {
      id: 'routine',
      name: 'Routine Monitoring',
      interval: 300,
      intervalLabel: '5-15 min',
      power: 'Low',
      powerLevel: 2,
      useCase: 'Baseline water quality tracking',
      dataRate: '12 readings/hour',
      maxDuration: '12-24 hours',
      context: 'All conditions'
    },
    {
      id: 'standby',
      name: 'Low-Power / Standby',
      interval: 1800,
      intervalLabel: '30-60 min',
      power: 'Minimal',
      powerLevel: 1,
      useCase: 'Loitering and battery conservation',
      safetyNote: 'Limited data resolution',
      dataRate: '2 readings/hour',
      maxDuration: '48+ hours',
      context: 'Extended deployment'
    },
  ];

  const customIntervals = [
    { label: '5 s', value: 5 },
    { label: '10 s', value: 10 },
    { label: '30 s', value: 30 },
    { label: '1 min', value: 60 },
    { label: '5 min', value: 300 },
    { label: '15 min', value: 900 },
    { label: '30 min', value: 1800 },
    { label: '1 hour', value: 3600 },
    { label: '5 hours', value: 18000 },
  ];

  // Find current mode or custom
  const currentMode = samplingModes.find(m => m.interval === sensorInterval);
  const isCustom = !currentMode;

  const getCurrentModeData = (): SamplingMode => {
    if (currentMode) return currentMode;

    // Custom interval - estimate impact
    const powerLevel = sensorInterval <= 10 ? 4 : sensorInterval <= 60 ? 3 : sensorInterval <= 600 ? 2 : 1;
    const readingsPerHour = Math.round(3600 / sensorInterval);
    return {
      id: 'custom',
      name: 'Custom Interval',
      interval: sensorInterval,
      intervalLabel: formatInterval(sensorInterval),
      power: powerLevel === 4 ? 'High' : powerLevel === 3 ? 'Medium' : powerLevel === 2 ? 'Low' : 'Minimal',
      powerLevel,
      useCase: 'Custom configuration',
      dataRate: `${readingsPerHour} readings/hour`,
      maxDuration: 'Variable',
      context: 'Custom'
    };
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) return `${seconds} s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    return `${Math.floor(seconds / 3600)} hr`;
  };

  const getPowerColor = (power: string) => {
    switch (power) {
      case 'High': return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800';
      case 'Medium': return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-800';
      case 'Low': return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800';
      case 'Minimal': return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600';
      default: return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600';
    }
  };

  const activeModeData = getCurrentModeData();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="size-5 text-gray-700 dark:text-gray-300" />
        <h2 className="text-lg text-gray-900 dark:text-gray-100">System Settings</h2>
      </div>

      {/* Tabs */}
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("sensors")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${activeTab === "sensors"
            ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
        >
          <Gauge className="size-4" />
          <span>Sensors</span>
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${activeTab === "info"
            ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
        >
          <Info className="size-4" />
          <span>Info</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === "sensors" ? (
        <div>
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 uppercase tracking-wide">Sensor Sampling</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select operational mode for water quality sensor sampling
            </p>
          </div>

          {/* Sampling Mode Selector */}
          <div className="space-y-3 mb-6">
            {samplingModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onIntervalChange(mode.interval)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${sensorInterval === mode.interval && !isCustom
                  ? "border-blue-500 bg-blue-900/20 dark:bg-blue-900/30"
                  : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio
                      className={`size-4 ${sensorInterval === mode.interval && !isCustom
                        ? "text-blue-500"
                        : "text-gray-400"
                        }`}
                    />
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{mode.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${getPowerColor(mode.power)}`}>
                    {mode.power}
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">{mode.intervalLabel}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{mode.useCase}</div>
                  {mode.safetyNote && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-2">
                      <AlertTriangle className="size-3" />
                      <span>{mode.safetyNote}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Estimated Impact Panel */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 p-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wide">Estimated Impact</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Power Draw:</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-4 rounded-sm ${level <= activeModeData.powerLevel
                          ? activeModeData.powerLevel >= 4
                            ? "bg-red-500"
                            : activeModeData.powerLevel >= 3
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          : "bg-gray-300 dark:bg-gray-700"
                          }`}
                      />
                    ))}
                  </div>
                  <span className={`text-sm font-mono ${getPowerColor(activeModeData.power).split(' ')[0]}`}>
                    {activeModeData.power}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Data Rate:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{activeModeData.dataRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Max Duration:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{activeModeData.maxDuration}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Mission Context:</span>
                <span className="text-sm text-green-600 dark:text-green-400">✓ {activeModeData.context}</span>
              </div>
            </div>
          </div>

          {/* Advanced Settings - Collapsible */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={() => setAdvancedExpanded(!advancedExpanded)}
              className="w-full flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <span className="font-semibold">Advanced Settings</span>
              <ChevronDown className={`size-4 transition-transform ${advancedExpanded ? 'rotate-180' : ''}`} />
            </button>
            {advancedExpanded && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Custom intervals bypass operational safeguards
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Custom Interval
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => { setUseCustomInput(false); }}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${!useCustomInput
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                  >
                    Presets
                  </button>
                  <button
                    onClick={() => { setUseCustomInput(true); setCustomValue(String(sensorInterval)); }}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${useCustomInput
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                  >
                    Type Custom
                  </button>
                </div>
                {!useCustomInput ? (
                  <select
                    value={sensorInterval}
                    onChange={(e) => onIntervalChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {customIntervals.map((interval) => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(customValue);
                          if (!isNaN(val) && val >= 1) onIntervalChange(val);
                        }
                      }}
                      placeholder="Seconds"
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(customValue);
                        if (!isNaN(val) && val >= 1) onIntervalChange(val);
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
                    >
                      Set
                    </button>
                  </div>
                )}
                {useCustomInput && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter interval in seconds (e.g. 3600 = 1 hour)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm mb-2 text-gray-900 dark:text-gray-100">System Information</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Vehicle:</span>
                  <span className="text-gray-900 dark:text-gray-100">Autonomous USV-1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Navigation:</span>
                  <span className="text-gray-900 dark:text-gray-100">Pixhawk Autopilot</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Telemetry:</span>
                  <span className="text-gray-900 dark:text-gray-100">MQTT → REST API</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Firmware:</span>
                  <span className="text-gray-900 dark:text-gray-100">v2.4.1</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm mb-2 text-gray-900 dark:text-gray-100">Sensor Details</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">pH Sensor:</span>
                  <span className="text-gray-900 dark:text-gray-100">Atlas Scientific EZO-pH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                  <span className="text-gray-900 dark:text-gray-100">DS18B20 Waterproof</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">TDS Sensor:</span>
                  <span className="text-gray-900 dark:text-gray-100">Gravity Analog TDS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Turbidity:</span>
                  <span className="text-gray-900 dark:text-gray-100">DFRobot SEN0189</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm mb-2 text-gray-900 dark:text-gray-100">Communication</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Protocol:</span>
                  <span className="text-gray-900 dark:text-gray-100">MQTT over 4G LTE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Broker:</span>
                  <span className="text-gray-900 dark:text-gray-100">mosquitto.local:1883</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">API Endpoint:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">api.usv.local/v1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

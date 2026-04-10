import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  Area
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, GitBranch, Target, MapPin } from "lucide-react";

interface ChartData {
  timestamp: string;
  ph: number;
  temperature: number;
  turbidity: number;
  tds: number;
  waypoint_seq?: number;
}

interface CombinedScientificDataProps {
  data: ChartData[];
  currentData: {
    ph: number;
    temperature: number;
    turbidity: number;
    tds: number;
  };
}

// Parameter configuration
const paramConfig = {
  ph: { min: 6.5, max: 8.5, unit: 'pH', name: 'pH Level' },
  temperature: { min: 15, max: 30, unit: '°C', name: 'Temperature' },
  turbidity: { min: 0, max: 5, unit: 'NTU', name: 'Turbidity' },
  tds: { min: 0, max: 500, unit: 'ppm', name: 'TDS' }
};

type ParamKey = keyof typeof paramConfig;

export function CombinedScientificData({ data, currentData }: CombinedScientificDataProps) {
  const [activeTab, setActiveTab] = useState<'temporal' | 'relationship' | 'deviation' | 'waypoints'>('temporal');
  const [analysisWindow, setAnalysisWindow] = useState<'live' | 'shortterm' | 'mission'>('live');
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | 'all'>('all');
  const [selectedParam, setSelectedParam] = useState<ParamKey>('ph');
  const [xAxis, setXAxis] = useState<ParamKey>('temperature');
  const [yAxis, setYAxis] = useState<ParamKey>('ph');
  const [timeWindow, setTimeWindow] = useState<'10min' | '30min' | 'mission'>('mission');

  // Extract unique waypoints from data for the dropdown
  const uniqueWaypoints = useMemo(() => {
    const wps = new Set<number>();
    data.forEach(d => {
      if (d.waypoint_seq !== undefined && d.waypoint_seq >= 0) {
        wps.add(d.waypoint_seq);
      }
    });
    return Array.from(wps).sort((a, b) => a - b);
  }, [data]);

  // Filter data based on analysis window AND selected waypoint
  const filteredData = useMemo(() => {
    let baseData = data;
    if (analysisWindow === 'live') baseData = data.slice(-15);
    else if (analysisWindow === 'shortterm') baseData = data.slice(-30);
    
    if (selectedWaypoint === 'all') return baseData;
    return baseData.filter(d => d.waypoint_seq === selectedWaypoint);
  }, [data, analysisWindow, selectedWaypoint]);

  // Calculate rolling mean
  const calculateRollingMean = (dataPoints: number[], window: number = 5): number[] => {
    const result: number[] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = dataPoints.slice(start, i + 1);
      const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
      result.push(mean);
    }
    return result;
  };

  // Calculate rate of change (slope)
  const calculateRateOfChange = (dataPoints: number[]): number => {
    if (dataPoints.length < 2) return 0;
    const recent = dataPoints.slice(-10);
    const n = recent.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((a, b) => a + b) / n;
    const yMean = recent.reduce((a, b) => a + b) / n;

    const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (recent[i] - yMean), 0);
    const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

    return denominator !== 0 ? numerator / denominator : 0;
  };

  // Detect anomalies (values beyond 2 standard deviations)
  const detectAnomalies = (dataPoints: number[]): boolean[] => {
    const mean = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    const variance = dataPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataPoints.length;
    const stdDev = Math.sqrt(variance);
    return dataPoints.map(val => Math.abs(val - mean) > 2 * stdDev);
  };

  // Calculate Pearson correlation
  const calculateCorrelation = (xData: number[], yData: number[]): number => {
    const n = Math.min(xData.length, yData.length);
    if (n < 2) return 0;

    const xMean = xData.reduce((a, b) => a + b) / n;
    const yMean = yData.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xData[i] - xMean;
      const yDiff = yData[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator !== 0 ? numerator / denominator : 0;
  };

  // Normalize to percentage of acceptable range
  const normalizeToRange = (value: number, param: ParamKey): number => {
    const { min, max } = paramConfig[param];
    return ((value - min) / (max - min)) * 100;
  };

  // Classify stability
  const classifyStability = (rateOfChange: number, currentValue: number, param: ParamKey): {
    status: 'Stable' | 'Watch' | 'Alert';
    color: string;
  } => {
    const { min, max } = paramConfig[param];
    const withinBand = currentValue >= min && currentValue <= max;
    const absRate = Math.abs(rateOfChange);

    if (!withinBand || absRate > 0.5) {
      return { status: 'Alert', color: 'text-red-400' };
    } else if (absRate > 0.2 || (currentValue < min * 1.1 || currentValue > max * 0.9)) {
      return { status: 'Watch', color: 'text-yellow-400' };
    }
    return { status: 'Stable', color: 'text-green-400' };
  };

  // Generate interpretation for correlation
  const generateInterpretation = (param1: ParamKey, param2: ParamKey, r: number): string => {
    const absR = Math.abs(r);
    const strength = absR >= 0.7 ? 'Strong' : absR >= 0.3 ? 'Moderate' : 'Weak';
    const direction = r > 0 ? 'positive' : 'negative';

    const templates: Record<string, string> = {
      'temperature-ph': 'Temperature affects pH sensor calibration and biological activity.',
      'temperature-turbidity': 'Thermal stratification can influence particle suspension.',
      'turbidity-tds': 'Suspended particles directly contribute to dissolved solids.',
    };

    const key = `${param1}-${param2}`;
    const reverseKey = `${param2}-${param1}`;
    const cause = templates[key] || templates[reverseKey] || 'Environmental coupling between parameters.';

    return `${strength} ${direction} correlation (r=${r.toFixed(2)}) detected between ${paramConfig[param1].name} and ${paramConfig[param2].name}. ${cause}`;
  };

  // Prepare temporal diagnostics data
  const temporalData = useMemo(() => {
    const paramData = filteredData.map(d => d[selectedParam]);
    const rollingMean = calculateRollingMean(paramData);
    const anomalies = detectAnomalies(paramData);

    return filteredData.map((d, i) => ({
      timestamp: d.timestamp,
      value: d[selectedParam],
      mean: rollingMean[i],
      isAnomaly: anomalies[i]
    }));
  }, [filteredData, selectedParam]);

  // Calculate change summaries for all parameters
  const changeSummaries = useMemo(() => {
    const params: ParamKey[] = ['ph', 'temperature', 'turbidity', 'tds'];
    return params.map(param => {
      const paramData = filteredData.map(d => d[param]);
      const rateOfChange = calculateRateOfChange(paramData);
      const current = currentData[param];
      const stability = classifyStability(rateOfChange, current, param);

      return {
        param,
        name: paramConfig[param].name,
        unit: paramConfig[param].unit,
        direction: rateOfChange > 0.05 ? 'Rising' : rateOfChange < -0.05 ? 'Falling' : 'Stable',
        rate: rateOfChange,
        ...stability
      };
    });
  }, [filteredData, currentData]);

  // Prepare relationship data
  const relationshipData = useMemo(() => {
    const windowData = timeWindow === '10min' ? filteredData.slice(-10) :
      timeWindow === '30min' ? filteredData.slice(-30) :
        filteredData;

    return windowData.map(d => ({
      x: d[xAxis],
      y: d[yAxis],
      timestamp: d.timestamp
    }));
  }, [filteredData, xAxis, yAxis, timeWindow]);

  const correlation = useMemo(() => {
    const xData = relationshipData.map(d => d.x);
    const yData = relationshipData.map(d => d.y);
    return calculateCorrelation(xData, yData);
  }, [relationshipData]);

  // Prepare deviation data
  const deviationData = useMemo(() => {
    const params: ParamKey[] = ['ph', 'temperature', 'turbidity', 'tds'];
    return params.map(param => {
      const current = normalizeToRange(currentData[param], param);
      const baseline = 50; // Could calculate from mission average
      const threshold = 100;

      return {
        param: paramConfig[param].name,
        current,
        baseline,
        threshold,
        value: currentData[param],
        unit: paramConfig[param].unit,
        rawValue: currentData[param]
      };
    });
  }, [currentData]);

  // Priority cards
  const priorityItems = useMemo(() => {
    return deviationData
      .map(d => ({
        ...d,
        priority: d.current > 100 ? 'critical' : d.current > 90 ? 'caution' : d.current > 70 ? 'watch' : 'normal'
      }))
      .filter(d => d.priority !== 'normal')
      .sort((a, b) => b.current - a.current)
      .slice(0, 3);
  }, [deviationData]);

  const getBarColor = (value: number): string => {
    if (value > 100) return '#EF4444'; // red
    if (value > 90) return '#F97316'; // orange
    if (value > 70) return '#EAB308'; // yellow
    return '#22C55E'; // green
  };

  // Calculate Waypoint Analytics
  const waypointAnalytics = useMemo(() => {
    if (uniqueWaypoints.length === 0) return [];
    
    return uniqueWaypoints.map(wpSeq => {
      const wpData = data.filter(d => d.waypoint_seq === wpSeq);
      if (wpData.length === 0) return null;
      
      const stats = {
        seq: wpSeq,
        samples: wpData.length,
        timestamp: wpData[0].timestamp,
        ph: { avg: 0, min: Infinity, max: -Infinity },
        temperature: { avg: 0, min: Infinity, max: -Infinity },
        turbidity: { avg: 0, min: Infinity, max: -Infinity },
        tds: { avg: 0, min: Infinity, max: -Infinity }
      };

      const params: ParamKey[] = ['ph', 'temperature', 'turbidity', 'tds'];
      
      wpData.forEach(d => {
        params.forEach(p => {
          stats[p].avg += d[p];
          if (d[p] < stats[p].min) stats[p].min = d[p];
          if (d[p] > stats[p].max) stats[p].max = d[p];
        });
      });

      params.forEach(p => {
        stats[p].avg /= wpData.length;
      });

      return stats;
    }).filter(Boolean);
  }, [data, uniqueWaypoints]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg text-gray-900 dark:text-gray-100 font-semibold">Scientific Analysis</h2>

        <div className="flex items-center gap-4">
          {/* Waypoint Filter */}
          {uniqueWaypoints.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Waypoint:</span>
              <select
                value={selectedWaypoint}
                onChange={(e) => setSelectedWaypoint(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Waypoints</option>
                {uniqueWaypoints.map(wp => (
                  <option key={wp} value={wp}>Waypoint {wp + 1}</option>
                ))}
              </select>
            </div>
          )}

          {/* Analysis Window Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Analysis Window:</span>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['live', 'shortterm', 'mission'] as const).map((window) => (
                <button
                  key={window}
                  onClick={() => setAnalysisWindow(window)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${analysisWindow === window
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                  {window === 'live' ? 'Live' : window === 'shortterm' ? 'Short-term' : 'Mission'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('temporal')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'temporal'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
          >
            <Activity className="size-4" />
            <div className="text-left">
              <div>Temporal Diagnostics</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-500">Are conditions changing?</div>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('relationship')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'relationship'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
          >
            <GitBranch className="size-4" />
            <div className="text-left">
              <div>Relationship Analysis</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-500">How do parameters interact?</div>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('deviation')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'deviation'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
          >
            <Target className="size-4" />
            <div className="text-left">
              <div>State Deviation</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-500">How far from limits?</div>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('waypoints')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'waypoints'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
          >
            <MapPin className="size-4" />
            <div className="text-left">
              <div>Waypoint Analytics</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-500">Spatial comparison</div>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'temporal' && (
        <div>
          {/* Parameter Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select Parameter
            </label>
            <select
              value={selectedParam}
              onChange={(e) => setSelectedParam(e.target.value as ParamKey)}
              className="w-full max-w-xs px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
            >
              {Object.entries(paramConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>
          </div>

          {/* Chart */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={temporalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: paramConfig[selectedParam].unit, angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#D1D5DB' }}
                  itemStyle={{ color: '#D1D5DB' }}
                />
                <Legend wrapperStyle={{ color: '#D1D5DB' }} />

                {/* Normal operating band */}
                <ReferenceArea
                  y1={paramConfig[selectedParam].min}
                  y2={paramConfig[selectedParam].max}
                  fill="#22C55E"
                  fillOpacity={0.1}
                  stroke="#22C55E"
                  strokeDasharray="3 3"
                />

                {/* Raw signal */}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#60A5FA"
                  strokeWidth={1}
                  opacity={0.5}
                  name="Raw Signal"
                  dot={false}
                />

                {/* Rolling mean */}
                <Line
                  type="monotone"
                  dataKey="mean"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Rolling Mean"
                  dot={false}
                />

                {/* Anomaly markers */}
                <Scatter
                  dataKey={(entry: any) => entry.isAnomaly ? entry.value : null}
                  fill="#EF4444"
                  shape="circle"
                  name="Anomalies"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Change Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            {changeSummaries.map((summary) => (
              <div
                key={summary.param}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {summary.name}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Direction:</span>
                    <div className="flex items-center gap-1">
                      {summary.direction === 'Rising' && <TrendingUp className="size-4 text-red-400" />}
                      {summary.direction === 'Falling' && <TrendingDown className="size-4 text-blue-400" />}
                      {summary.direction === 'Stable' && <Minus className="size-4 text-gray-400" />}
                      <span className="text-gray-900 dark:text-gray-100">{summary.direction}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rate:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">
                      {summary.rate > 0 ? '+' : ''}{summary.rate.toFixed(3)} {summary.unit}/hr
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${summary.color}`}>
                      {summary.status === 'Alert' && '🔴 '}
                      {summary.status === 'Watch' && '🟡 '}
                      {summary.status === 'Stable' && '🟢 '}
                      {summary.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'relationship' && (
        <div>
          {/* Axis Selectors */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                X-Axis
              </label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value as ParamKey)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
              >
                {Object.entries(paramConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Y-Axis
              </label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value as ParamKey)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
              >
                {Object.entries(paramConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Time Window
              </label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as '10min' | '30min' | 'mission')}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
              >
                <option value="10min">10 min</option>
                <option value="30min">30 min</option>
                <option value="mission">Mission</option>
              </select>
            </div>
          </div>

          {/* Correlation Display */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Pearson Correlation Coefficient:</span>
              <span className="text-lg font-mono text-blue-400 font-semibold">
                r = {correlation.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  dataKey="x"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: `${paramConfig[xAxis].name} (${paramConfig[xAxis].unit})`, position: 'bottom', fill: '#9CA3AF' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: `${paramConfig[yAxis].name} (${paramConfig[yAxis].unit})`, angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#D1D5DB' }}
                  itemStyle={{ color: '#D1D5DB' }}
                  cursor={{ strokeDasharray: '3 3' }}
                />
                <Scatter
                  data={relationshipData}
                  fill="#3B82F6"
                  opacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Interpretation */}
          <div className="bg-gray-900 dark:bg-gray-950 border border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-100 mb-2 uppercase tracking-wide">Interpretation</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              {generateInterpretation(xAxis, yAxis, correlation)}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'deviation' && (
        <div>
          {/* Chart */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deviationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: '% of Acceptable Range', position: 'bottom', fill: '#9CA3AF' }}
                  domain={[0, 120]}
                />
                <YAxis
                  type="category"
                  dataKey="param"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#D1D5DB' }}
                  itemStyle={{ color: '#D1D5DB' }}
                  formatter={(value: any, name: any, props: any) => [
                    `${value.toFixed(1)}% (${props.payload.rawValue.toFixed(2)} ${props.payload.unit})`,
                    'Current'
                  ]}
                />
                <ReferenceLine x={100} stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" />
                <Bar dataKey="current" radius={[0, 4, 4, 0]}>
                  {deviationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.current)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Priority Cards */}
          {priorityItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Priority Attention
              </h4>
              {priorityItems.map((item) => (
                <div
                  key={item.param}
                  className={`p-4 rounded-lg border-l-4 ${item.priority === 'critical'
                      ? 'bg-red-900/20 border-red-500'
                      : item.priority === 'caution'
                        ? 'bg-orange-900/20 border-orange-500'
                        : 'bg-yellow-900/20 border-yellow-500'
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`size-5 mt-0.5 ${item.priority === 'critical' ? 'text-red-400' :
                        item.priority === 'caution' ? 'text-orange-400' :
                          'text-yellow-400'
                      }`} />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-100 mb-1">
                        {item.priority === 'critical' && '🔴 CRITICAL: '}
                        {item.priority === 'caution' && '🟠 CAUTION: '}
                        {item.priority === 'watch' && '🟡 WATCH: '}
                        {item.param} at {item.current.toFixed(0)}% of limit
                      </div>
                      <div className="text-sm text-gray-300">
                        Current: {item.value.toFixed(2)} {item.unit} | Limit: {paramConfig[Object.keys(paramConfig).find(k => paramConfig[k as ParamKey].name === item.param) as ParamKey].max} {item.unit}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {priorityItems.length === 0 && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center">
              <div className="text-green-400 font-medium">✓ All parameters within acceptable ranges</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'waypoints' && (
        <div className="overflow-x-auto">
          {uniqueWaypoints.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No waypoint data available yet. Start a mission to see spatial analysis.
            </div>
          ) : (
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-6 py-3">Waypoint</th>
                  <th scope="col" className="px-6 py-3">Samples</th>
                  <th scope="col" className="px-6 py-3">pH (Avg)</th>
                  <th scope="col" className="px-6 py-3">Temp (°C)</th>
                  <th scope="col" className="px-6 py-3">Turbidity (NTU)</th>
                  <th scope="col" className="px-6 py-3">TDS (ppm)</th>
                </tr>
              </thead>
              <tbody>
                {waypointAnalytics.map((wp: any) => (
                  <tr key={`wp-table-${wp.seq}`} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                        {wp.seq + 1}
                      </div>
                      WP {wp.seq + 1}
                    </th>
                    <td className="px-6 py-4">{wp.samples}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{wp.ph.avg.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Min: {wp.ph.min.toFixed(1)} Max: {wp.ph.max.toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{wp.temperature.avg.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">Min: {wp.temperature.min.toFixed(1)} Max: {wp.temperature.max.toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{wp.turbidity.avg.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">Min: {wp.turbidity.min.toFixed(1)} Max: {wp.turbidity.max.toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{wp.tds.avg.toFixed(0)}</div>
                      <div className="text-xs text-gray-500">Min: {wp.tds.min.toFixed(0)} Max: {wp.tds.max.toFixed(0)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
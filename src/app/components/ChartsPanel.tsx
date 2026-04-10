import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { useMemo } from "react";

interface ChartData {
  timestamp: string;
  ph: number;
  temperature: number;
  turbidity: number;
  tds: number;
  waypoint_seq?: number;
}

interface ChartsPanelProps {
  data: ChartData[];
}

export function ChartsPanel({ data }: ChartsPanelProps) {
  // Find the first timestamp for each unique waypoint_seq to draw a marker line
  const waypointStarts = useMemo(() => {
    const starts = [];
    let currentWp = -1;
    for (const d of data) {
      if (d.waypoint_seq !== undefined && d.waypoint_seq >= 0 && d.waypoint_seq !== currentWp) {
        starts.push({ seq: d.waypoint_seq, timestamp: d.timestamp });
        currentWp = d.waypoint_seq;
      }
    }
    return starts;
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm mb-4 text-gray-700">pH vs Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <YAxis 
              domain={[6, 9]}
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#374151' }}
              itemStyle={{ color: '#374151' }}
              formatter={(value: any, name: any, props: any) => {
                const wpLabel = props.payload.waypoint_seq !== undefined && props.payload.waypoint_seq >= 0 
                  ? ` (WP ${props.payload.waypoint_seq + 1})` 
                  : '';
                return [`${value}${wpLabel}`, name];
              }}
            />
            {waypointStarts.map((wp) => (
              <ReferenceLine
                key={`wp-ph-${wp.seq}`}
                x={wp.timestamp}
                stroke="#6b7280"
                strokeDasharray="3 3"
                label={{ value: `WP ${wp.seq + 1}`, position: 'insideTopLeft', fill: '#6b7280', fontSize: 10 }}
              />
            ))}
            <Line type="monotone" dataKey="ph" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm mb-4 text-gray-700">Temperature vs Time (°C)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <YAxis 
              domain={[15, 35]}
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#374151' }}
              itemStyle={{ color: '#374151' }}
              formatter={(value: any, name: any, props: any) => {
                const wpLabel = props.payload.waypoint_seq !== undefined && props.payload.waypoint_seq >= 0 
                  ? ` (WP ${props.payload.waypoint_seq + 1})` 
                  : '';
                return [`${value}${wpLabel}`, name];
              }}
            />
            {waypointStarts.map((wp) => (
              <ReferenceLine
                key={`wp-temp-${wp.seq}`}
                x={wp.timestamp}
                stroke="#6b7280"
                strokeDasharray="3 3"
                label={{ value: `WP ${wp.seq + 1}`, position: 'insideTopLeft', fill: '#6b7280', fontSize: 10 }}
              />
            ))}
            <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm mb-4 text-gray-700">Turbidity vs Time (NTU)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <YAxis 
              domain={[0, 20]}
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#374151' }}
              itemStyle={{ color: '#374151' }}
              formatter={(value: any, name: any, props: any) => {
                const wpLabel = props.payload.waypoint_seq !== undefined && props.payload.waypoint_seq >= 0 
                  ? ` (WP ${props.payload.waypoint_seq + 1})` 
                  : '';
                return [`${value}${wpLabel}`, name];
              }}
            />
            {waypointStarts.map((wp) => (
              <ReferenceLine
                key={`wp-turb-${wp.seq}`}
                x={wp.timestamp}
                stroke="#6b7280"
                strokeDasharray="3 3"
                label={{ value: `WP ${wp.seq + 1}`, position: 'insideTopLeft', fill: '#6b7280', fontSize: 10 }}
              />
            ))}
            <Line type="monotone" dataKey="turbidity" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

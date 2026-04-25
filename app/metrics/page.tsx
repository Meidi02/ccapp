"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DISPOSITION_LABELS, DISPOSITION_COLORS, type Disposition } from "@/lib/constants";

type MetricData = {
  name: string;
  value: number;
};

export default function MetricsPage() {
  const [data, setData] = useState<MetricData[]>([]);
  const [totalDials, setTotalDials] = useState(0);
  const [timeRange, setTimeRange] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedDispositions, setSelectedDispositions] = useState<Set<string>>(
    new Set(Object.keys(DISPOSITION_LABELS))
  );

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const activeProjectId = localStorage.getItem("activeProjectId");
      const params = new URLSearchParams();
      params.set("timeRange", timeRange);
      if (activeProjectId) params.set("projectId", activeProjectId);

      const res = await fetch(`/api/metrics?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.dispositions);
        setTotalDials(json.totalDials);
      }
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const handleProjectChange = () => fetchMetrics();
    window.addEventListener('projectChanged', handleProjectChange);
    return () => window.removeEventListener('projectChanged', handleProjectChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const toggleDisposition = (disp: string) => {
    const newSet = new Set(selectedDispositions);
    if (newSet.has(disp)) {
      newSet.delete(disp);
    } else {
      newSet.add(disp);
    }
    setSelectedDispositions(newSet);
  };

  // Filter data for the pie chart
  const chartData = data.filter((d) => selectedDispositions.has(d.name));

  // Compute stats
  const totalContacted = data
    .filter(d => !['NEW', 'CALLED_NO_ANSWER', 'WRONG_NUMBER', 'DO_NOT_CALL'].includes(d.name))
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalInterestedOrBooked = data
    .filter(d => ['INTERESTED', 'BOOKED'].includes(d.name))
    .reduce((acc, curr) => acc + curr.value, 0);

  const contactRate = totalDials > 0 ? Math.round((totalContacted / totalDials) * 100) : 0;
  const conversionRate = totalContacted > 0 ? Math.round((totalInterestedOrBooked / totalContacted) * 100) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto text-gray-100">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Metrics Dashboard</h1>
        
        <div className="flex items-center gap-2">
          <label className="text-gray-400 font-medium">Time Period:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-white outline-none focus:border-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center shadow-lg">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Dials</h3>
          <p className="text-4xl font-extrabold text-blue-500">{totalDials}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center shadow-lg">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Contact Rate</h3>
          <p className="text-4xl font-extrabold text-green-400">{contactRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Contacted / Dials</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center shadow-lg">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Conversion Rate</h3>
          <p className="text-4xl font-extrabold text-purple-400">{conversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Interested / Contacted</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg" style={{ height: "450px" }}>
          <h2 className="text-xl font-semibold mb-4 text-gray-200">Dispositions Breakdown</h2>
          {loading ? (
            <div className="flex h-full items-center justify-center text-gray-500">Loading chart...</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent = 0 }) => `${DISPOSITION_LABELS[name as Disposition] || name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => {
                    const colorMap: Record<string, string> = {
                      NEW: "#6b7280",
                      CALLED_NO_ANSWER: "#f59e0b",
                      LEFT_VOICEMAIL: "#8b5cf6",
                      CALLBACK_SCHEDULED: "#3b82f6",
                      BOOKED: "#10b981",
                      NOT_INTERESTED: "#ef4444",
                      WRONG_NUMBER: "#f43f5e",
                      DO_NOT_CALL: "#000000",
                    };
                    return <Cell key={`cell-${index}`} fill={colorMap[entry.name] || "#8884d8"} />;
                  })}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any) => [value, DISPOSITION_LABELS[name as Disposition] || name]}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Legend formatter={(value) => DISPOSITION_LABELS[value as Disposition] || value} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">No data available for the selected filters.</div>
          )}
        </div>

        <div className="md:col-span-1 bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">Toggle Dispositions</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-700 rounded transition">
                <input
                  type="checkbox"
                  checked={selectedDispositions.has(key)}
                  onChange={() => toggleDisposition(key)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-gray-300 font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

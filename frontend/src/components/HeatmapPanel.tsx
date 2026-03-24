import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export function HeatmapPanel(props: { scenes: any[] }) {
  const data = useMemo(() => {
    return [...props.scenes]
      .sort((a, b) => a.scene_id - b.scene_id)
      .map((s) => ({
        scene_id: s.scene_id,
        risk: Number(s.risk ?? 0),
        risk_color: s.risk_color || "#94a3b8",
        risk_level: s.risk_level,
      }));
  }, [props.scenes]);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">Risk Heatmap</div>
          <div className="text-xs text-slate-400">Scene risk intensity (green → red).</div>
        </div>
        <div className="text-xs text-slate-500">Clusters emerge via dependencies</div>
      </div>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="4 4" />
            <XAxis dataKey="scene_id" tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }} />
            <YAxis tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }} domain={[0, 1]} />
            <Tooltip
              contentStyle={{
                background: "rgba(2,6,23,0.95)",
                border: "1px solid rgba(148,163,184,0.18)",
                borderRadius: 10,
              }}
              formatter={(value: any, name: any) => [Number(value).toFixed(2), name]}
              labelFormatter={(label) => `Scene ${label}`}
            />
            <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={`cell-${d.scene_id}`} fill={d.risk_color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


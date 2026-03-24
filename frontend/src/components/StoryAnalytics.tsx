import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StoryAnalyticsProps = {
  scenes: any[];
};

export function StoryAnalytics({ scenes }: StoryAnalyticsProps) {
  const data = scenes.map((s, idx) => {
    return {
      name: `S${s.scene_id}`,
      scene_id: s.scene_id,
      emotion: Number(s.emotion_score) || Number(s.ai_emotion_intensity) || 0,
      engagement: Number(s.engagement_score) || Number(s.ai_engagement_score) || 0,
      complexity: Number(s.complexity) || 0,
      risk: Number(s.risk) || 0,
    };
  });

  return (
    <div className="glass rounded-3xl border border-slate-800/60 p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-2 w-2 rounded-full bg-cinema-neon shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
        <div className="text-xs uppercase tracking-[0.2em] font-heading font-semibold text-slate-300">
          Story & Audience Analytics
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Emotion Arc */}
        <div className="h-64">
          <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500 mb-2">Emotion Arc</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEmotion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Area type="monotone" dataKey="emotion" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorEmotion)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement / Risk Curve */}
        <div className="h-64">
          <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500 mb-2">Complexity & Risk Profile</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorComplexity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Area type="monotone" dataKey="complexity" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorComplexity)" />
              <Area type="monotone" dataKey="risk" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

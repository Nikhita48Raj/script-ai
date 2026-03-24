import React from "react";
import { motion } from "framer-motion";

type RiskHeatmapProps = {
  scenes: any[];
  onSelectScene?: (id: number) => void;
  selectedSceneId?: number | null;
};

export function RiskHeatmap({ scenes, onSelectScene, selectedSceneId }: RiskHeatmapProps) {
  return (
    <div className="glass rounded-3xl border border-slate-800/60 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-cinema-crimson shadow-[0_0_12px_rgba(192,57,43,0.5)]" />
          <div className="text-xs uppercase tracking-[0.2em] font-heading font-semibold text-slate-300">
            Production Risk Heatmap
          </div>
        </div>
        <div className="flex gap-4 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#22c55e]" /> Safe</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#fbbf24]" /> Medium</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#ef4444]" /> Critical</div>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-2">
        {scenes.map((s) => {
          const riskColor = s.risk_color || (s.risk >= 0.66 ? "#ef4444" : s.risk >= 0.33 ? "#fbbf24" : "#22c55e");
          const isSelected = selectedSceneId === Number(s.scene_id);
          
          return (
            <motion.button
              key={s.scene_id}
              whileHover={{ scale: 1.1, zIndex: 10 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectScene?.(Number(s.scene_id))}
              className={`aspect-square rounded-md transition-all relative group ${
                isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110 z-10' : ''
              }`}
              style={{ backgroundColor: riskColor }}
              title={`Scene ${s.scene_id}: ${s.risk_level}`}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-md">
                <span className="text-[10px] font-bold text-white">S{s.scene_id}</span>
              </div>
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white]" />
              )}
            </motion.button>
          );
        })}
      </div>
      
      <div className="mt-4 text-[10px] text-slate-500 italic">
        Each block represents a scene. Higher saturation indicates higher production complexity and potential schedule volatility.
      </div>
    </div>
  );
}

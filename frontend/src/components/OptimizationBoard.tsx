import React, { useState } from "react";
import { motion } from "framer-motion";
import { optimizeSchedule, OptimizeScheduleResponse } from "../api";

type OptimizationBoardProps = {
  projectId: string;
  scenesById: Record<number, any>;
};

export function OptimizationBoard({ projectId, scenesById }: OptimizationBoardProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize() {
    setIsOptimizing(true);
    setError(null);
    try {
      const res = await optimizeSchedule({ project_id: projectId });
      setResult(res);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto backdrop-blur-md bg-black/40 rounded-3xl border border-cinema-gold/20 p-8 shadow-cinema-gold">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-heading font-bold text-cinema-gold">Production Schedule Optimizer</h2>
          <p className="text-sm text-slate-400 mt-1">
            Algorithmic reordering to minimize company moves and unify location shoots.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="rounded-xl bg-gradient-to-r from-cinema-gold to-yellow-600 text-cinema-bg font-bold px-6 py-2.5 text-sm transition-all shadow-cinema-gold disabled:opacity-50"
        >
          {isOptimizing ? "Running Optimization Engine..." : "⚡ Generate Optimal Plan"}
        </motion.button>
      </div>

      {error ? (
        <div className="rounded-xl px-4 py-3 border border-cinema-crimson/50 text-red-300 font-mono text-sm mb-6 bg-red-900/20">
          Error: {error}
        </div>
      ) : null}

      {result ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-4 border border-slate-700/50">
              <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Optimized Shoot Days</div>
              <div className="mt-1 text-2xl font-heading font-bold text-emerald-400">
                {result.total_estimated_days} days
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-slate-700/50">
              <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Insights</div>
              <ul className="mt-2 space-y-1">
                {result.schedule_insights.map((ins, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-cinema-gold">✦</span> {ins}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-3 ml-1">Proposed Sequence</div>
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {result.optimal_order.map((sid, index) => {
                const sc = scenesById[sid];
                if (!sc) return null;
                const isOutdoor = String(sc.location_classification || "").toLowerCase() === "outdoor";
                
                return (
                  <div key={index} className="flex items-center gap-4 glass rounded-xl border border-slate-800/60 p-3 hover:bg-slate-800/40 transition-colors">
                    <div className="flex-shrink-0 w-8 text-center text-[10px] font-mono font-bold text-slate-500">
                      #{index + 1}
                    </div>
                    <div className="flex-shrink-0 w-12 text-center">
                      <div className="text-xl font-heading font-bold text-white/90">{sid}</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">Scene</div>
                    </div>
                    <div className="w-1 h-8 rounded bg-slate-800" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200 truncate">{sc.location}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOutdoor ? 'bg-sky-900/40 text-sky-400' : 'bg-amber-900/40 text-amber-400'}`}>
                          {sc.time}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-2">
                        <span>{sc.scene_type}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-cinema-gold/70">{sc.scene_cost ? `$${sc.scene_cost.toLocaleString()}` : 'Budget N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="h-40 flex items-center justify-center border-t border-slate-800/40 mt-8">
          <div className="text-slate-500 text-sm italic">Engine is idle. Click generate to build schedule view.</div>
        </div>
      )}
    </div>
  );
}

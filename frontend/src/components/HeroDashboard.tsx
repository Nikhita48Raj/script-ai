import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CountUp } from "./CountUp";

export function HeroDashboard(props: {
  scenes: any[];
  isAnalyzing: boolean;
}) {
  const stats = useMemo(() => {
    const totalScenes = props.scenes.length;
    const risks = props.scenes.map((s) => Number(s.risk ?? 0));
    const avgRisk = totalScenes ? risks.reduce((a, b) => a + b, 0) / totalScenes : 0;
    const highRisk = props.scenes.filter((s) => Number(s.risk ?? 0) >= 0.66).length;
    return { totalScenes, avgRisk, highRisk };
  }, [props.scenes]);

  return (
    <motion.div
      className="glass p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <motion.div
            className="text-3xl font-bold text-slate-100 tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            AI Production Risk Simulator
          </motion.div>
          <div className="mt-1 text-sm text-slate-400">
            Turn screenplay structure into dependency-aware schedule risk.
          </div>
        </div>

        <div className="flex items-stretch gap-3">
          <motion.div
            className="glass p-3 border border-sky-400/15 shadow-[0_0_26px_rgba(56,189,248,0.12)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: props.isAnalyzing ? 0.7 : 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="text-xs text-slate-400">Total Scenes</div>
            <div className="text-2xl font-bold tabular-nums text-slate-100">
              {props.isAnalyzing ? "—" : stats.totalScenes}
            </div>
          </motion.div>

          <motion.div
            className="glass p-3 border border-sky-400/15 shadow-[0_0_26px_rgba(56,189,248,0.12)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: props.isAnalyzing ? 0.7 : 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.02 }}
          >
            <div className="text-xs text-slate-400">Avg Risk</div>
            <div className="text-2xl font-bold tabular-nums text-slate-100">
              {props.isAnalyzing ? (
                "—"
              ) : (
                <CountUp
                  value={stats.avgRisk}
                  format={(n) => n.toFixed(2)}
                  durationMs={900}
                />
              )}
            </div>
          </motion.div>

          <motion.div
            className="glass p-3 border border-sky-400/15 shadow-[0_0_26px_rgba(56,189,248,0.12)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: props.isAnalyzing ? 0.7 : 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.04 }}
          >
            <div className="text-xs text-slate-400">High-Risk Scenes</div>
            <div className="text-2xl font-bold tabular-nums text-slate-100">
              {props.isAnalyzing ? "—" : stats.highRisk}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Safe
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Medium
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" /> High
        </span>
      </div>
    </motion.div>
  );
}


import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export function InsightsPanel(props: { insights: string[] }) {
  const insights = props.insights || [];
  return (
    <div className="glass p-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">Smart Insights</div>
          <div className="text-xs text-slate-400 mt-1">Actionable production signals from analysis + simulation.</div>
        </div>
        <div className="text-[11px] text-slate-500">AI + graph</div>
      </div>

      <div className="mt-3 space-y-2">
        <AnimatePresence initial={false}>
          {insights.length === 0 ? (
            <motion.div
              key="empty-insights"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="text-xs text-slate-500"
            >
              Upload a script to unlock insights.
            </motion.div>
          ) : (
            insights.slice(0, 10).map((t, idx) => {
              const isRisk = /high-risk|high risk|High/.test(t);
              const color = isRisk ? "rgba(239,68,68,0.95)" : "rgba(251,191,36,0.95)";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.22, delay: idx * 0.03 }}
                  className="text-sm text-slate-100 border border-slate-800 rounded-lg p-3"
                  style={{ boxShadow: `0 0 0 1px ${color}14` }}
                >
                  <div className="text-[11px] text-slate-400 mb-1">
                    {isRisk ? "Risk signal" : "Optimization signal"}
                  </div>
                  {t}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


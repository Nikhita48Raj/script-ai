import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "./CountUp";

export function SimulationPanel(props: {
  selectedSceneId: number | null;
  delayDays: number;
  scenes: any[];
  scenesById?: Record<number, any>;
  onChangeSelectedScene: (id: number) => void;
  onChangeDelayDays: (days: number) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
  lastSimSummary?: { totalDelayDays: number; totalCostImpact: number } | null;
  affectedNodes?: { scene_id: number; delay_days: number }[];
  rippleProgressSceneIds?: number[];
}) {
  const {
    scenes,
    selectedSceneId,
    delayDays,
    onChangeSelectedScene,
    onChangeDelayDays,
    onRunSimulation,
    isRunning,
    lastSimSummary,
    affectedNodes = [],
    rippleProgressSceneIds = [],
    scenesById = {},
  } = props;

  const orderedAffected = [...affectedNodes].sort((a, b) => a.delay_days - b.delay_days);

  return (
    <motion.div className="glass p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">Simulation</div>
          <div className="text-xs text-slate-400">Run cascade delay & schedule impact.</div>
        </div>
        <div className="text-xs text-slate-500">5-minute demo-ready</div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="text-xs text-slate-300">
          Delayed scene
          <select
            value={selectedSceneId ?? ""}
            onChange={(e) => onChangeSelectedScene(Number(e.target.value))}
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            disabled={scenes.length === 0 || isRunning}
          >
            {scenes.map((s) => (
              <option key={s.scene_id} value={s.scene_id}>
                Scene {s.scene_id} · {s.location} · {s.time}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-300">
          Input delay (days)
          <input
            type="number"
            min={0}
            max={365}
            step={0.5}
            value={delayDays}
            onChange={(e) => onChangeDelayDays(Number(e.target.value))}
            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            disabled={scenes.length === 0 || isRunning}
          />
        </label>

        <button
          onClick={onRunSimulation}
          disabled={scenes.length === 0 || selectedSceneId === null || isRunning}
          className="mt-1 rounded bg-amber-500 text-black font-semibold px-4 py-2 hover:bg-amber-400 disabled:opacity-60"
        >
          {isRunning ? "Running..." : "Run Simulation"}
        </button>

        {lastSimSummary ? (
          <div className="mt-2 border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-400">Total delay (days)</div>
            <div className="text-xl font-bold tabular-nums">
              <CountUp value={lastSimSummary.totalDelayDays} durationMs={950} format={(n) => n.toFixed(2)} />
            </div>
            <div className="text-xs text-slate-400 mt-2">Cost impact (est.)</div>
            <div className="text-lg font-bold tabular-nums">
              <CountUp
                value={lastSimSummary.totalCostImpact}
                durationMs={1050}
                format={(n) => Math.round(n).toLocaleString()}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-1">
          <div className="text-xs text-slate-400">Propagation</div>
          <AnimatePresence>
            {orderedAffected.length ? (
              <motion.div
                key={`affected-${orderedAffected.length}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
                className="mt-2 space-y-2"
              >
                {orderedAffected.slice(0, 8).map((item, idx) => {
                  const scene = scenesById[item.scene_id];
                  const color = scene?.risk_color || "#fbbf24";
                  const isNow = rippleProgressSceneIds.includes(item.scene_id);
                  const delayRounded = Number(item.delay_days ?? 0);
                  return (
                    <motion.div
                      key={item.scene_id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(0.16, idx * 0.03) }}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-slate-100 font-semibold tabular-nums">
                          Scene {item.scene_id}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {scene?.location ? scene.location : `${scene?.type || ""} ${scene?.time || ""}`}
                        </div>
                      </div>
                      <div
                        className="text-[11px] px-2 py-1 rounded-full border tabular-nums"
                        style={{
                          borderColor: isNow ? `${color}66` : "rgba(148,163,184,0.25)",
                          background: isNow ? `${color}16` : "rgba(148,163,184,0.06)",
                          color: isNow ? color : "rgba(148,163,184,0.9)",
                        }}
                      >
                        +{delayRounded.toFixed(2)}d
                      </div>
                    </motion.div>
                  );
                })}
                {orderedAffected.length > 8 ? (
                  <div className="text-[11px] text-slate-500">+{orderedAffected.length - 8} more affected</div>
                ) : null}
              </motion.div>
            ) : (
              <div className="text-xs text-slate-500 mt-2">Run simulation to see propagation.</div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}


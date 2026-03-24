import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "./CountUp";

export function SimulationEngineUI(props: {
  scenes: any[];
  selectedSceneId: number | null;
  delayDays: number;
  riskAmplification: number;
  onChangeSelectedScene: (id: number) => void;
  onChangeDelayDays: (days: number) => void;
  onChangeRiskAmplification: (v: number) => void;
  onRunSimulation: (scenarios: { delayed_scene_id: number; delay_days: number }[]) => void;
  onRunMonteCarlo: (params: { delayed_scene_id: number; delay_mean_days: number; delay_std_days: number; runs: number }) => void;
  isRunning: boolean;
  lastSimSummary: { totalDelayDays: number; totalCostImpact: number } | null;
  monteCarloStats?: {
    expected_total_delay_days: number;
    p95_total_delay_days: number;
    expected_total_cost_impact: number;
    p95_total_cost_impact: number;
    runs: number;
  } | null;
  affectedNodes: { scene_id: number; delay_days: number }[];
  scenesById: Record<number, any>;
  className?: string;
}) {
  const {
    scenes,
    selectedSceneId,
    delayDays,
    riskAmplification,
    onChangeSelectedScene,
    onChangeDelayDays,
    onChangeRiskAmplification,
    onRunSimulation,
    onRunMonteCarlo,
    isRunning,
    lastSimSummary,
    monteCarloStats,
    affectedNodes,
    scenesById,
    className,
  } = props;

  const [scenario2Enabled, setScenario2Enabled] = React.useState(false);
  const [scenario2SceneId, setScenario2SceneId] = React.useState<number | null>(null);
  const [scenario2DelayDays, setScenario2DelayDays] = React.useState<number>(delayDays);
  const [showMonteCarlo, setShowMonteCarlo] = React.useState(false);
  const [mcStdDays, setMcStdDays] = React.useState<number>(0.8);
  const [mcRuns, setMcRuns] = React.useState<number>(80);

  React.useEffect(() => {
    if (!scenario2Enabled) return;
    if (scenario2SceneId !== null) return;
    const fallback = scenes.find((s: any) => s.scene_id !== selectedSceneId)?.scene_id ?? scenes[0]?.scene_id ?? null;
    if (typeof fallback === "number") setScenario2SceneId(fallback);
  }, [scenario2Enabled, scenario2SceneId, scenes, selectedSceneId]);

  React.useEffect(() => {
    if (!scenario2Enabled) return;
    setScenario2DelayDays(delayDays);
  }, [delayDays, scenario2Enabled]);

  const orderedAffected = [...affectedNodes].sort((a, b) => a.delay_days - b.delay_days);
  const top = orderedAffected.slice(0, 6);

  return (
    <motion.div
      className={className ?? "absolute right-6 bottom-6 glass rounded-3xl p-4 w-[360px] z-20"}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]" />
          <div className="text-sm font-semibold text-slate-100">Impact Engine</div>
        </div>
        <div className="text-[11px] text-slate-500">cascade simulation</div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <label className="text-[11px] text-slate-300">
          Delayed Scene
          <select
            value={selectedSceneId ?? ""}
            onChange={(e) => onChangeSelectedScene(Number(e.target.value))}
            className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100"
            disabled={scenes.length === 0 || isRunning}
          >
            {scenes.map((s) => (
              <option key={s.scene_id} value={s.scene_id}>
                S{s.scene_id} · {s.time}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11px] text-slate-300">
          Input Delay (days)
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={delayDays}
            onChange={(e) => onChangeDelayDays(Number(e.target.value))}
            className="mt-2 w-full"
            disabled={scenes.length === 0 || isRunning}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{delayDays.toFixed(1)}d</span>
            <span>max 20d</span>
          </div>
        </label>

        <label className="text-[11px] text-slate-300">
          Risk amplification
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={riskAmplification}
            onChange={(e) => onChangeRiskAmplification(Number(e.target.value))}
            className="mt-2 w-full"
            disabled={scenes.length === 0 || isRunning}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{riskAmplification.toFixed(2)}x</span>
            <span>propagation strength</span>
          </div>
        </label>

        <button
          type="button"
          onClick={() => setScenario2Enabled((v) => !v)}
          className="rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-[11px] text-slate-200 hover:bg-slate-950/40 transition-colors"
          disabled={scenes.length === 0 || isRunning}
        >
          {scenario2Enabled ? "What-if 2: ON" : "What-if 2: OFF"}
        </button>

        {scenario2Enabled ? (
          <>
            <label className="text-[11px] text-slate-300">
              Second scene
              <select
                value={scenario2SceneId ?? ""}
                onChange={(e) => setScenario2SceneId(Number(e.target.value))}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100"
                disabled={scenes.length === 0 || isRunning}
              >
                {scenes.map((s: any) => (
                  <option key={s.scene_id} value={s.scene_id}>
                    S{s.scene_id} · {s.time}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] text-slate-300">
              Second delay (days)
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={scenario2DelayDays}
                onChange={(e) => setScenario2DelayDays(Number(e.target.value))}
                className="mt-2 w-full"
                disabled={scenes.length === 0 || isRunning}
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span>{scenario2DelayDays.toFixed(1)}d</span>
                <span>max 20d</span>
              </div>
            </label>
          </>
        ) : null}

        <motion.button
          whileHover={!isRunning ? { boxShadow: "0 0 0 1px rgba(251,191,36,0.25), 0 0 26px rgba(251,191,36,0.14)" } : undefined}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            if (selectedSceneId === null) return;
            const scenarios = [{ delayed_scene_id: selectedSceneId, delay_days: delayDays }];
            if (scenario2Enabled && scenario2SceneId !== null) {
              scenarios.push({ delayed_scene_id: scenario2SceneId, delay_days: scenario2DelayDays });
            }
            onRunSimulation(scenarios);
          }}
          disabled={scenes.length === 0 || selectedSceneId === null || isRunning || (scenario2Enabled && scenario2SceneId === null)}
          className="rounded-2xl bg-amber-500 text-black font-semibold px-4 py-2 hover:bg-amber-400 disabled:opacity-60 transition-shadow"
        >
          {isRunning ? "Simulating…" : "Run Simulation"}
        </motion.button>

        <button
          type="button"
          onClick={() => setShowMonteCarlo((v) => !v)}
          className="rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-[11px] text-slate-200 hover:bg-slate-950/40 transition-colors"
          disabled={scenes.length === 0 || selectedSceneId === null || isRunning}
        >
          {showMonteCarlo ? "Monte Carlo: ON" : "Monte Carlo: OFF"}
        </button>

        {showMonteCarlo ? (
          <>
            <label className="text-[11px] text-slate-300">
              Uncertainty (std days)
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={mcStdDays}
                onChange={(e) => setMcStdDays(Number(e.target.value))}
                className="mt-2 w-full"
                disabled={isRunning}
              />
              <div className="text-[11px] text-slate-500 mt-1">{mcStdDays.toFixed(1)}d</div>
            </label>
            <label className="text-[11px] text-slate-300">
              Monte Carlo runs
              <input
                type="number"
                min={20}
                max={500}
                step={10}
                value={mcRuns}
                onChange={(e) => setMcRuns(Number(e.target.value))}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100"
                disabled={isRunning}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedSceneId === null) return;
                onRunMonteCarlo({
                  delayed_scene_id: selectedSceneId,
                  delay_mean_days: delayDays,
                  delay_std_days: mcStdDays,
                  runs: mcRuns,
                });
              }}
              className="rounded-2xl bg-cyan-400 text-black font-semibold px-4 py-2 hover:bg-cyan-300 disabled:opacity-60"
              disabled={isRunning || selectedSceneId === null}
            >
              Run Monte Carlo
            </button>
          </>
        ) : null}

        <AnimatePresence>
          {lastSimSummary ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-400">Total Delay</div>
                <div className="text-[11px] text-slate-400 tabular-nums">+days</div>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-100">
                <CountUp value={lastSimSummary.totalDelayDays} durationMs={900} format={(n) => n.toFixed(2)} />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">Cost Impact</div>
                <div className="text-[11px] text-slate-400 tabular-nums">est.</div>
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-amber-200">
                <CountUp
                  value={lastSimSummary.totalCostImpact}
                  durationMs={1050}
                  format={(n) => Math.round(n).toLocaleString()}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {monteCarloStats ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-[11px] text-slate-400">Monte Carlo ({monteCarloStats.runs} runs)</div>
            <div className="mt-1 text-[12px] text-slate-200 tabular-nums">
              E[delay]: {monteCarloStats.expected_total_delay_days.toFixed(2)}d · P95: {monteCarloStats.p95_total_delay_days.toFixed(2)}d
            </div>
            <div className="mt-1 text-[12px] text-slate-200 tabular-nums">
              E[cost]: {Math.round(monteCarloStats.expected_total_cost_impact).toLocaleString()} · P95: {Math.round(monteCarloStats.p95_total_cost_impact).toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="text-[11px] text-slate-400 mb-2">What breaks next</div>
        <AnimatePresence initial={false}>
          {top.length ? (
            <div className="space-y-2">
              {top.map((item, idx) => {
                const scene = scenesById[item.scene_id];
                const color = scene?.risk_color || "#fbbf24";
                const isOrigin = idx === 0;
                return (
                  <motion.div
                    key={item.scene_id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-100 tabular-nums font-semibold truncate">
                        {isOrigin ? "Seed" : "Affected"} · S{item.scene_id}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{scene?.location || ""}</div>
                    </div>
                    <div
                      className="text-[11px] px-2 py-1 rounded-full border tabular-nums"
                      style={{
                        borderColor: `${color}66`,
                        color,
                        background: `${color}14`,
                      }}
                    >
                      +{item.delay_days.toFixed(2)}d
                    </div>
                  </motion.div>
                );
              })}
              {orderedAffected.length > top.length ? (
                <div className="text-[11px] text-slate-500">+{orderedAffected.length - top.length} more</div>
              ) : null}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">Run a simulation to reveal cascade.</div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}


import React, { useMemo } from "react";
import { motion } from "framer-motion";

export function ImpactTimeline(props: {
  timelineBefore: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  timelineAfter: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  scenesById: Record<number, any>;
  affectedSceneIds: number[];
  animationKey: string;
}) {
  const { timelineBefore, timelineAfter, scenesById, affectedSceneIds, animationKey } = props;

  const beforeMap = useMemo(() => new Map(timelineBefore.map((t) => [t.scene_id, t])), [timelineBefore]);
  const afterMap = useMemo(() => new Map(timelineAfter.map((t) => [t.scene_id, t])), [timelineAfter]);

  const order = useMemo(() => {
    const ids = timelineAfter.map((t) => t.scene_id);
    return [...ids].sort((a, b) => a - b);
  }, [timelineAfter]);

  const maxEnd = useMemo(() => {
    const ends = [...timelineBefore.map((t) => t.end_day), ...timelineAfter.map((t) => t.end_day)];
    return Math.max(1, ...ends);
  }, [timelineBefore, timelineAfter]);

  const scale = 36; // px per day
  const containerW = Math.max(820, Math.round(maxEnd * scale));
  const affectedSet = useMemo(() => new Set(affectedSceneIds), [affectedSceneIds]);

  return (
    <div className="glass rounded-3xl p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">Timeline shift</div>
        <div className="text-[11px] text-slate-500 tabular-nums">{timelineAfter.length} scenes</div>
      </div>

      <div className="relative overflow-x-auto scrollbar-thin" style={{ paddingBottom: 4 }}>
        <div className="relative h-20" style={{ width: containerW }}>
          {/* Baseline (before) */}
          <div className="absolute left-0 top-0 right-0 h-10 rounded-2xl bg-slate-950/20 border border-slate-800/60" />

          {/* Blocks (after positions animated from before) */}
          {order.map((sceneId) => {
            const b = beforeMap.get(sceneId);
            const a = afterMap.get(sceneId);
            if (!a || !b) return null;

            const width = Math.max(26, (a.end_day - a.start_day) * scale);
            const leftFrom = b.start_day * scale;
            const leftTo = a.start_day * scale;

            const scene = scenesById[sceneId];
            const color = scene?.risk_color || "rgba(56,189,248,0.9)";
            const isAffected = affectedSet.has(sceneId);

            return (
              <motion.div
                key={`${sceneId}-${animationKey}`}
                className="absolute top-2 h-[42px] rounded-xl border backdrop-blur-sm"
                initial={{ left: leftFrom, opacity: 0.9 }}
                animate={{ left: leftTo, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                style={{
                  width,
                  borderColor: isAffected ? `${color}66` : "rgba(148,163,184,0.28)",
                  background: isAffected ? `${color}18` : "rgba(51,65,85,0.42)",
                  boxShadow: isAffected ? `0 0 18px ${color}33` : "none",
                }}
              >
                <div className="h-full flex items-center justify-between px-2">
                  <div className="text-[11px] text-slate-100 font-semibold tabular-nums">S{sceneId}</div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {isAffected ? `+${(a.start_day - b.start_day).toFixed(1)}d` : `${a.start_day.toFixed(1)}d`}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


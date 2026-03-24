import React, { useMemo } from "react";
import { motion } from "framer-motion";

export function TimelinePanel(props: {
  timelineBefore: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  timelineAfter: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  scenesById: Record<number, { risk_color: string; risk_level: string }>;
  affectedSceneIds: number[];
  animationKey: string;
}) {
  const { timelineBefore, timelineAfter, scenesById, affectedSceneIds, animationKey } = props;
  const affectedSet = useMemo(() => new Set(affectedSceneIds), [affectedSceneIds]);

  const beforeMap = useMemo(() => new Map(timelineBefore.map((t) => [t.scene_id, t])), [timelineBefore]);
  const afterMap = useMemo(() => new Map(timelineAfter.map((t) => [t.scene_id, t])), [timelineAfter]);

  const scenesOrder = useMemo(() => {
    const ids = timelineAfter.map((t) => t.scene_id);
    return ids;
  }, [timelineAfter]);

  const maxEnd = useMemo(() => {
    const ends = [...timelineBefore.map((t) => t.end_day), ...timelineAfter.map((t) => t.end_day)];
    return Math.max(1, ...ends);
  }, [timelineBefore, timelineAfter]);

  const scale = 52; // px per day
  const containerWidth = Math.max(700, Math.round(maxEnd * scale));

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Timeline / Impact View</div>
          <div className="text-xs text-slate-400">Before vs after cascade delay (animated).</div>
        </div>
        <div className="text-xs text-slate-500">Units: days</div>
      </div>

      <div className="mt-4 overflow-auto scrollbar-thin">
        <div className="relative h-28" style={{ width: containerWidth }}>
          {/* Before row */}
          <div className="absolute left-0 top-0 right-0 text-[11px] text-slate-500">Before</div>
          {scenesOrder.map((sceneId) => {
            const t = beforeMap.get(sceneId);
            if (!t) return null;
            const scene = scenesById[sceneId];
            const width = Math.max(30, (t.end_day - t.start_day) * scale);
            const isAffected = affectedSet.has(sceneId);
            const color = scene?.risk_color || "#94a3b8";
            return (
              <div
                key={`before-${sceneId}-${animationKey}`}
                className="absolute top-7 h-10 flex items-center px-2 rounded bg-slate-800 border border-slate-700/60"
                style={{
                  left: t.start_day * scale,
                  width,
                  gap: 8,
                  background: isAffected ? `${color}12` : "rgba(51,65,85,0.65)",
                  borderColor: isAffected ? `${color}66` : "rgba(71,85,105,0.9)",
                  boxShadow: isAffected ? `0 0 18px ${color}22` : "none",
                }}
              >
                <div className="text-xs text-slate-200 whitespace-nowrap">S{sceneId}</div>
                <div className="text-[11px] text-slate-400 whitespace-nowrap">
                  {t.start_day.toFixed(1)}→{t.end_day.toFixed(1)}
                </div>
              </div>
            );
          })}

          {/* After row */}
          <div className="absolute left-0 top-[45px] right-0 text-[11px] text-slate-500">After</div>
          {scenesOrder.map((sceneId) => {
            const after = afterMap.get(sceneId);
            if (!after) return null;
            const scene = scenesById[sceneId];
            const width = Math.max(30, (after.end_day - after.start_day) * scale);
            const leftAfter = after.start_day * scale;
            const leftBefore = (beforeMap.get(sceneId)?.start_day ?? after.start_day) * scale;
            const isAffected = affectedSet.has(sceneId);
            const color = scene?.risk_color || "#94a3b8";

            return (
              <motion.div
                key={`after-${sceneId}-${animationKey}`}
                className="absolute top-[76px] h-10 flex items-center px-2 rounded border"
                style={{
                  width,
                  borderColor: isAffected ? color : "rgba(148,163,184,0.35)",
                  background: isAffected ? `${color}22` : "rgba(148,163,184,0.10)",
                  boxShadow: isAffected ? `0 0 18px ${color}33` : "none",
                }}
                initial={{ left: leftBefore, opacity: 0.9 }}
                animate={{ left: leftAfter, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
              >
                <div className="text-xs text-slate-100 whitespace-nowrap font-semibold">
                  S{sceneId}
                  {isAffected ? <span className="text-[11px] text-amber-200 ml-2">(+)</span> : null}
                </div>
                <div className="text-[11px] text-slate-300 whitespace-nowrap">
                  {after.start_day.toFixed(1)}→{after.end_day.toFixed(1)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


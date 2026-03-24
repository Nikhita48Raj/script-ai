import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type SceneLite = {
  scene_id: number;
  type: string;
  location: string;
  time: string;
  risk: number;
  risk_level: string;
  risk_color: string;
  complexity: number;
  is_action?: boolean;
  ai_summary?: string | null;
  ai_category?: string | null;
  scene_type?: string | null;
  emotion_score?: number | null;
  location_classification?: string | null;
  shot_type?: string | null;
  camera_angle?: string | null;
  lighting_notes?: string | null;
  sound_notes?: string | null;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function SceneStrip(props: {
  scenes: SceneLite[];
  selectedSceneId: number | null;
  highlightedSceneIds: number[];
  hoveredSceneId: number | null;
  onSelectScene: (id: number) => void;
  onHoverScene: (id: number | null) => void;
}) {
  const { scenes, selectedSceneId, highlightedSceneIds, hoveredSceneId, onSelectScene, onHoverScene } = props;
  const highlightSet = useMemo(() => new Set(highlightedSceneIds.map((x) => Number(x))), [highlightedSceneIds]);

  const ordered = useMemo(() => {
    return [...scenes].sort((a, b) => a.scene_id - b.scene_id);
  }, [scenes]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
          Structure
        </div>
        <div className="text-[11px] text-slate-500">Scroll to read the sequence</div>
      </div>

      <div className="relative">
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-sky-400/8 via-transparent to-transparent blur-2xl" />

        <div className="relative overflow-x-auto scrollbar-thin pb-2">
          <div className="flex gap-3 min-w-max snap-x snap-mandatory">
            {ordered.map((s) => {
              const isSelected = selectedSceneId !== null && s.scene_id === selectedSceneId;
              const isHighlighted = highlightSet.has(s.scene_id);
              const isHovered = hoveredSceneId === s.scene_id;
              const risk01 = clamp01(s.risk);

              const glow = isSelected
                ? `0 0 26px ${s.risk_color}55`
                : isHighlighted
                  ? `0 0 18px ${s.risk_color}33`
                  : "none";

              const pulseScale = isHighlighted && s.risk >= 0.66 ? 1.05 : 1.0;

              return (
                <motion.button
                  key={s.scene_id}
                  type="button"
                  className="snap-start relative text-left"
                  onClick={() => onSelectScene(s.scene_id)}
                  onMouseEnter={() => onHoverScene(s.scene_id)}
                  onMouseLeave={() => onHoverScene(null)}
                  whileHover={{ y: -2 }}
                  animate={{ scale: pulseScale }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  style={{ boxShadow: glow }}
                >
                  <div className="glass rounded-2xl px-4 py-3 w-[220px] border border-sky-400/0 hover:border-sky-400/10 relative overflow-hidden">
                    <div className="absolute left-0 right-0 top-0 h-[6px] bg-[repeating-linear-gradient(45deg,rgba(248,250,252,0.22),rgba(248,250,252,0.22)_8px,transparent_8px,transparent_16px)]" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: s.risk_color,
                            boxShadow: `0 0 18px ${s.risk_color}66`,
                          }}
                        />
                        <span
                          className="h-2 w-2 rounded-full"
                          title={`AI: ${s.ai_category ?? "Unknown"}`}
                          style={{
                            background:
                              (s.ai_category || "").toLowerCase() === "action"
                                ? "rgba(251,191,36,0.95)"
                                : (s.ai_category || "").toLowerCase() === "dialogue"
                                  ? "rgba(56,189,248,0.95)"
                                  : (s.ai_category || "").toLowerCase() === "emotional"
                                    ? "rgba(239,68,68,0.95)"
                                    : "rgba(148,163,184,0.9)",
                            boxShadow: "0 0 14px rgba(148,163,184,0.35)",
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 tabular-nums">
                            S{s.scene_id}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {s.type} · {s.time}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-300 uppercase tracking-[0.08em]">
                              {s.scene_type || "scene"}
                            </span>
                            {typeof s.emotion_score === "number" ? (
                              <span className="text-[10px] text-amber-200 tabular-nums">
                                emotion {(Math.max(0, Math.min(1, s.emotion_score)) * 100).toFixed(0)}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">{Math.round(risk01 * 100)}%</div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(risk01 * 100)}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {isHovered || isSelected ? (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.18 }}
                          className="mt-3"
                        >
                          <div className="text-[11px] text-slate-300 truncate">
                            {s.location || "—"}
                          </div>
                          {s.location_classification ? (
                            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.08em]">
                              {s.location_classification}
                            </div>
                          ) : null}
                          {s.ai_summary ? (
                            <div className="text-[11px] text-amber-200/90 mt-2 line-clamp-2">
                              {s.ai_summary}
                            </div>
                          ) : null}
                          {s.shot_type ? (
                            <div className="mt-2 border-t border-slate-700/50 pt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] uppercase tracking-widest text-slate-400">
                              <div><span className="text-slate-500">Shot:</span> {s.shot_type}</div>
                              <div><span className="text-slate-500">Angle:</span> {s.camera_angle}</div>
                              <div className="col-span-2 truncate"><span className="text-slate-500">Light:</span> {s.lighting_notes}</div>
                              <div className="col-span-2 truncate"><span className="text-slate-500">Audio:</span> {s.sound_notes}</div>
                            </div>
                          ) : null}
                        </motion.div>
                      </AnimatePresence>
                    ) : null}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


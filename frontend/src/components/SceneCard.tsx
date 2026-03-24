import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type Scene = {
  scene_id: number;
  type: string;
  location: string;
  time: string;
  characters: string[];
  num_characters: number;
  scene_length: number;
  dialogue_density: number;
  complexity: number;
  risk: number;
  risk_level: "Safe" | "Medium" | "High" | string;
  risk_color: string;
  is_action: boolean;
  text_excerpt: string;
  ai_summary?: string | null;
  ai_emotion_tone?: string | null;
  ai_category?: string | null;
};

export function SceneCardItem(props: {
  scene: Scene;
  selected?: boolean;
  onSelect?: (sceneId: number) => void;
}) {
  const { scene, selected, onSelect } = props;
  const borderGlow = selected ? `0 0 0 1px ${scene.risk_color}, 0 0 24px ${scene.risk_color}55` : "none";
  const [isHovered, setIsHovered] = useState(false);

  const riskPercent = Math.max(0, Math.min(1, Number(scene.risk ?? 0))) * 100;
  const complexityClamped = Math.max(0, Math.min(60, Number(scene.complexity ?? 0)));
  const complexityRatio = complexityClamped / 60;

  const charactersPreview = useMemo(() => {
    const list = scene.characters ?? [];
    if (list.length <= 4) return list;
    return [...list.slice(0, 4), `+${list.length - 4}`];
  }, [scene.characters]);

  return (
    <motion.div
      layout
      className="glass p-3 cursor-pointer"
      style={{ boxShadow: borderGlow }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onSelect?.(scene.scene_id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-300">
              Scene <span className="text-slate-100">{scene.scene_id}</span> · {scene.type} · {scene.time}
            </div>
            {scene.is_action ? (
              <span className="text-[11px] px-2 py-1 rounded-full bg-rose-950/50 text-rose-200 border border-rose-700/60">
                Action
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">{scene.location}</div>
        </div>

        <div className="flex items-center gap-3">
          {/* Complexity dial */}
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 36 36" className="w-10 h-10">
              <path
                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                fill="none"
                stroke="rgba(148,163,184,0.25)"
                strokeWidth="2.5"
              />
              <path
                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                fill="none"
                stroke={scene.risk_color || "#fbbf24"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 7.5} ${2 * Math.PI * 7.5}`}
                strokeDashoffset={(1 - complexityRatio) * (2 * Math.PI * 7.5)}
                style={{ transition: "stroke-dashoffset 250ms ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[11px] leading-none text-slate-100 font-semibold tabular-nums">
                {complexityClamped.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>
            Risk <span className="text-slate-200 font-semibold tabular-nums">{scene.risk.toFixed(2)}</span>{" "}
            <span className="text-slate-300">· {scene.risk_level}</span>
          </span>
          <span className="tabular-nums">{riskPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
            style={{
              width: `${riskPercent}%`,
              boxShadow: `0 0 18px ${scene.risk_color}33`,
              transition: "width 350ms ease-out",
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded-full bg-slate-900/50 border border-sky-900/60 text-cyan-100">
          {scene.num_characters} char{scene.num_characters === 1 ? "" : "s"}
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-900/50 border border-sky-900/60 text-cyan-100">
          Dialogue {Math.round(scene.dialogue_density * 100)}%
        </span>
      </div>

      <AnimatePresence>
        {isHovered ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="mt-3 border-t border-slate-800 pt-3"
          >
            <div className="text-xs text-slate-300 font-semibold">Scene details</div>
            <div className="mt-2 text-xs text-slate-400">
              Characters:{" "}
              <span className="text-slate-200">
                {charactersPreview.length ? charactersPreview.join(", ") : "None detected"}
              </span>
            </div>
            <div className="mt-2 text-sm text-slate-100 max-h-28 overflow-hidden">{scene.text_excerpt}</div>
            {scene.ai_summary ? (
              <div className="mt-3">
                <div className="text-[11px] text-amber-200 font-semibold">AI enhancement</div>
                <div className="text-xs text-slate-100 mt-1">{scene.ai_summary}</div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Tone: <span className="text-slate-200">{scene.ai_emotion_tone}</span> · Category:{" "}
                  <span className="text-slate-200">{scene.ai_category}</span>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}


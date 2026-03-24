import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer } from "recharts";

function riskClassFromText(t: string) {
  return /high|High/.test(t) ? "rgba(239,68,68,0.95)" : "rgba(251,191,36,0.95)";
}

export function InsightPanel(props: {
  insights: string[];
  scenes: any[];
  bottleneckSceneId: number | null;
  delayedSceneId: number | null;
  affectedCount: number;
  lastSimSummary: { totalDelayDays: number; totalCostImpact: number } | null;
  scenesById: Record<number, any>;
  assistantAnswer?: string | null;
  isAskingAssistant?: boolean;
  onAskAssistant?: (question: string) => void | Promise<void>;
  className?: string;
}) {
  const {
    insights,
    scenes,
    bottleneckSceneId,
    delayedSceneId,
    affectedCount,
    lastSimSummary,
    scenesById,
    assistantAnswer,
    isAskingAssistant,
    onAskAssistant,
    className,
  } = props;
  const [question, setQuestion] = React.useState("");

  const optimization = useMemo(() => {
    const locMap = new Map<string, { count: number; avgRisk: number }>();
    for (const s of scenes) {
      const loc = String(s.location || "").trim();
      if (!loc) continue;
      const prev = locMap.get(loc);
      const risk = Number(s.risk ?? 0);
      if (!prev) locMap.set(loc, { count: 1, avgRisk: risk });
      else locMap.set(loc, { count: prev.count + 1, avgRisk: (prev.avgRisk * prev.count + risk) / (prev.count + 1) });
    }
    const sorted = Array.from(locMap.entries()).sort((a, b) => b[1].count - a[1].count);
    const topLocs = sorted.slice(0, 3).map(([loc]) => loc);
    return topLocs;
  }, [scenes]);

  const bottleneck = bottleneckSceneId !== null ? scenesById[bottleneckSceneId] : null;
  const bottleneckLine = bottleneck
    ? `Bottleneck: S${bottleneck.scene_id}`
    : "Bottleneck: —";

  const aiLine = bottleneck?.ai_summary ? String(bottleneck.ai_summary) : null;
  const emotion = bottleneck?.ai_emotion_tone ? String(bottleneck.ai_emotion_tone) : null;

  const emotionCurve = useMemo(() => {
    const tones: Record<string, number> = {
      tense: 0.78,
      calm: 0.22,
      action: 0.62,
      ominous: 0.82,
      chaotic: 0.92,
    };
    const sorted = [...scenes].sort((a, b) => Number(a.scene_id) - Number(b.scene_id));
    return sorted.map((s) => {
      const intensity = s.ai_emotion_intensity;
      const tone = s.ai_emotion_tone;
      const risk = Number(s.risk ?? 0);
      const y =
        typeof intensity === "number"
          ? Math.max(0, Math.min(1, intensity))
          : tone && tones[String(tone).toLowerCase()] !== undefined
            ? tones[String(tone).toLowerCase()]
            : Math.max(0, Math.min(1, 0.15 + risk * 0.85));
      return { x: Number(s.scene_id), y };
    });
  }, [scenes]);

  const engagementCurve = useMemo(() => {
    const sorted = [...scenes].sort((a, b) => Number(a.scene_id) - Number(b.scene_id));
    return sorted.map((s) => {
      const v = s.ai_engagement_score;
      if (typeof v === "number") return { x: Number(s.scene_id), y: Math.max(0, Math.min(100, v)) };

      // Heuristic fallback using extracted features (not AI).
      const risk = Number(s.risk ?? 0);
      const complexity = Number(s.complexity ?? 0);
      const dialogue = Number(s.dialogue_density ?? 0);
      const y = 10 + dialogue * 55 + (complexity / 50) * 28 - risk * 22;
      return { x: Number(s.scene_id), y: Math.max(0, Math.min(100, y)) };
    });
  }, [scenes]);

  const productionScore = useMemo(() => {
    if (!scenes.length) return 0;
    const avgRisk = scenes.reduce((acc, s) => acc + Number(s.risk ?? 0), 0) / scenes.length;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - avgRisk))));
  }, [scenes]);

  const narrative = useMemo(() => {
    const topInsights = insights.slice(0, 4);
    const primary =
      delayedSceneId !== null
        ? `Seed impact: delayed S${delayedSceneId} → ${affectedCount} downstream scene(s).`
        : null;
    return [primary, ...topInsights].filter(Boolean) as string[];
  }, [insights, delayedSceneId, affectedCount]);

  const directorsNotes = useMemo(() => {
    const outdoorHighRisk = scenes.filter(
      (s) => String(s.location_classification || "").toLowerCase() === "outdoor" && Number(s.risk ?? 0) >= 0.6,
    ).length;
    const highRetake = scenes.filter((s) => Number(s.retake_risk ?? 0) >= 0.65).length;
    const actionScenes = scenes.filter((s) => String(s.scene_type || "").toLowerCase() === "action").length;
    const notes: string[] = [];
    if (outdoorHighRisk > 0) notes.push(`Weather backup advised for ${outdoorHighRisk} exterior high-risk scene(s).`);
    if (highRetake > 0) notes.push(`Allocate additional takes for ${highRetake} complex setup(s).`);
    if (actionScenes > 0) notes.push(`Second-unit opportunity: block ${actionScenes} action scene(s) in parallel.`);
    if (!notes.length) notes.push("Schedule is balanced. Focus on performance quality and coverage efficiency.");
    return notes.slice(0, 3);
  }, [scenes]);

  return (
    <motion.div
      className={className ?? "absolute left-6 top-6 glass rounded-3xl p-4 z-20 w-[420px]"}
      initial={{ opacity: 0, x: -12, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">AI Narration</div>
          <div className="mt-2 text-lg font-bold text-slate-100 truncate">{bottleneckLine}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            Production score:{" "}
            <span className="text-slate-100 font-semibold tabular-nums">{productionScore}</span>
          </div>
          {emotion ? (
            <div className="mt-1 text-[11px] text-amber-200/90">
              Tone: <span className="text-slate-100">{emotion}</span>
            </div>
          ) : null}
        </div>
        <div className="text-[11px] text-slate-500 text-right">
          {lastSimSummary ? "Impact computed" : "Ready"}
        </div>
      </div>

      <AnimatePresence>
        {aiLine ? (
          <motion.div
            key="ai-line"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 text-[12px] text-slate-300 leading-relaxed"
          >
            {aiLine}
          </motion.div>
        ) : (
          <motion.div
            key="ai-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[12px] text-slate-500 leading-relaxed"
          >
            Analyze scenes to enable AI narration.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 space-y-2">
        {narrative.map((t, idx) => {
          const color = riskClassFromText(t);
          const isSeed = delayedSceneId !== null && t.includes(`Seed impact`);
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.22, delay: idx * 0.03 }}
              className="rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2"
              style={{
                boxShadow: `0 0 0 1px ${color}14`,
              }}
            >
              <div className="text-[11px] text-slate-400">{isSeed ? "Engine" : "Signal"}</div>
              <div className="text-[12px] text-slate-100 mt-1">{t}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Emotion + engagement curves (signal, not noise) */}
      <div className="mt-4">
        <div className="text-[11px] text-slate-400 mb-2">Emotion / Engagement</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-2">
            <div className="text-[10px] text-slate-500 mb-1">Emotion</div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={emotionCurve} margin={{ left: -10, right: -10 }}>
                  <Line type="monotone" dataKey="y" stroke="rgba(56,189,248,0.95)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-2">
            <div className="text-[10px] text-slate-500 mb-1">Engagement</div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementCurve} margin={{ left: -10, right: -10 }}>
                  <Line type="monotone" dataKey="y" stroke="rgba(251,191,36,0.95)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Risk heat (minimal) */}
      <div className="mt-4">
        <div className="text-[11px] text-slate-400 mb-2">Risk heat</div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-2">
          <div className="flex items-end gap-[4px] h-20">
            {[...scenes]
              .sort((a, b) => Number(a.scene_id) - Number(b.scene_id))
              .map((s) => {
                const r = Math.max(0, Math.min(1, Number(s.risk ?? 0)));
                const h = 8 + r * 56;
                const color = s.risk_color || "rgba(251,191,36,0.9)";
                return (
                  <div
                    key={s.scene_id}
                    title={`Scene ${s.scene_id} risk ${r.toFixed(2)}`}
                    className="w-[10px] rounded-[4px]"
                    style={{
                      height: `${h}px`,
                      background: color,
                      boxShadow: `0 0 14px ${color}22`,
                      opacity: 0.9,
                    }}
                  />
                );
              })}
          </div>
        </div>
      </div>

      {optimization.length ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2">
          <div className="text-[11px] text-slate-400">Shooting optimization</div>
          <div className="text-[12px] text-slate-100 mt-1">
            Group by location: {optimization.join(" · ")}.
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Reorder by dependency clusters to reduce cascade risk.
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2">
        <div className="text-[11px] text-slate-400">Director notes</div>
        <div className="mt-1 space-y-1">
          {directorsNotes.map((n, idx) => (
            <div key={idx} className="text-[12px] text-slate-200">
              {n}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2">
        <div className="text-[11px] text-slate-400">AI assistant</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about bottlenecks, risk, location…"
            className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-[12px] text-slate-100 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const q = question.trim();
              if (!q) return;
              onAskAssistant?.(q);
            }}
            disabled={!question.trim() || Boolean(isAskingAssistant)}
            className="rounded-xl px-3 py-2 text-[12px] font-semibold bg-cyan-400 text-black disabled:opacity-60"
          >
            {isAskingAssistant ? "…" : "Ask"}
          </button>
        </div>
        {assistantAnswer ? (
          <div className="mt-2 text-[12px] text-slate-200 leading-relaxed">{assistantAnswer}</div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-500">No question asked yet.</div>
        )}
      </div>
    </motion.div>
  );
}


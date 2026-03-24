import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { analyzeScript, getGraph, runSimulation } from "./api";
import { DependencyGraph } from "./components/DependencyGraph";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { InsightsPanel } from "./components/InsightsPanel";
import { SceneCards } from "./components/SceneCards";
import { SimulationPanel } from "./components/SimulationPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { HeroDashboard } from "./components/HeroDashboard";

type Scene = any;
type GraphData = { nodes: any[]; links: any[] };

const SAMPLE_SCRIPT = `INT. HOUSE - DAY
JOHN: We don't have much time.
MARY: Then tell me what to do.

EXT. STREET - NIGHT
A car explodes. People scatter.
JOHN runs toward the smoke.

INT. OFFICE - DAY
SARAH reviews the footage with MIKE.
They argue quietly.`;

export default function App() {
  const [scriptText, setScriptText] = useState<string>(SAMPLE_SCRIPT);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [insights, setInsights] = useState<string[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRunningSim, setIsRunningSim] = useState(false);

  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [delayDays, setDelayDays] = useState<number>(2);

  const [hoveredSceneId, setHoveredSceneId] = useState<number | null>(null);
  const [highlightedSceneIds, setHighlightedSceneIds] = useState<number[]>([]);
  const [affectedNodes, setAffectedNodes] = useState<{ scene_id: number; delay_days: number }[]>([]);
  const [flashToken, setFlashToken] = useState<string>("0");

  const [lastSim, setLastSim] = useState<{
    totalDelayDays: number;
    totalCostImpact: number;
  } | null>(null);
  const [timelineBefore, setTimelineBefore] = useState<any[]>([]);
  const [timelineAfter, setTimelineAfter] = useState<any[]>([]);
  const [simRunKey, setSimRunKey] = useState<string>("0");

  const scenesById = useMemo(() => {
    const m: Record<number, any> = {};
    for (const s of scenes) m[Number(s.scene_id)] = s;
    return m;
  }, [scenes]);

  const highlightedSetInfo = useMemo(() => {
    if (highlightedSceneIds.length === 0) return null;
    return `Highlighting ${highlightedSceneIds.length} scene(s)`;
  }, [highlightedSceneIds]);

  const rippleTimersRef = useRef<number[]>([]);

  function clearRippleTimers() {
    for (const t of rippleTimersRef.current) window.clearTimeout(t);
    rippleTimersRef.current = [];
  }

  function computeDownstream(sceneId: number): number[] {
    const outgoing: Record<string, string[]> = {};
    for (const l of graph.links) {
      const src = String(l.source);
      const tgt = String(l.target);
      outgoing[src] = outgoing[src] || [];
      outgoing[src].push(tgt);
    }

    const seen = new Set<string>([String(sceneId)]);
    const q: string[] = [String(sceneId)];
    while (q.length) {
      const cur = q.shift()!;
      for (const nxt of outgoing[cur] || []) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        q.push(nxt);
      }
    }
    return Array.from(seen).map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  }

  function computeConnected(sceneId: number): number[] {
    const adjacency = new Map<string, Set<string>>();
    for (const l of graph.links) {
      const src = String(l.source);
      const tgt = String(l.target);
      adjacency.set(src, adjacency.get(src) || new Set<string>());
      adjacency.set(tgt, adjacency.get(tgt) || new Set<string>());
      adjacency.get(src)!.add(tgt);
      adjacency.get(tgt)!.add(src);
    }

    const seen = new Set<string>([String(sceneId)]);
    const q: string[] = [String(sceneId)];
    while (q.length) {
      const cur = q.shift()!;
      for (const nxt of adjacency.get(cur) || []) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        q.push(nxt);
      }
    }

    return Array.from(seen).map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  }

  async function handleAnalyze() {
    const text = scriptText.trim();
    if (!text) return;

    setIsAnalyzing(true);
    clearRippleTimers();
    setProjectId(null);
    setScenes([]);
    setGraph({ nodes: [], links: [] });
    setInsights([]);
    setHighlightedSceneIds([]);
    setAffectedNodes([]);
    setFlashToken((t) => String(Number(t) + 1));
    setTimelineBefore([]);
    setTimelineAfter([]);
    setLastSim(null);

    try {
      const res = await analyzeScript({
        script_text: text,
        enable_ai: true,
        max_scenes_for_ai: 20,
      });

      setProjectId(res.project_id);
      setScenes(res.scenes || []);
      setInsights(res.insights || []);

      const firstId = res.scenes?.[0]?.scene_id;
      if (firstId) {
        setSelectedSceneId(Number(firstId));
        setHighlightedSceneIds([Number(firstId)]);
      }

      const g = await getGraph(res.project_id);
      setGraph(g.graph);
    } catch (e: any) {
      setInsights([`Analyze failed: ${String(e?.message || e).slice(0, 200)}`]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRunSimulation() {
    if (!projectId || selectedSceneId === null) return;
    setIsRunningSim(true);
    clearRippleTimers();
    try {
      const res = await runSimulation({
        project_id: projectId,
        delayed_scene_id: selectedSceneId,
        delay_days: delayDays,
      });

      const affected = res.graph_affected_node_ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
      const ordered = [...(res.affected_nodes || [])].sort((a, b) => a.delay_days - b.delay_days);
      setAffectedNodes(ordered);

      setFlashToken(String(Date.now()));
      setHighlightedSceneIds([selectedSceneId]); // ripple origin
      setLastSim({ totalDelayDays: res.total_delay_days, totalCostImpact: res.total_cost_impact });
      setTimelineBefore(res.timeline_before || []);
      setTimelineAfter(res.timeline_after || []);

      // Ripple animation: progressive reveal across the dependency graph.
      const revealOrder =
        ordered.length > 0
          ? ordered
          : affected.map((scene_id) => ({ scene_id, delay_days: 0 }));

      const delayMsPerNode = 125;
      const startDelayMs = 200;

      revealOrder.forEach((item, idx) => {
        if (item.scene_id === selectedSceneId) return;
        const t = window.setTimeout(() => {
          setHighlightedSceneIds((prev) => {
            if (prev.includes(item.scene_id)) return prev;
            return [...prev, item.scene_id];
          });
        }, startDelayMs + idx * delayMsPerNode);
        rippleTimersRef.current.push(t);
      });

      const finishMs = startDelayMs + Math.max(0, revealOrder.length - 1) * delayMsPerNode + 250;
      rippleTimersRef.current.push(
        window.setTimeout(() => {
          setHighlightedSceneIds(affected);
        }, finishMs),
      );

      setInsights(res.insights || insights);
      setSimRunKey(String(Date.now()));
    } catch (e: any) {
      setInsights([`Simulation failed: ${String(e?.message || e).slice(0, 200)}`]);
    } finally {
      setIsRunningSim(false);
    }
  }

  function onGraphSelect(sceneId: number) {
    clearRippleTimers();
    setSelectedSceneId(sceneId);
    setHoveredSceneId(null);
    if (graph.links.length) {
      setHighlightedSceneIds(computeConnected(sceneId));
    } else {
      setHighlightedSceneIds([sceneId]);
    }
  }

  function onSelectFromCard(sceneId: number) {
    clearRippleTimers();
    setSelectedSceneId(sceneId);
    // Keep the highlight consistent with the selected scene.
    setHighlightedSceneIds([sceneId]);
  }

  return (
    <div className="min-h-screen p-5 film-grain relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <HeroDashboard scenes={scenes} isAnalyzing={isAnalyzing} />

        <div className="mt-5 grid grid-cols-12 gap-4">
          <div className="col-span-4 space-y-4">
            <motion.div
              className="glass p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Script Upload</div>
                  <div className="text-xs text-slate-400">Use INT./EXT. headings.</div>
                </div>
                <label className="text-xs text-slate-300 cursor-pointer underline">
                  Load .txt
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setScriptText(String(reader.result || ""));
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="mt-3 w-full h-56 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 font-mono"
                placeholder="Paste your screenplay text here…"
              />

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="mt-3 rounded bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400 disabled:opacity-60 w-full transition-shadow"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Script"}
              </button>
            </motion.div>

            {isAnalyzing && scenes.length === 0 ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass p-3 h-28 rounded-lg" />
                ))}
              </div>
            ) : (
              <SceneCards scenes={scenes} selectedSceneId={selectedSceneId} onSelectScene={onSelectFromCard} />
            )}
          </div>

          <div className="col-span-5 space-y-4">
            {graph.nodes.length ? (
              <DependencyGraph
                graph={graph}
                highlightedSceneIds={highlightedSceneIds}
                selectedSceneId={selectedSceneId}
                onSelectScene={onGraphSelect}
                onHoverScene={setHoveredSceneId}
                flashSceneId={selectedSceneId}
                flashToken={flashToken}
              />
            ) : (
              <div className="glass p-4">
                <div className="text-sm font-semibold text-slate-200">Production Dependency Graph</div>
                <div className="text-xs text-slate-400 mt-1">Analyze a script to visualize scene dependencies.</div>
              </div>
            )}

            <SimulationPanel
              scenes={scenes}
              scenesById={scenesById}
              selectedSceneId={selectedSceneId}
              delayDays={delayDays}
              onChangeSelectedScene={(id) => setSelectedSceneId(id)}
              onChangeDelayDays={(d) => setDelayDays(d)}
              onRunSimulation={handleRunSimulation}
              isRunning={isRunningSim}
              lastSimSummary={lastSim}
              affectedNodes={affectedNodes}
              rippleProgressSceneIds={highlightedSceneIds}
            />

            {timelineAfter.length ? (
              <TimelinePanel
                timelineBefore={timelineBefore}
                timelineAfter={timelineAfter}
                scenesById={scenesById}
                affectedSceneIds={highlightedSceneIds}
                animationKey={simRunKey}
              />
            ) : (
              <div className="glass p-4">
                <div className="text-sm font-semibold text-slate-200">Timeline / Impact View</div>
                <div className="text-xs text-slate-400 mt-1">Run a simulation to animate cascade delay.</div>
              </div>
            )}
          </div>

          <div className="col-span-3 space-y-4">
            <div className="glass p-4">
              <div className="text-sm font-semibold text-slate-200">Hover Details</div>
              <div className="text-xs text-slate-400 mt-1">Hover a node for cinematic scene metadata.</div>

              <AnimatePresence initial={false} mode="wait">
                {hoveredSceneId ? (
                  <motion.div
                    key={`hover-${hoveredSceneId}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.22 }}
                    className="mt-4"
                  >
                    <div className="text-sm text-slate-100 font-semibold">
                      Scene {hoveredSceneId} · {scenesById[hoveredSceneId]?.type} · {scenesById[hoveredSceneId]?.time}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{scenesById[hoveredSceneId]?.location}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                        Complexity {Number(scenesById[hoveredSceneId]?.complexity || 0).toFixed(2)}
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded-full bg-slate-900 border border-slate-800"
                        style={{ color: scenesById[hoveredSceneId]?.risk_color || "#fbbf24" }}
                      >
                        Risk {Number(scenesById[hoveredSceneId]?.risk || 0).toFixed(2)}
                      </span>
                      {scenesById[hoveredSceneId]?.ai_summary ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-950/40 border border-amber-800 text-amber-200">
                          AI enriched
                        </span>
                      ) : null}
                    </div>

                    {scenesById[hoveredSceneId]?.ai_summary ? (
                      <div className="mt-3 text-xs text-amber-200/90">{scenesById[hoveredSceneId]?.ai_summary}</div>
                    ) : null}
                    <div className="mt-3 text-xs text-slate-400">{scenesById[hoveredSceneId]?.text_excerpt}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hover-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 text-xs text-slate-500"
                  >
                    {highlightedSetInfo ? highlightedSetInfo : "Hover nodes to inspect scene details."}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <InsightsPanel insights={insights} />

            <HeatmapPanel scenes={scenes} />
          </div>
        </div>
      </div>
    </div>
  );
}


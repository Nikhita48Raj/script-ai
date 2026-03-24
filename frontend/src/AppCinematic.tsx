import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { analyzeScript, askAssistant, compareScripts, exportProject, getGraph, runMonteCarlo, runMultiSimulation, runSimulation, optimizeSchedule, simulateWorstCase } from "./api";
import { SceneStrip, SceneLite } from "./components/SceneStrip";
import { GraphCanvas } from "./components/GraphCanvas";
import { SimulationEngineUI } from "./components/SimulationEngineUI";
import { InsightPanel } from "./components/InsightPanel";
import { ImpactTimeline } from "./components/ImpactTimeline";
import { StoryboardGrid } from "./components/StoryboardGrid";
import { CastingBoard } from "./components/CastingBoard";
import { OptimizationBoard } from "./components/OptimizationBoard";
import { StoryAnalytics } from "./components/StoryAnalytics";
import { RiskHeatmap } from "./components/RiskHeatmap";

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

type Mode = "landing" | "structure" | "storyboard" | "casting" | "optimization" | "system" | "impact";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function endpointNodeId(endpoint: any): string {
  if (typeof endpoint === "string") return endpoint;
  if (typeof endpoint === "number") return String(endpoint);
  if (endpoint && typeof endpoint === "object") {
    if (endpoint.id !== undefined) return String(endpoint.id);
    if (endpoint.scene_id !== undefined) return String(endpoint.scene_id);
  }
  return "";
}

function formatCostBreakdown(costBreakdown: unknown): string {
  if (!costBreakdown || typeof costBreakdown !== "object" || Array.isArray(costBreakdown)) {
    return "N/A";
  }

  const entries = Object.entries(costBreakdown as Record<string, unknown>)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([key, value]) => `${key}: $${Number(value).toLocaleString()}`);

  return entries.length ? entries.join(" | ") : "N/A";
}

export default function AppCinematic() {
  const [mode, setMode] = useState<Mode>("landing");
  const [scriptText, setScriptText] = useState<string>(SAMPLE_SCRIPT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [isAskingAssistant, setIsAskingAssistant] = useState(false);
  const [monteCarloStats, setMonteCarloStats] = useState<{
    expected_total_delay_days: number;
    p95_total_delay_days: number;
    expected_total_cost_impact: number;
    p95_total_cost_impact: number;
    runs: number;
  } | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [insights, setInsights] = useState<string[]>([]);
  const [filmProjectMeta, setFilmProjectMeta] = useState<any>(null);
  const [cinematicAnalytics, setCinematicAnalytics] = useState<any>(null);
  const [overallBudget, setOverallBudget] = useState<number>(0);
  const [dialogueActionRatio, setDialogueActionRatio] = useState<number>(0);
  const [climaxSceneId, setClimaxSceneId] = useState<number | null>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [hoveredSceneId, setHoveredSceneId] = useState<number | null>(null);
  const [highlightedSceneIds, setHighlightedSceneIds] = useState<number[]>([]);

  const [delayDays, setDelayDays] = useState<number>(2);
  const [lastSimSummary, setLastSimSummary] = useState<{ totalDelayDays: number; totalCostImpact: number } | null>(null);
  const [affectedNodes, setAffectedNodes] = useState<{ scene_id: number; delay_days: number }[]>([]);
  const [timelineBefore, setTimelineBefore] = useState<any[]>([]);
  const [timelineAfter, setTimelineAfter] = useState<any[]>([]);

  const [bottleneckSceneId, setBottleneckSceneId] = useState<number | null>(null);

  const [rippleToken, setRippleToken] = useState<string>("0");
  const [rippleScheduleMs, setRippleScheduleMs] = useState<Record<number, number>>({});
  const [rippleOriginSceneId, setRippleOriginSceneId] = useState<number | null>(null);
  const [systemHighRiskOnly, setSystemHighRiskOnly] = useState(false);
  const [systemLocationFilter, setSystemLocationFilter] = useState<string>("all");
  const [systemCharacterFilter, setSystemCharacterFilter] = useState<string>("all");
  const [systemGraphMode, setSystemGraphMode] = useState<"dependencies" | "narrative">("dependencies");
  const [riskAmplification, setRiskAmplification] = useState(0.3);

  const rippleTimersRef = useRef<number[]>([]);
  const transformTimeoutRef = useRef<number | null>(null);

  function clearRippleTimers() {
    for (const t of rippleTimersRef.current) window.clearTimeout(t);
    rippleTimersRef.current = [];
  }


  const scenesById = useMemo(() => {
    const m: Record<number, any> = {};
    for (const s of scenes) m[Number(s.scene_id)] = s;
    return m;
  }, [scenes]);

  const scenesLite: SceneLite[] = useMemo(() => {
    return scenes.map((s) => ({
      scene_id: Number(s.scene_id),
      type: String(s.type ?? ""),
      location: String(s.location ?? ""),
      time: String(s.time ?? ""),
      risk: Number(s.risk ?? 0),
      risk_level: String(s.risk_level ?? "Safe"),
      risk_color: String(s.risk_color ?? "#22c55e"),
      complexity: Number(s.complexity ?? 0),
      is_action: Boolean(s.is_action),
      ai_summary: s.ai_summary ?? null,
      ai_category: s.ai_category ?? null,
      scene_type: s.scene_type ?? null,
      emotion_score: typeof s.emotion_score === "number" ? s.emotion_score : (typeof s.ai_emotion_intensity === "number" ? s.ai_emotion_intensity : null),
      location_classification: s.location_classification ?? null,
      shot_type: s.shot_type ?? null,
      camera_angle: s.camera_angle ?? null,
      lighting_notes: s.lighting_notes ?? null,
      sound_notes: s.sound_notes ?? null,
    }));
  }, [scenes]);

  const uniqueLocations = useMemo(() => {
    const vals = new Set<string>();
    for (const s of scenes) {
      const v = String(s.location || "").trim();
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }, [scenes]);

  const uniqueCharacters = useMemo(() => {
    const vals = new Set<string>();
    for (const s of scenes) {
      for (const c of s.characters || []) vals.add(String(c));
    }
    return Array.from(vals).sort();
  }, [scenes]);

  const systemGraph = useMemo(() => {
    const baseNodes = graph.nodes || [];
    let nodes = baseNodes.filter((n) => {
      if (systemHighRiskOnly && Number(n.risk ?? 0) < 0.66) return false;
      if (systemLocationFilter !== "all" && String(n.location || "") !== systemLocationFilter) return false;
      if (systemCharacterFilter !== "all") {
        const scene = scenesById[Number(n.scene_id)];
        const chars = (scene?.characters || []).map((x: any) => String(x));
        if (!chars.includes(systemCharacterFilter)) return false;
      }
      return true;
    });

    const nodeSet = new Set(nodes.map((n) => String(n.id)));
    let links = (graph.links || []).filter((l) => {
      const src = endpointNodeId(l.source);
      const tgt = endpointNodeId(l.target);
      return nodeSet.has(src) && nodeSet.has(tgt);
    });

    if (systemGraphMode === "narrative") {
      // Narrative flow: sequential scene order only.
      const sorted = [...nodes].sort((a, b) => Number(a.scene_id) - Number(b.scene_id));
      const seqLinks: any[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        seqLinks.push({
          source: String(sorted[i].id),
          target: String(sorted[i + 1].id),
          weight: 1,
        });
      }
      links = seqLinks;
    }

    return { nodes, links };
  }, [
    graph.nodes,
    graph.links,
    systemHighRiskOnly,
    systemLocationFilter,
    systemCharacterFilter,
    systemGraphMode,
    scenesById,
  ]);

  const avgRisk = useMemo(() => {
    if (!scenes.length) return 0;
    const sum = scenes.reduce((acc, s) => acc + Number(s.risk ?? 0), 0);
    return sum / scenes.length;
  }, [scenes]);

  const highRiskCount = useMemo(() => {
    return scenes.filter((s) => Number(s.risk ?? 0) >= 0.66).length;
  }, [scenes]);

  const filmOps = useMemo(() => {
    const outdoor = scenes.filter((s) => String(s.location_classification || "").toLowerCase() === "outdoor").length;
    const action = scenes.filter((s) => String(s.scene_type || "").toLowerCase() === "action").length;
    const emotional = scenes.filter((s) => String(s.scene_type || "").toLowerCase() === "emotional").length;
    const shootDays = scenes.reduce((acc, s) => acc + Number(s.schedule_estimate_days ?? 0), 0);
    const weatherRiskAvg =
      scenes.length > 0 ? scenes.reduce((acc, s) => acc + Number(s.weather_risk ?? 0), 0) / scenes.length : 0;
    return { outdoor, action, emotional, shootDays, weatherRiskAvg };
  }, [scenes]);
  const selectedScene = selectedSceneId !== null ? scenesById[selectedSceneId] : null;
  const scriptMetrics = useMemo(() => {
    const totalWords = scenes.reduce((acc, s) => acc + Number(s.scene_length ?? 0), 0);
    const pageCount = totalWords / 250;
    const avgDialogue = scenes.length ? scenes.reduce((acc, s) => acc + Number(s.dialogue_density ?? 0), 0) / scenes.length : 0;
    const castPeak = scenes.reduce((acc, s) => Math.max(acc, Number(s.num_characters ?? 0)), 0);
    const dialogueScenes = scenes.filter((s) => String(s.scene_type || "").toLowerCase() === "dialogue").length;
    return { totalWords, pageCount, avgDialogue, castPeak, dialogueScenes };
  }, [scenes]);

  useEffect(() => {
    return () => clearRippleTimers();
  }, []);

  useEffect(() => {
    // Compute bottleneck as max weighted out-degree.
    if (!graph.nodes.length || !graph.links.length) {
      setBottleneckSceneId(null);
      return;
    }
    const outSum = new Map<number, number>();
    for (const n of graph.nodes) outSum.set(Number(n.scene_id), 0);
    for (const l of graph.links) {
      const src = Number(endpointNodeId(l.source));
      const w = Number(l.weight ?? 1);
      outSum.set(src, (outSum.get(src) ?? 0) + w);
    }
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const [k, v] of outSum.entries()) {
      if (v > bestScore) {
        bestScore = v;
        best = k;
      }
    }
    setBottleneckSceneId(best);
  }, [graph]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setMode("structure");
      if (e.key === "2") void handleEnterSystem();
      if (e.key === "3") setMode("impact");
      if (e.key.toLowerCase() === "r" && mode === "impact" && selectedSceneId !== null) {
        void handleRunSimulationImpact([{ delayed_scene_id: selectedSceneId, delay_days: delayDays }]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedSceneId, delayDays, projectId, graph.nodes.length]);

  function computeConnectedUndirected(sceneId: number): number[] {
    const adjacency = new Map<string, Set<string>>();
    for (const l of graph.links) {
      const src = endpointNodeId(l.source);
      const tgt = endpointNodeId(l.target);
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
    setMode("landing");
    clearRippleTimers();
    setIsTransforming(false);
    if (transformTimeoutRef.current !== null) window.clearTimeout(transformTimeoutRef.current);
    transformTimeoutRef.current = null;
    setAffectedNodes([]);
    setLastSimSummary(null);
    setTimelineBefore([]);
    setTimelineAfter([]);
    setRippleScheduleMs({});
    setRippleOriginSceneId(null);
    setUiError(null);
    setAssistantAnswer(null);
    setMonteCarloStats(null);
    setFilmProjectMeta(null);
    setCinematicAnalytics(null);

    try {
      const res = await analyzeScript({
        script_text: text,
        enable_ai: true,
        max_scenes_for_ai: 20,
      });

      setProjectId(res.project_id);
      setScenes(res.scenes || []);
      setInsights(res.insights || []);
      setFilmProjectMeta(res.film_project_meta || null);
      setCinematicAnalytics(res.cinematic_analytics || null);
      setOverallBudget(res.overall_budget || 0);
      setDialogueActionRatio(res.dialogue_action_ratio || 0);
      setClimaxSceneId(res.climax_scene_id || null);

      const nextSelected = Number(res.scenes?.[0]?.scene_id ?? 1);
      setSelectedSceneId(nextSelected);
      setHoveredSceneId(null);
      setHighlightedSceneIds([nextSelected]);

      // Transform moment: go to STRUCTURE once scenes are ready.
      setMode("structure");
      setIsTransforming(true);
      transformTimeoutRef.current = window.setTimeout(() => {
        setIsTransforming(false);
      }, 950);

      // Load the dependency graph for SYSTEM/IMPACT mode.
      // Non-blocking: if it fails, structure mode still works.
      try {
        setIsLoadingGraph(true);
        const g = await getGraph(res.project_id);
        setGraph(g.graph);
      } catch {
        setUiError("Graph data could not be loaded. Check backend connection and retry.");
      } finally {
        setIsLoadingGraph(false);
      }
    } catch (e: any) {
      const msg = `Analyze failed: ${String(e?.message || e).slice(0, 180)}`;
      setInsights([msg]);
      setUiError(msg);
      setScenes([]);
      setGraph({ nodes: [], links: [] });
      setMode("landing");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleEnterSystem() {
    if (!projectId) return;
    if (!graph.nodes.length) {
      try {
        setIsLoadingGraph(true);
        const g = await getGraph(projectId);
        setGraph(g.graph);
      } catch (e: any) {
        setUiError(`System mode unavailable: ${String(e?.message || e).slice(0, 160)}`);
      } finally {
        setIsLoadingGraph(false);
      }
    }
    // In system mode, highlight bottleneck + selected.
    if (bottleneckSceneId !== null) {
      setHighlightedSceneIds(Array.from(new Set([bottleneckSceneId, selectedSceneId ?? -1])).filter((x) => x > 0));
    } else if (selectedSceneId !== null) {
      setHighlightedSceneIds([selectedSceneId]);
    }
    setMode("system");
  }

  async function handleRunSimulationImpact(
    scenarios: { delayed_scene_id: number; delay_days: number }[] = [],
  ) {
    if (!projectId || scenarios.length === 0) return;
    const primary = scenarios[0];
    setIsSimulating(true);
    clearRippleTimers();
    setTimelineBefore([]);
    setTimelineAfter([]);
    setAffectedNodes([]);

    try {
      let orderedAll: { scene_id: number; delay_days: number }[] = [];
      let seedId = primary.delayed_scene_id;
      let scheduleSourceOriginDelay = 0;

      if (scenarios.length === 1) {
        const res = await runSimulation({
          project_id: projectId,
          delayed_scene_id: primary.delayed_scene_id,
          delay_days: primary.delay_days,
          risk_amplification: riskAmplification,
        });

        orderedAll = [...(res.affected_nodes || [])].sort((a, b) => a.delay_days - b.delay_days);
        seedId = res.delayed_scene_id;
        const origin = orderedAll.find((x) => x.scene_id === seedId) || orderedAll[0];
        scheduleSourceOriginDelay = Number(origin?.delay_days ?? 0);

        setLastSimSummary({ totalDelayDays: res.total_delay_days, totalCostImpact: res.total_cost_impact });
        setInsights(res.insights || insights);
        setTimelineBefore(res.timeline_before || []);
        setTimelineAfter(res.timeline_after || []);
      } else {
        const res = await runMultiSimulation({
          project_id: projectId,
          scenarios,
          risk_amplification: riskAmplification,
        });

        orderedAll = [...(res.combined_affected_nodes || [])].sort((a, b) => a.delay_days - b.delay_days);
        seedId = scenarios[0].delayed_scene_id;

        const origin = orderedAll.find((x) => x.scene_id === seedId) || orderedAll[0];
        scheduleSourceOriginDelay = Number(origin?.delay_days ?? 0);

        setLastSimSummary({
          totalDelayDays: res.total_delay_days_combined,
          totalCostImpact: res.total_cost_impact_combined,
        });
        setInsights(res.insights || insights);
        setTimelineBefore(res.timeline_before || []);
        setTimelineAfter(res.timeline_after_combined || []);
      }

      const originDelayForSchedule = Math.max(1e-6, scheduleSourceOriginDelay);

      const others = orderedAll.filter((x) => x.scene_id !== seedId);
      const maxDelay = Math.max(
        1e-6,
        ...others.map((x) => Number(x.delay_days ?? 0)),
        originDelayForSchedule,
      );
      const delayStep = 130;
      const extra = 520;

      const schedule: Record<number, number> = {};
      schedule[seedId] = 0;
      others.forEach((item, idx) => {
        const norm = clamp01(Number(item.delay_days ?? 0) / maxDelay);
        schedule[item.scene_id] = idx * delayStep + norm * extra + 160;
      });

      setAffectedNodes(orderedAll);
      setRippleScheduleMs(schedule);
      setRippleOriginSceneId(seedId);
      setRippleToken(String(Date.now()));

      setHighlightedSceneIds([seedId]);

      // Progressive reveal matches ring schedule (approx).
      const revealList = [seedId, ...others.map((x) => x.scene_id)];
      const originDelay = schedule[seedId] ?? 0;
      revealList.forEach((id, idx) => {
        const at = (schedule[id] ?? idx * 140) - originDelay;
        const t = window.setTimeout(() => {
          setHighlightedSceneIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        }, Math.max(0, at));
        rippleTimersRef.current.push(t);
      });
      setMode("impact");
      setUiError(null);
    } catch (e: any) {
      setUiError(`Simulation failed: ${String(e?.message || e).slice(0, 160)}`);
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleAskAssistant(question: string) {
    if (!projectId) return;
    setIsAskingAssistant(true);
    try {
      const res = await askAssistant({ project_id: projectId, question });
      setAssistantAnswer(res.answer);
      setUiError(null);
    } catch (e: any) {
      setUiError(`Assistant failed: ${String(e?.message || e).slice(0, 160)}`);
    } finally {
      setIsAskingAssistant(false);
    }
  }

  async function handleRunMonteCarlo(params: {
    delayed_scene_id: number;
    delay_mean_days: number;
    delay_std_days: number;
    runs: number;
  }) {
    if (!projectId) return;
    setIsSimulating(true);
    try {
      const res = await runMonteCarlo({
        project_id: projectId,
        delayed_scene_id: params.delayed_scene_id,
        delay_mean_days: params.delay_mean_days,
        delay_std_days: params.delay_std_days,
        runs: params.runs,
      });
      setMonteCarloStats({
        ...res.stats,
        runs: res.runs,
      });
      if (res.insights?.length) setInsights((prev) => [...res.insights, ...prev].slice(0, 8));
      setUiError(null);
    } catch (e: any) {
      setUiError(`Monte Carlo failed: ${String(e?.message || e).slice(0, 160)}`);
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleExportProject() {
    if (!projectId) return;
    try {
      const payload = await exportProject(projectId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `production-intel-${projectId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setUiError(null);
    } catch (e: any) {
      setUiError(`Export failed: ${String(e?.message || e).slice(0, 160)}`);
    }
  }

  function handleSaveSnapshot() {
    if (!projectId) return;
    const snapshot = {
      ts: Date.now(),
      projectId,
      scenes,
      graph,
      insights,
      selectedSceneId,
      delayDays,
      lastSimSummary,
      affectedNodes,
      timelineBefore,
      timelineAfter,
      bottleneckSceneId,
      filmProjectMeta,
      cinematicAnalytics,
    };
    const key = `script-ai-snapshot-${projectId}`;
    localStorage.setItem(key, JSON.stringify(snapshot));
    setUiError("Snapshot saved locally.");
    window.setTimeout(() => setUiError(null), 1400);
  }

  function handleLoadSnapshot() {
    if (!projectId) return;
    const key = `script-ai-snapshot-${projectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setUiError("No snapshot found for this project.");
      return;
    }
    try {
      const s = JSON.parse(raw);
      setScenes(s.scenes || []);
      setGraph(s.graph || { nodes: [], links: [] });
      setInsights(s.insights || []);
      setSelectedSceneId(s.selectedSceneId ?? null);
      setDelayDays(s.delayDays ?? 2);
      setLastSimSummary(s.lastSimSummary ?? null);
      setAffectedNodes(s.affectedNodes || []);
      setTimelineBefore(s.timelineBefore || []);
      setTimelineAfter(s.timelineAfter || []);
      setBottleneckSceneId(s.bottleneckSceneId ?? null);
      setFilmProjectMeta(s.filmProjectMeta || null);
      setCinematicAnalytics(s.cinematicAnalytics || null);
      setMode("impact");
      setUiError("Snapshot loaded.");
      window.setTimeout(() => setUiError(null), 1400);
    } catch {
      setUiError("Snapshot is corrupted.");
    }
  }

  async function handleCompareScripts() {
    if (!scriptText.trim() || !revisionText.trim()) {
      setUiError("Both base and revision scripts are required for comparison.");
      return;
    }
    setIsTransforming(true);
    try {
      const res = await compareScripts({
        script_text_a: scriptText,
        script_text_b: revisionText,
      });
      setComparisonResult(res);
      setUiError(null);
      // We still update the main project with the revision data so the rest of the UI works
      if (res.revision_data) {
        const rev = res.revision_data;
        setProjectId(rev.project_id);
        setScenes(rev.scenes || []);
        setGraph(rev.graph || { nodes: [], links: [] });
        setInsights(rev.insights || []);
        setFilmProjectMeta(rev.film_project_meta || null);
        setCinematicAnalytics(rev.cinematic_analytics || null);
        setOverallBudget(rev.overall_budget || 0);
        setDialogueActionRatio(rev.dialogue_action_ratio || 0);
        setClimaxSceneId(rev.climax_scene_id || null);
        
        setIsTransforming(true);
        setMode("structure");
        setTimeout(() => setIsTransforming(false), 800);
      }
    } catch (e: any) {
      setUiError(`Comparison failed: ${String(e?.message || e)}`);
    } finally {
      setIsTransforming(false);
    }
  }

  function renderLanding() {
    return (
      <div className="min-h-[100vh] w-full flex items-center justify-center film-grain projector-sweep relative overflow-hidden">
        {/* Ambient Cinema Glow */}
        <div className="absolute inset-0 opacity-90">
          <motion.div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-[radial-gradient(circle_at_top,rgba(212,168,67,0.12),transparent_60%)]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[-120px] top-[180px] w-[540px] h-[540px] bg-[radial-gradient(circle,rgba(192,57,43,0.10),transparent_60%)]"
            animate={{ y: [0, 14, 0], x: [0, 8, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Film Sprocket Decoration */}
        <div className="absolute left-0 top-0 bottom-0 w-6 film-sprockets opacity-40" />
        <div className="absolute right-0 top-0 bottom-0 w-6 film-sprockets opacity-40" />

        <motion.div
          className="glass rounded-3xl p-10 w-[720px] relative overflow-hidden border border-cinema-gold/15 shadow-cinema-gold"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Top Film Reel Icon */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full border-2 border-cinema-gold/40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full border border-cinema-gold/60 bg-cinema-gold/10" />
            </div>
            <div className="text-[10px] tracking-[0.25em] text-cinema-gold/70 uppercase font-body">Screenplay Intelligence Engine</div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="mt-4 text-4xl font-heading font-bold text-cinema-gold leading-tight">
              Cinema Production Lab
            </div>
            <button
              onClick={() => { setIsComparing(!isComparing); setComparisonResult(null); }}
              className={`px-3 py-1.5 rounded-xl border text-[10px] uppercase tracking-widest transition-all ${isComparing ? 'bg-cinema-gold text-black border-cinema-gold font-bold' : 'glass border-white/10 text-white/40 hover:text-white/80'}`}
            >
              {isComparing ? "Comparison Active" : "Compare Drafts"}
            </button>
          </div>
          <div className="mt-1 text-lg font-heading text-white/80 italic">
            AI-Powered Script Risk & Production Intelligence
          </div>
          <div className="mt-3 text-sm text-white/40 font-body leading-relaxed">
            Upload your screenplay. The system analyzes scene dependencies, production risk, budget impact, and generates a full cinematic breakdown.
          </div>

          {/* Divider */}
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-cinema-gold/20 to-transparent" />

          <div
            className="mt-6 rounded-2xl border border-cinema-gold/10 bg-cinema-bg/50 p-5"
            onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault(); setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setScriptText(String(reader.result || ""));
              reader.readAsText(file);
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90 truncate">🎬 Drop your script file</div>
                <div className="text-xs text-white/30 mt-1 truncate">.txt screenplay. Or paste directly below.</div>
              </div>
              <label className="cinema-btn px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cinema-gold shadow-[0_0_12px_rgba(212,168,67,0.5)]" />
                Upload
                <input type="file" accept=".txt" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setScriptText(String(reader.result || ""));
                  reader.readAsText(file);
                }} />
              </label>
            </div>

            <div className={`mt-3 rounded-xl border ${isDragOver ? "border-cinema-gold/30" : "border-cinema-gold/8"} bg-black/20`}>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="text-[11px] text-white/30 font-mono">
                  {isDragOver ? "Release to load…" : pasteOpen ? "✎ Editing" : "✎ Click to paste"}
                </div>
                <button type="button" onClick={() => setPasteOpen((v) => !v)}
                  className="text-[10px] px-3 py-1 rounded-full bg-cinema-surface border border-cinema-gold/10 text-cinema-gold hover:bg-cinema-card transition-colors">
                  {pasteOpen ? "Hide" : "Paste"}
                </button>
              </div>
              {pasteOpen ? (
                <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)}
                  className="w-full h-40 bg-transparent border-t border-cinema-gold/8 px-3 py-3 text-sm text-white/80 font-mono outline-none focus:border-cinema-gold/20 placeholder:text-white/15"
                  placeholder="INT. HOUSE - DAY\nJOHN: We don't have much time..." />
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => {
                setScriptText(SAMPLE_SCRIPT); setPasteOpen(true);
                setUiError("Sample script loaded."); window.setTimeout(() => setUiError(null), 1400);
              }}
                className="rounded-xl border border-white/10 bg-cinema-surface text-white/60 text-[12px] px-4 py-2 hover:bg-cinema-card hover:text-white/80 transition-all">
                Load Sample
              </button>
              <motion.button
                whileHover={{ boxShadow: "0 0 0 1px rgba(212,168,67,0.3), 0 0 40px rgba(212,168,67,0.15)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="rounded-xl bg-gradient-to-r from-cinema-gold to-yellow-600 text-cinema-bg font-bold px-6 py-2.5 text-sm transition-all shadow-cinema-gold disabled:opacity-50">
                {isAnalyzing ? "Analyzing…" : "🎬 Analyze Script"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const showTransformOverlay = isAnalyzing && mode === "landing";

  if (mode === "landing") {
    return (
      <>
        {renderLanding()}
        <AnimatePresence>
          {showTransformOverlay ? (
            <motion.div
              className="fixed inset-0 z-[50] bg-black/80 flex items-center justify-center film-grain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass rounded-3xl px-10 py-8 border border-cinema-gold/15 shadow-cinema-gold max-w-md"
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full border-2 border-cinema-gold/40 animate-reel-spin flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cinema-gold/30" />
                  </div>
                  <div className="text-[10px] tracking-[0.25em] text-cinema-gold/60 uppercase">Processing</div>
                </div>
                <div className="text-white/90 text-lg font-heading font-semibold">Analyzing your screenplay…</div>
                <div className="mt-1 text-white/40 text-sm">Scene structure → Dependency graph → Risk simulation</div>
                <div className="mt-5 h-1.5 rounded-full bg-cinema-surface overflow-hidden border border-cinema-gold/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cinema-gold via-yellow-500 to-cinema-crimson rounded-full"
                    animate={{ x: ["-30%", "60%", "130%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  // Cinematic HUD.
  const totalScenes = scenes.length;
  const avgRisk01 = clamp01(avgRisk / 1.0);
  const riskColor = avgRisk >= 0.66 ? "rgba(239,68,68,1)" : avgRisk >= 0.33 ? "rgba(251,191,36,1)" : "rgba(34,197,94,1)";

  const modeButtons = [
    { id: "structure" as const, label: "📋 STRUCTURE", icon: "" },
    { id: "optimization" as const, label: "⏱ OPTIMIZING", icon: "" },
    { id: "storyboard" as const, label: "🎬 STORYBOARD", icon: "" },
    { id: "casting" as const, label: "🎭 CASTING", icon: "" },
    { id: "system" as const, label: "🔗 SYSTEM", icon: "" },
    { id: "impact" as const, label: "💥 IMPACT", icon: "" },
  ];

  const resBudget = overallBudget || cinematicAnalytics?.expected_budget || 0;

  return (
    <div className="min-h-screen film-grain cinema-vignette projector-sweep relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 studio-beam opacity-80" />
      {/* Film Sprocket Borders */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 film-sprockets opacity-20 z-20" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 film-sprockets opacity-20 z-20" />

      {/* Top HUD - Cinema Branded */}
      <div className="absolute left-6 top-5 z-40 flex items-center gap-3">
        <div className="glass rounded-2xl px-4 py-2.5 border border-cinema-gold/12 shadow-cinema-gold">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-cinema-gold/40 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-cinema-gold/60 shadow-[0_0_8px_rgba(212,168,67,0.6)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.25em] text-cinema-gold/50 uppercase font-body">
                {filmProjectMeta ? "🎥 Film Project" : "🎥 Studio Console"}
              </div>
              <div className="text-[13px] font-heading font-bold text-cinema-gold tabular-nums">
                {filmProjectMeta ? (
                  `${filmProjectMeta.genre} · ${filmProjectMeta.runtime} · ${totalScenes} Scenes`
                ) : (
                  `${totalScenes} Scenes · Health ${Math.max(0, Math.min(100, Math.round(100 * (1 - avgRisk))))}%`
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 h-1 rounded-full bg-cinema-surface overflow-hidden border border-cinema-gold/8">
            <div className="h-full bg-gradient-to-r from-cinema-gold via-yellow-500 to-cinema-crimson" style={{ width: `${Math.round(avgRisk01 * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Center - Call Sheet */}
      <div className="absolute left-1/2 -translate-x-1/2 top-5 z-30 pointer-events-none">
        <div className="glass rounded-2xl px-4 py-2 border border-cinema-gold/10 pointer-events-auto">
          <div className="text-[9px] tracking-[0.2em] uppercase text-cinema-gold/40 font-mono">Call Sheet</div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50 tabular-nums font-mono">
            <span>{filmOps.shootDays.toFixed(1)}d shoot</span>
            <span className="text-cinema-gold/20">·</span>
            <span>{filmOps.outdoor} EXT</span>
            <span className="text-cinema-gold/20">·</span>
            <span>{filmOps.action} ACTION</span>
            <span className="text-cinema-gold/20">·</span>
            <span>wx {(filmOps.weatherRiskAvg * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="absolute right-6 top-5 z-50 flex gap-1.5">
        {modeButtons.map((b) => (
          <motion.button
            key={b.id}
            onClick={() => {
              if (b.id === "system") void handleEnterSystem();
              else if (b.id === "impact") {
                if (!projectId) return;
                setMode("impact");
              } else if (b.id === "optimization") {
                setMode("optimization");
              } else if (b.id === "storyboard") {
                setMode("storyboard");
              } else if (b.id === "casting") {
                setMode("casting");
              } else {
                setMode("structure");
              }
            }}
            disabled={!projectId && b.id !== "structure"}
            className="glass px-3 py-2 rounded-xl text-[10px] tracking-[0.1em] uppercase font-bold font-body"
            style={{
              color: mode === b.id ? "#0a0a0f" : "rgba(212,168,67,0.7)",
              background: mode === b.id ? "linear-gradient(135deg, #d4a843, #c5982e)" : "rgba(22,22,31,0.6)",
              borderColor: mode === b.id ? "rgba(212,168,67,0.4)" : "rgba(212,168,67,0.08)",
              opacity: !projectId && b.id !== "structure" ? 0.35 : 1,
              boxShadow: mode === b.id ? "0 0 20px rgba(212,168,67,0.2)" : "none",
            }}
            whileHover={{ y: -1 }}
          >
            {b.label}
          </motion.button>
        ))}
        {projectId ? (
          <div className="flex gap-1 ml-1">
            <button type="button" onClick={handleSaveSnapshot}
              className="cinema-btn px-2.5 py-2 rounded-xl text-[10px] font-mono">Save</button>
            <button type="button" onClick={handleLoadSnapshot}
              className="cinema-btn px-2.5 py-2 rounded-xl text-[10px] font-mono">Load</button>
            <button type="button" onClick={handleExportProject}
              className="cinema-btn px-2.5 py-2 rounded-xl text-[10px] font-mono">Export</button>
          </div>
        ) : null}
      </div>

      {uiError ? (
        <div className="absolute left-1/2 -translate-x-1/2 top-5 z-40">
          <div className="glass rounded-xl px-4 py-2 border border-cinema-crimson/20 text-[11px] text-red-300 font-mono shadow-cinema-crimson">
            {uiError}
          </div>
        </div>
      ) : null}

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === "storyboard" ? (
          <motion.div
            key="storyboard"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 pb-10 px-6 max-w-[1600px] mx-auto"
          >
            <div className="flex items-center gap-3 mb-6 pl-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cinema-gold shadow-[0_0_24px_rgba(212,168,67,0.35)]" />
              <div className="text-sm text-cinema-gold/80 tracking-[0.18em] uppercase font-heading font-semibold">🎬 Storyboard View</div>
            </div>
            <StoryboardGrid scenes={scenesLite} />
          </motion.div>
        ) : null}

        {mode === "casting" ? (
          <motion.div
            key="casting"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 pb-10 px-6 max-w-[1400px] mx-auto"
          >
            <div className="flex items-center gap-3 mb-6 pl-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cinema-crimson shadow-[0_0_24px_rgba(192,57,43,0.35)]" />
              <div className="text-sm text-cinema-gold/80 tracking-[0.18em] uppercase font-heading font-semibold">🎭 Casting Roster</div>
            </div>
            <CastingBoard castList={filmProjectMeta?.main_cast || []} />
          </motion.div>
        ) : null}

        {mode === "optimization" ? (
          <motion.div
            key="optimization"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 pb-10 px-6 max-w-[1400px] mx-auto"
          >
            <div className="flex items-center gap-3 mb-6 pl-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]" />
              <div className="text-sm text-cinema-gold/80 tracking-[0.18em] uppercase font-heading font-semibold">⏱ Schedule Optimization</div>
            </div>
            {projectId ? (
              <OptimizationBoard projectId={projectId} scenesById={scenesById} />
            ) : (
              <div className="text-slate-500 text-sm mt-8 text-center italic">Analyze a script first to unlock optimization.</div>
            )}
          </motion.div>
        ) : null}

        {mode === "structure" ? (
          <motion.div
            key="structure"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 pb-10 px-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-cinema-neon shadow-[0_0_24px_rgba(56,189,248,0.35)]" />
                <div className="text-sm text-cinema-gold/80 font-heading font-semibold tracking-[0.15em] uppercase">📋 STRUCTURE</div>
              </div>
              <div className="flex gap-4">
                {comparisonResult && (
                  <div className="flex gap-4 text-[10px] font-mono">
                    <span className={comparisonResult.budget_diff >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                      Budget Δ: {comparisonResult.budget_diff >= 0 ? '+' : ''}${comparisonResult.budget_diff.toLocaleString()}
                    </span>
                    <span className={comparisonResult.risk_diff >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                      Risk Δ: {comparisonResult.risk_diff >= 0 ? '+' : ''}{(comparisonResult.risk_diff * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-cinema-crimson/80 tabular-nums font-mono">{highRiskCount} high-risk</div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="glass rounded-2xl px-3 py-2 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Scene Completion</div>
                <div className="mt-1 text-[12px] text-slate-100 tabular-nums">
                  {cinematicAnalytics?.scene_completion_pct?.toFixed(0) || 0}%
                </div>
              </div>
              <div className="glass rounded-2xl px-3 py-2 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Shooting Efficiency</div>
                <div className="mt-1 text-[12px] text-slate-100 tabular-nums">
                  {cinematicAnalytics?.shooting_efficiency?.toFixed(1) || 0}%
                </div>
              </div>
              <div className="glass rounded-2xl px-3 py-2 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Estimated Runtime</div>
                <div className="mt-1 text-[12px] text-slate-100 tabular-nums">
                  {cinematicAnalytics?.estimated_runtime_mins?.toFixed(0) || 0} mins
                </div>
              </div>
              <div className="glass rounded-2xl px-3 py-2 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Expected Budget</div>
                <div className="mt-1 text-[12px] text-emerald-400 font-semibold tabular-nums">
                  ${(resBudget).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
              <div className="glass rounded-3xl border border-slate-800/60 p-4 min-h-[420px]">
                <SceneStrip
                  scenes={scenesLite}
                  selectedSceneId={selectedSceneId}
                  highlightedSceneIds={highlightedSceneIds}
                  hoveredSceneId={hoveredSceneId}
                  onSelectScene={(id) => {
                    setSelectedSceneId(id);
                    setHighlightedSceneIds([id]);
                  }}
                  onHoverScene={setHoveredSceneId}
                />
              </div>
              <div className="space-y-3">
                <div className="glass rounded-3xl border border-slate-800/60 p-4">
                  <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Active scene slate</div>
                  {selectedScene ? (
                    <>
                      <div className="mt-2 text-lg text-slate-100 font-semibold">S{selectedScene.scene_id}</div>
                      <div className="text-[12px] text-slate-400">{selectedScene.location} · {selectedScene.time}</div>
                      <div className="mt-2 text-[12px] text-slate-300">
                        {selectedScene.scene_type || "scene"} · emotion {Math.round(100 * Number(selectedScene.emotion_score ?? 0))}%
                      </div>
                      <div className="mt-2 text-[12px] text-slate-400">
                        Schedule est: {Number(selectedScene.schedule_estimate_days ?? 0).toFixed(1)}d
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-[12px] text-slate-500">Select a scene from the strip.</div>
                  )}
                </div>
                <div className="glass rounded-3xl border border-slate-800/60 p-4">
                  <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Script intelligence</div>
                  <div className="mt-2 text-[12px] text-slate-300 tabular-nums">
                    {scriptMetrics.pageCount.toFixed(1)} pages · {scriptMetrics.totalWords} words
                  </div>
                  <div className="mt-1 text-[12px] text-slate-300 tabular-nums">
                    dialogue avg {(scriptMetrics.avgDialogue * 100).toFixed(0)}% · peak cast {scriptMetrics.castPeak}
                  </div>
                  <div className="mt-1 text-[12px] text-slate-300 tabular-nums">
                    dialogue scenes {scriptMetrics.dialogueScenes} / {totalScenes}
                  </div>
                </div>
                <div className="glass rounded-3xl border border-slate-800/60 p-4">
                  <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Production breakdown</div>
                  {selectedScene ? (
                    <>
                      <div className="mt-2 text-[12px] text-slate-300"><span className="text-slate-500 font-semibold">Cost:</span> ${(selectedScene.scene_cost || 0).toLocaleString()}</div>
                      <div className="mt-1 text-[12px] text-slate-300 break-words"><span className="text-slate-500 font-semibold">Breakdown:</span> {formatCostBreakdown(selectedScene.cost_breakdown)}</div>
                      <div className="mt-1 text-[12px] text-slate-300 break-words"><span className="text-slate-500 font-semibold">Props:</span> {(selectedScene.props_detected || []).join(", ") || "None detected"}</div>
                      <div className="mt-1 text-[12px] text-slate-300 break-words"><span className="text-slate-500 font-semibold">Equipment:</span> {(selectedScene.equipment_req || []).join(", ") || "Standard"}</div>
                      <div className="mt-1 text-[12px] text-slate-300"><span className="text-slate-500 font-semibold">Crew:</span> {selectedScene.crew_req || "Core Unit"}</div>
                    </>
                  ) : <div className="mt-2 text-[12px] text-slate-500">Select scene.</div>}
                </div>
                <div className="glass rounded-3xl border border-slate-800/60 p-4">
                  <div className="text-[10px] tracking-[0.16em] uppercase text-slate-500">Risk modifiers</div>
                  <div className="mt-2 text-[12px] text-slate-300">Retake risk scenes: {scenes.filter((s) => Number(s.retake_risk ?? 0) >= 0.65).length}</div>
                  <div className="mt-1 text-[12px] text-slate-300">Outdoor weather-sensitive: {scenes.filter((s) => Number(s.weather_risk ?? 0) >= 0.4).length}</div>
                  <div className="mt-1 text-[12px] text-slate-300">Crowd setups: {scenes.filter((s) => Boolean(s.crowd_scene)).length}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <StoryAnalytics scenes={scenes} />
              <RiskHeatmap
                scenes={scenes}
                onSelectScene={(id) => {
                  setSelectedSceneId(id);
                  setHighlightedSceneIds([id]);
                }}
                selectedSceneId={selectedSceneId}
              />
            </div>

            <AnimatePresence>
              {isTransforming ? (
                <motion.div
                  key="fracture"
                  className="fixed inset-0 z-[60] flex items-center justify-center film-grain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-black/45"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.div
                    className="relative glass rounded-3xl px-8 py-6 border border-sky-400/10 overflow-hidden"
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.98, opacity: 0 }}
                  >
                    <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">transform</div>
                    <div className="mt-2 text-sm font-semibold text-slate-100">Script → Scenes → Graph</div>
                    <div className="mt-5 relative h-28 w-full overflow-hidden rounded-2xl bg-slate-950/40 border border-slate-800">
                      <motion.div
                        className="absolute -inset-10 bg-gradient-to-r from-cyan-400/0 via-cyan-400/25 to-amber-400/0 blur-xl"
                        animate={{ x: [-40, 40] }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                      />
                      {Array.from({ length: 16 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute h-3 w-3 rounded-full"
                          style={{
                            background:
                              i % 3 === 0 ? "rgba(56,189,248,0.95)" : i % 3 === 1 ? "rgba(251,191,36,0.95)" : "rgba(239,68,68,0.95)",
                          }}
                          initial={{ opacity: 0, x: 0, y: 0, scale: 0.7 }}
                          animate={{
                            opacity: [0, 1, 0],
                            x: Math.cos(i * 0.8) * (46 + i * 2),
                            y: Math.sin(i * 0.8) * (18 + i * 1.6),
                            scale: [0.7, 1.15, 0.7],
                          }}
                          transition={{ duration: 1.0, delay: i * 0.02, repeat: Infinity, repeatType: "mirror" }}
                        />
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {mode === "system" ? (
          <motion.div
            key="system"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 px-6 pb-6"
          >
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 h-[calc(100vh-140px)]">
              <div className="rounded-3xl overflow-hidden border border-sky-400/10 bg-black/20 relative">
                <GraphCanvas
                  graph={systemGraph}
                  selectedSceneId={selectedSceneId}
                  hoveredSceneId={hoveredSceneId}
                  highlightedSceneIds={highlightedSceneIds}
                  bottleneckSceneId={bottleneckSceneId}
                  mode="system"
                  rippleToken={rippleToken}
                  rippleScheduleMs={rippleScheduleMs}
                  rippleOriginSceneId={null}
                  onSelectScene={(id) => {
                    setSelectedSceneId(id);
                    setHighlightedSceneIds(computeConnectedUndirected(id));
                  }}
                  onHoverScene={(id) => setHoveredSceneId(id)}
                />
                {isLoadingGraph ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="glass rounded-2xl px-4 py-2 text-[12px] text-slate-300 border border-sky-400/15">
                      Loading graph…
                    </div>
                  </div>
                ) : null}
              </div>

              <motion.div
                className="glass rounded-2xl px-4 py-3 border border-sky-400/10 overflow-auto"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
              <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500">System layer</div>
              <div className="mt-1 text-sm text-slate-100 tabular-nums">
                {systemGraph.nodes.length} nodes · {systemGraph.links.length} links
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Bottleneck: {bottleneckSceneId ? `S${bottleneckSceneId}` : "—"}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Film load: {filmOps.action} action · {filmOps.outdoor} exterior scenes
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Keys: 1 structure · 2 system · 3 impact · R run</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSystemHighRiskOnly((v) => !v)}
                  className="rounded-lg px-2 py-1 border border-slate-800 bg-slate-950/40 text-slate-200"
                >
                  {systemHighRiskOnly ? "High-risk only" : "All risk"}
                </button>
                <button
                  type="button"
                  onClick={() => setSystemGraphMode((m) => (m === "dependencies" ? "narrative" : "dependencies"))}
                  className="rounded-lg px-2 py-1 border border-slate-800 bg-slate-950/40 text-slate-200"
                >
                  {systemGraphMode === "dependencies" ? "Dependencies" : "Narrative"}
                </button>
                <select
                  value={systemLocationFilter}
                  onChange={(e) => setSystemLocationFilter(e.target.value)}
                  className="rounded-lg px-2 py-1 border border-slate-800 bg-slate-950/40 text-slate-200 col-span-2"
                >
                  <option value="all">All locations</option>
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <select
                  value={systemCharacterFilter}
                  onChange={(e) => setSystemCharacterFilter(e.target.value)}
                  className="rounded-lg px-2 py-1 border border-slate-800 bg-slate-950/40 text-slate-200 col-span-2"
                >
                  <option value="all">All characters</option>
                  {uniqueCharacters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500">Scene focus</div>
                {hoveredSceneId !== null ? (
                  <div className="mt-2">
                    <div className="text-sm font-semibold text-slate-100">S{hoveredSceneId}</div>
                    <div className="text-[11px] text-slate-400">
                      {scenesById[hoveredSceneId]?.location} · {scenesById[hoveredSceneId]?.time}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {(scenesById[hoveredSceneId]?.scene_type || "scene").toString()} · emotion{" "}
                      {Math.round(100 * Math.max(0, Math.min(1, Number(scenesById[hoveredSceneId]?.emotion_score ?? scenesById[hoveredSceneId]?.ai_emotion_intensity ?? 0))))}%
                    </div>
                    {scenesById[hoveredSceneId]?.shot_type ? (
                      <div className="mt-2 bg-slate-900/40 rounded p-2 text-[10px] uppercase tracking-[0.08em] text-slate-400 space-y-1 border border-slate-800">
                        <div><span className="text-slate-500">Shot Layout:</span> {scenesById[hoveredSceneId].shot_type} · {scenesById[hoveredSceneId].camera_angle}</div>
                        <div><span className="text-slate-500">Lighting:</span> {scenesById[hoveredSceneId].lighting_notes}</div>
                        <div><span className="text-slate-500">Audio:</span> {scenesById[hoveredSceneId].sound_notes}</div>
                      </div>
                    ) : null}
                    {scenesById[hoveredSceneId]?.ai_summary ? (
                      <div className="mt-2 text-[12px] text-slate-300 line-clamp-4">{scenesById[hoveredSceneId]?.ai_summary}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-500">Hover a node to inspect scene details.</div>
                )}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500">Graph intelligence</div>
                <div className="mt-2 text-[12px] text-slate-300">
                  Independent shoot candidates:{" "}
                  {
                    (insights.find((x) => x.toLowerCase().includes("parallel candidates")) || "Not detected")
                      .replace("Parallel candidates:", "")
                      .trim()
                  }
                </div>
                <div className="mt-1 text-[12px] text-slate-300">
                  Critical path:{" "}
                  {
                    (insights.find((x) => x.toLowerCase().includes("critical path")) || "Not detected")
                      .replace("Critical path:", "")
                      .trim()
                  }
                </div>
              </div>
              </motion.div>
            </div>

          </motion.div>
        ) : null}

        {mode === "impact" ? (
          <motion.div
            key="impact"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-24 px-6 pb-6"
          >
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
              <div className="space-y-4">
                <div className="h-[calc(100vh-360px)] rounded-3xl overflow-hidden border border-amber-400/10 bg-black/15">
                  <GraphCanvas
                    graph={graph}
                    selectedSceneId={selectedSceneId}
                    hoveredSceneId={hoveredSceneId}
                    highlightedSceneIds={highlightedSceneIds}
                    bottleneckSceneId={bottleneckSceneId}
                    mode="impact"
                    rippleToken={rippleToken}
                    rippleScheduleMs={rippleScheduleMs}
                    rippleRingDurationMs={1000}
                    rippleOriginSceneId={rippleOriginSceneId}
                    onSelectScene={(id) => {
                      setSelectedSceneId(id);
                      setHighlightedSceneIds([id]);
                    }}
                    onHoverScene={(id) => setHoveredSceneId(id)}
                  />
                </div>
                <ImpactTimeline
                  timelineBefore={timelineBefore}
                  timelineAfter={timelineAfter}
                  scenesById={scenesById}
                  affectedSceneIds={highlightedSceneIds}
                  animationKey={rippleToken}
                />
                <div className="glass rounded-2xl border border-amber-400/15 px-3 py-3">
                  <div className="text-[10px] tracking-[0.14em] uppercase text-slate-500">Director Board</div>
                  <div className="mt-2 text-[12px] text-slate-100">
                    {highRiskCount > 0
                      ? `Prioritize coverage for ${highRiskCount} high-risk scenes and lock backup locations.`
                      : "Risk profile stable. Use this window for performance-heavy scenes."}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 tabular-nums">
                    Current seed: {selectedSceneId ? `S${selectedSceneId}` : "—"} · Amp {riskAmplification.toFixed(2)}x
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <SimulationEngineUI
                  className="glass rounded-3xl p-4 border border-slate-800/60"
                  scenes={scenes}
                  selectedSceneId={selectedSceneId}
                  delayDays={delayDays}
                  onChangeSelectedScene={(id) => setSelectedSceneId(id)}
                  onChangeDelayDays={(d) => setDelayDays(d)}
                  riskAmplification={riskAmplification}
                  onChangeRiskAmplification={(v) => setRiskAmplification(v)}
                  onRunSimulation={handleRunSimulationImpact}
                  onRunMonteCarlo={handleRunMonteCarlo}
                  isRunning={isSimulating}
                  lastSimSummary={lastSimSummary}
                  monteCarloStats={monteCarloStats}
                  affectedNodes={affectedNodes}
                  scenesById={scenesById}
                />
                <InsightPanel
                  className="glass rounded-3xl p-4 border border-slate-800/60"
                  insights={insights}
                  scenes={scenes}
                  bottleneckSceneId={bottleneckSceneId}
                  delayedSceneId={selectedSceneId}
                  affectedCount={affectedNodes.length}
                  lastSimSummary={lastSimSummary}
                  scenesById={scenesById}
                  assistantAnswer={assistantAnswer}
                  isAskingAssistant={isAskingAssistant}
                  onAskAssistant={handleAskAssistant}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  );
}


import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

type GraphNode = {
  id: string;
  scene_id: number;
  risk: number;
  risk_level: string;
  risk_color: string;
  complexity: number;
  type: string;
  scene_type?: string;
  emotion_score?: number;
  location: string;
  time: string;
  text_excerpt?: string;
};

type GraphLink = {
  source: any;
  target: any;
  weight: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = (hex || "").replace("#", "").trim();
  if (![3, 6].includes(h.length)) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function endpointSceneId(endpoint: any): number {
  if (typeof endpoint === "number") return endpoint;
  if (typeof endpoint === "string") return Number(endpoint);
  if (endpoint && typeof endpoint === "object") {
    if (endpoint.scene_id !== undefined) return Number(endpoint.scene_id);
    if (endpoint.id !== undefined) return Number(endpoint.id);
  }
  return Number.NaN;
}

export function GraphCanvas(props: {
  graph: { nodes: GraphNode[]; links: GraphLink[] };
  selectedSceneId: number | null;
  hoveredSceneId: number | null;
  highlightedSceneIds: number[];
  bottleneckSceneId?: number | null;
  mode: "system" | "impact";
  // Cascading impact:
  rippleToken: string;
  rippleScheduleMs: Record<number, number>;
  rippleRingDurationMs?: number;
  rippleOriginSceneId?: number | null;
  onSelectScene: (id: number) => void;
  onHoverScene: (id: number | null) => void;
}) {
  const {
    graph,
    selectedSceneId,
    hoveredSceneId,
    highlightedSceneIds,
    bottleneckSceneId = null,
    mode,
    rippleToken,
    rippleScheduleMs,
    rippleRingDurationMs = 900,
    rippleOriginSceneId = null,
    onSelectScene,
    onHoverScene,
  } = props;

  const highlightSet = useMemo(() => new Set(highlightedSceneIds.map((x) => Number(x))), [highlightedSceneIds]);
  const bottleneckSet = bottleneckSceneId !== null ? new Set([bottleneckSceneId]) : new Set<number>();

  const startPerfRef = useRef<number>(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 640 });

  useEffect(() => {
    startPerfRef.current = performance.now();
  }, [rippleToken]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;

    const applySize = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(360, Math.floor(rect.width));
      const height = Math.max(280, Math.floor(rect.height));
      setViewport({ width, height });
    };

    applySize();

    // Some embedded browsers/webviews may not provide ResizeObserver.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => applySize());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", applySize);
    return () => window.removeEventListener("resize", applySize);
  }, []);

  const nodes = useMemo(() => {
    return graph.nodes.map((n) => ({
      ...n,
      val: Math.max(0, Number(n.complexity ?? 0)),
    }));
  }, [graph.nodes]);

  const hasGraph = graph.nodes.length > 0 && graph.links.length >= 0;

  useEffect(() => {
    if (!graphRef.current || !hasGraph) return;
    const t = window.setTimeout(() => {
      try {
        graphRef.current.zoomToFit(450, 30);
      } catch {
        // no-op
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [hasGraph, viewport.width, viewport.height, graph.nodes.length, graph.links.length]);

  const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sceneId = Number(node.scene_id);
    const isHighlighted = highlightSet.has(sceneId);
    const isSelected = selectedSceneId !== null && sceneId === selectedSceneId;
    const isBottleneck = bottleneckSet.has(sceneId);
    const isHighRisk = clamp01(Number(node.risk ?? 0)) >= 0.66;

    const complexity = Number(node.val || 0);
    const radiusBase = Math.max(6, Math.min(28, 5 + complexity * 0.7));

    const now = performance.now();

    const pulse =
      isBottleneck || isHighRisk
        ? 1 + 0.10 * (Math.sin(now / 240 + sceneId * 0.9) + 1) / 2
        : 1;

    const glowBoost = isHighlighted ? 1.35 : 1.0;
    const radius = radiusBase * pulse * glowBoost;

    const fill = node.risk_color || "#94a3b8";
    // Baseline alpha needs to be high enough to remain visible in dark cinematic UI.
    const alpha = isSelected ? 1.0 : isHighlighted ? 0.95 : 0.42;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;

    // Risk glow.
    const glowPx = (isBottleneck ? 26 : isHighRisk ? 18 : 10) / globalScale;
    ctx.shadowColor = fill;
    ctx.shadowBlur = glowPx;
    ctx.fill();

    // Expanding ring for cascading impact.
    if (mode === "impact") {
      const arrival = rippleScheduleMs[sceneId];
      if (typeof arrival === "number") {
        const elapsed = now - startPerfRef.current - arrival;
        if (elapsed >= 0 && elapsed <= rippleRingDurationMs) {
          const p = elapsed / rippleRingDurationMs;
          const ringR = radiusBase + p * (radiusBase * 2.2) + (isBottleneck ? 4 : 0);
          const opacity = (1 - p) * (isSelected ? 1 : 0.9);
          const rgb = hexToRgb(fill);
          if (rgb) {
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity.toFixed(3)})`;
          } else {
            ctx.strokeStyle = `rgba(251,191,36,${opacity.toFixed(3)})`;
          }
          ctx.lineWidth = (isSelected ? 3 : 2) / globalScale;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Thin selection ring.
    if (isSelected) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 2 / globalScale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label only for hovered/selected/bottleneck.
    if (sceneId === hoveredSceneId || isSelected || isBottleneck) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(node.x - radius, node.y - radius * 0.2, radius * 2, radius * 0.6);
      ctx.fillStyle = "white";
      ctx.font = `${Math.max(10, 12 / globalScale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`S${sceneId}`, node.x, node.y);
    }

    ctx.restore();
  };

  // react-force-graph-2d signature: (node, color, ctx, globalScale)
  const nodePointerAreaPaint = (node: any, paintColor: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const complexity = Number(node.val || 0);
    const radius = Math.max(6, Math.min(28, 5 + complexity * 0.7));
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 1.1, 0, Math.PI * 2);
    ctx.fill();
  };

  const linkColor = (link: any) => {
    const srcId = endpointSceneId(link.source);
    const tgtId = endpointSceneId(link.target);
    const highlighted = highlightSet.has(srcId) && highlightSet.has(tgtId);
    return highlighted ? "rgba(251,191,36,0.95)" : "rgba(148,163,184,0.24)";
  };

  const linkWidth = (link: any) => {
    const w = Number(link.weight ?? 1);
    const base = 0.5 + w * 0.45;
    const srcId = endpointSceneId(link.source);
    const tgtId = endpointSceneId(link.target);
    const highlighted = highlightSet.has(srcId) && highlightSet.has(tgtId);
    return highlighted ? base + 1.3 : base * 0.45;
  };

  const originFlashId = rippleOriginSceneId ?? null;

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div className="absolute inset-0 rounded-3xl overflow-hidden">
        <ForceGraph2D
          ref={graphRef}
          graphData={{ nodes, links: graph.links }}
          nodeCanvasObject={drawNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          nodeVal="val"
          width={viewport.width}
          height={viewport.height}
          backgroundColor="rgba(2,6,23,0.65)"
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={1}
          cooldownTicks={110}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enablePointerInteraction={true}
          linkCurvature={0.08}
          dagMode={undefined}
          linkDirectionalParticles={(l: any) => {
            const srcId = endpointSceneId(l.source);
            const tgtId = endpointSceneId(l.target);
            const highlighted = highlightSet.has(srcId) && highlightSet.has(tgtId);
            if (!highlighted) return 0;
            const w = Number(l.weight ?? 1);
            return Math.min(10, Math.max(2, Math.round(w * 3)));
          }}
          linkDirectionalParticleSpeed={0.02}
          onNodeHover={(node: any | null) => {
            if (!node) return onHoverScene(null);
            onHoverScene(Number(node.scene_id));
          }}
          onNodeClick={(node: any) => {
            const id = Number(node.scene_id);
            onSelectScene(id);
          }}
        />
      </div>

      {/* Subtle depth veil (CSS only) */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {!hasGraph ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="glass rounded-3xl px-4 py-3 border border-sky-400/10 text-[11px] text-slate-500">
            Graph loading…
          </div>
        </div>
      ) : null}
      {originFlashId !== null ? (
        <div className="pointer-events-none absolute left-6 top-6 text-[11px] text-slate-500">
          Impact seeded at S{originFlashId}
        </div>
      ) : null}
    </div>
  );
}


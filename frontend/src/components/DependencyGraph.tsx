import React, { useEffect, useMemo, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

export type GraphNode = {
  id: string;
  scene_id: number;
  name: string;
  risk: number;
  risk_level: "Safe" | "Medium" | "High" | string;
  risk_color: string;
  complexity: number;
  type: string;
  location: string;
  time: string;
  text_excerpt: string;
};

export type GraphLink = {
  source: string;
  target: string;
  weight: number;
};

export function DependencyGraph(props: {
  graph: { nodes: GraphNode[]; links: GraphLink[] };
  highlightedSceneIds: number[];
  selectedSceneId: number | null;
  onSelectScene: (sceneId: number) => void;
  onHoverScene: (sceneId: number | null) => void;
  flashSceneId?: number | null;
  flashToken?: string;
  highRiskThreshold?: number;
}) {
  const {
    graph,
    highlightedSceneIds,
    selectedSceneId,
    onSelectScene,
    onHoverScene,
    flashSceneId = null,
    flashToken = "0",
    highRiskThreshold = 0.66,
  } = props;
  const highlightSet = useMemo(() => new Set(highlightedSceneIds), [highlightedSceneIds]);
  const highlightSetStr = useMemo(() => new Set(highlightedSceneIds.map((n) => String(n))), [highlightedSceneIds]);
  const [flashStartPerf, setFlashStartPerf] = useState<number>(0);

  useEffect(() => {
    setFlashStartPerf(performance.now());
  }, [flashToken]);

  const nodes = useMemo(() => {
    return graph.nodes.map((n) => ({
      ...n,
      // react-force-graph uses `val` for sizing.
      val: Math.max(0, n.complexity),
    }));
  }, [graph.nodes]);

  const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightSet.has(Number(node.scene_id));
    const isSelected = selectedSceneId !== null && Number(node.scene_id) === selectedSceneId;
    const isFlash = flashSceneId !== null && Number(node.scene_id) === flashSceneId;

    // Convert complexity (typically ~0-30) into a reasonable radius.
    const complexity = Number(node.val || 0);
    const radiusBase = Math.max(5, Math.min(26, 5 + complexity * 0.7));

    const now = performance.now();
    const risk = Number(node.risk ?? 0);
    const isHighRisk = risk >= highRiskThreshold;

    // Gentle pulse for high-risk nodes (always on).
    const pulse = isHighRisk ? 1 + 0.07 * (Math.sin(now / 260 + Number(node.scene_id) * 0.8) + 1) / 2 : 1;

    // Short flash animation when simulation starts.
    const flashElapsed = isFlash ? Math.max(0, now - flashStartPerf) : Infinity;
    const flashProgress = isFlash ? Math.max(0, 1 - flashElapsed / 750) : 0;
    const flashBoost = isFlash ? 1 + 0.2 * flashProgress * flashProgress : 1;

    const radius = radiusBase * pulse * flashBoost;

    const alpha = isHighlighted ? 1.0 : 0.06;
    const baseFill = node.risk_color || "#94a3b8";
    const glow = isHighlighted ? 18 : isHighRisk ? 12 : 8;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = baseFill;

    ctx.shadowColor = baseFill;
    ctx.shadowBlur = glow / globalScale;
    ctx.fill();

    // Outer ring to make selection pop.
    if (isSelected) {
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
    }

    // Label only for selected/highlighted nodes to avoid clutter.
    if (isSelected || isHighlighted) {
      ctx.globalAlpha = isSelected ? 1.0 : 0.95;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(node.x - radius, node.y - radius * 0.2, radius * 2, radius * 0.6);
      ctx.globalAlpha = isSelected ? 1.0 : 0.95;
      ctx.fillStyle = "white";
      ctx.font = `${Math.max(10, 11 / globalScale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(node.scene_id), node.x, node.y);
    }

    ctx.restore();
  };

  const nodePointerAreaPaint = (node: any, ctx: CanvasRenderingContext2D, globalScale: number, paintColor: string) => {
    const complexity = Number(node.val || 0);
    const radius = Math.max(5, Math.min(26, 5 + complexity * 0.7));
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const linkColor = (link: any) => {
    const src = String(link.source);
    const tgt = String(link.target);
    const highlighted = highlightSetStr.has(src) && highlightSetStr.has(tgt);
    return highlighted ? "rgba(251,191,36,0.92)" : "rgba(148,163,184,0.10)";
  };

  const linkWidth = (link: any) => {
    const src = String(link.source);
    const tgt = String(link.target);
    const highlighted = highlightSetStr.has(src) && highlightSetStr.has(tgt);
    const w = Number(link.weight ?? 1);
    const base = 0.6 + w * 0.55;
    return highlighted ? base + 1.6 : base * 0.45;
  };

  return (
    <div className="glass p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.45)]" />
          Production Dependency Graph
        </div>
        <div className="text-xs text-slate-500">Red/Yellow/Green = risk level · Size = complexity</div>
      </div>

      <div style={{ height: 520 }}>
        <ForceGraph2D
          graph={{ nodes, links: graph.links }}
          nodeCanvasObject={drawNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          nodeVal="val"
          width={820}
          height={520}
          backgroundColor="rgba(2,6,23,0.95)"
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={0.9}
          cooldownTicks={100}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enablePointerInteraction={true}
          linkCurvature={0.08}
          linkDirectionalParticles={(l: any) => {
            const src = String(l.source);
            const tgt = String(l.target);
            const highlighted = highlightSetStr.has(src) && highlightSetStr.has(tgt);
            if (!highlighted) return 0;
            const w = Number(l.weight ?? 1);
            return Math.min(10, Math.max(2, Math.round(w * 3)));
          }}
          linkDirectionalParticleSpeed={0.02}
          onNodeHover={(node: any | null) => {
            if (!node) return onHoverScene(null);
            onHoverScene(Number(node.scene_id));
          }}
          onNodeClick={(node: any) => onSelectScene(Number(node.scene_id))}
        />
      </div>
    </div>
  );
}


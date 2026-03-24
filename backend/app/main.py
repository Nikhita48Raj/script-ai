from __future__ import annotations

import typing
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.logic.graph_builder import build_graph, graph_to_dto
from app.logic.simulator import build_timeline, estimate_cost_impact, simulate_delay
from app.models import (
    AnalyzeScriptRequest,
    AnalyzeScriptResponse,
    AssistantAskRequest,
    AssistantAskResponse,
    GraphResponse,
    GraphData,
    GraphLink,
    SimulationRequest,
    SimulationResponse,
    SimulationSceneEffect,
    MultiSimulationRequest,
    MultiSimulationResponse,
    MultiSimulationScenarioEffect,
    MonteCarloSimulationRequest,
    MonteCarloResultStats,
    MonteCarloSimulationResponse,
    TimelineItem,
    ScriptComparisonRequest,
    ScriptComparisonResponse,
    OptimizeScheduleRequest,
    OptimizeScheduleResponse,
    SimulateWorstCaseRequest,
    SimulateWorstCaseResponse,
)
from app.state import STORE
from app.services.script_pipeline import analyze_script
from app.logic.simulator import simulate_worst_case


app = FastAPI(title="Script-to-Production Risk Lab", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> Dict[str, str]:
    return {"status": "ok"}


def _scene_to_card(scene: Dict[str, Any]):
    # Pydantic will validate and coerce types.
    return scene


@app.post("/analyze-script", response_model=AnalyzeScriptResponse)
def analyze_script_endpoint(req: AnalyzeScriptRequest) -> Any:
    result = analyze_script(
        script_text=req.script_text,
        max_scenes_for_ai=req.max_scenes_for_ai,
        enable_ai=req.enable_ai,
        project_name=req.project_name,
    )
    project_id = result["project_id"]
    STORE.put(project_id, result)

    # Build graph data using the same DTO shape stored by the pipeline.
    G = build_graph(result["scenes"])
    nodes, links = graph_to_dto(G)
    graph_data = GraphData(nodes=nodes, links=links)

    return AnalyzeScriptResponse(
        project_id=project_id,
        scenes=[_scene_to_card(s) for s in result["scenes"]],
        insights=result.get("insights") or [],
        film_project_meta=result.get("film_project_meta"),
        cinematic_analytics=result.get("cinematic_analytics"),
        graph=graph_data
    )


@app.post("/analyze", response_model=AnalyzeScriptResponse)
def analyze_script_endpoint_alias(req: AnalyzeScriptRequest) -> Any:
    # Alias for frontend/API compatibility.
    return analyze_script_endpoint(req)


@app.get("/graph", response_model=GraphResponse)
def get_graph(project_id: str) -> Any:
    project = STORE.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    graph_nodes = project.get("graph_nodes") or []
    graph_links = project.get("graph_links") or []

    graph = GraphData(
        nodes=graph_nodes,
        links=graph_links,
    )

    return GraphResponse(project_id=project_id, graph=graph)


@app.post("/simulate", response_model=SimulationResponse)
def simulate_endpoint(req: SimulationRequest) -> Any:
    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found in project.")

    if req.delayed_scene_id < 1 or req.delayed_scene_id > len(scenes):
        # Scene IDs are 1..N in our parser pipeline.
        raise HTTPException(status_code=400, detail="delayed_scene_id out of range.")

    # Rebuild the graph from stored scenes for correctness.
    G = build_graph(scenes)
    delay_map = simulate_delay(
        G,
        delayed_scene=req.delayed_scene_id,
        delay_days=req.delay_days,
        risk_amplification=req.risk_amplification,
    )
    total_cost = estimate_cost_impact(G, delay_map)

    scenes_order = sorted(int(s["scene_id"]) for s in scenes)

    timeline_before = build_timeline(G, scenes_order=scenes_order, extra_delay_map={})
    timeline_after = build_timeline(G, scenes_order=scenes_order, extra_delay_map=delay_map)

    affected_nodes = [
        SimulationSceneEffect(scene_id=sid, delay_days=delay_map[sid])
        for sid in sorted(delay_map.keys())
    ]

    graph_affected_node_ids = [str(s.scene_id) for s in affected_nodes]

    sim_insights = [
        f"Simulation: Scene {req.delayed_scene_id} delayed by {req.delay_days:.2f} day(s).",
        f"Estimated total cost impact: {total_cost:,.0f}.",
    ]

    return SimulationResponse(
        project_id=req.project_id,
        delayed_scene_id=req.delayed_scene_id,
        delay_days=req.delay_days,
        total_delay_days=float(max((t["end_day"] for t in timeline_after), default=0.0) - max((t["end_day"] for t in timeline_before), default=0.0)),
        total_cost_impact=total_cost,
        affected_nodes=affected_nodes,
        graph_affected_node_ids=graph_affected_node_ids,
        timeline_before=[TimelineItem(**x) for x in timeline_before],
        timeline_after=[TimelineItem(**x) for x in timeline_after],
        insights=(typing.cast(List[str], project.get("insights") or []))[:2] + sim_insights,
    )


@app.post("/simulate-multi", response_model=MultiSimulationResponse)
def simulate_multi_endpoint(req: MultiSimulationRequest) -> Any:
    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found in project.")

    G = build_graph(scenes)
    scenes_order = sorted(int(s["scene_id"]) for s in scenes)

    timeline_before = build_timeline(G, scenes_order=scenes_order, extra_delay_map={})

    scenario_effects: List[MultiSimulationScenarioEffect] = []
    combined_delay_map: Dict[int, float] = {}
    combined_graph_ids: set[str] = set()

    for sc in req.scenarios:
        delay_map = simulate_delay(
            G,
            delayed_scene=sc.delayed_scene_id,
            delay_days=sc.delay_days,
            risk_amplification=req.risk_amplification,
        )
        total_cost = estimate_cost_impact(G, delay_map)

        affected_nodes = [
            SimulationSceneEffect(scene_id=sid, delay_days=delay_map[sid]) for sid in sorted(delay_map.keys())
        ]
        graph_ids = [str(s.scene_id) for s in affected_nodes]

        scenario_effects.append(
            MultiSimulationScenarioEffect(
                delayed_scene_id=sc.delayed_scene_id,
                delay_days=sc.delay_days,
                affected_nodes=affected_nodes,
                graph_affected_node_ids=graph_ids,
                total_delay_days=float(sum(delay_map.values())),
                total_cost_impact=total_cost,
            )
        )

        for sid, dv in delay_map.items():
            combined_delay_map[sid] = max(combined_delay_map.get(sid, 0.0), dv)
        combined_graph_ids.update(graph_ids)

    timeline_after_combined = build_timeline(G, scenes_order=scenes_order, extra_delay_map=combined_delay_map)
    total_cost_combined = estimate_cost_impact(G, combined_delay_map)

    combined_affected_nodes = [
        SimulationSceneEffect(scene_id=sid, delay_days=combined_delay_map[sid]) for sid in sorted(combined_delay_map.keys())
    ]

    total_delay_combined = float(
        max((t["end_day"] for t in timeline_after_combined), default=0.0)
        - max((t["end_day"] for t in timeline_before), default=0.0)
    )

    return MultiSimulationResponse(
        project_id=req.project_id,
        scenarios=scenario_effects,
        combined_affected_nodes=combined_affected_nodes,
        combined_graph_affected_node_ids=sorted(list(combined_graph_ids)),
        total_cost_impact_combined=total_cost_combined,
        total_delay_days_combined=total_delay_combined,
        timeline_before=[TimelineItem(**x) for x in timeline_before],
        timeline_after_combined=[TimelineItem(**x) for x in timeline_after_combined],
        insights=(typing.cast(List[str], project.get("insights") or []))[:2],
    )


@app.post("/simulate-monte-carlo", response_model=MonteCarloSimulationResponse)
def simulate_monte_carlo_endpoint(req: MonteCarloSimulationRequest) -> Any:
    import random
    import math

    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found in project.")

    G = build_graph(scenes)

    # Box-Muller transform for normal sampling.
    def sample_normal(mean: float, std: float) -> float:
        u1 = random.random()
        u2 = random.random()
        z0 = math.sqrt(-2.0 * math.log(max(u1, 1e-9))) * math.cos(2.0 * math.pi * u2)
        return mean + z0 * std

    total_delay_samples: List[float] = []
    cost_samples: List[float] = []

    for _ in range(req.runs):
        sampled = sample_normal(req.delay_mean_days, req.delay_std_days)
        sampled = max(0.0, min(365.0, sampled))
        delay_map = simulate_delay(G, delayed_scene=req.delayed_scene_id, delay_days=sampled)
        total_cost = estimate_cost_impact(G, delay_map)
        total_delay_samples.append(float(sum(delay_map.values())))
        cost_samples.append(float(total_cost))

    total_delay_samples.sort()
    cost_samples.sort()
    idx_p95 = max(0, int(0.95 * (len(total_delay_samples) - 1)))
    expected_delay = float(sum(total_delay_samples) / max(1, len(total_delay_samples)))
    expected_cost = float(sum(cost_samples) / max(1, len(cost_samples)))

    p95_delay = total_delay_samples[idx_p95]
    p95_cost = cost_samples[idx_p95]

    return MonteCarloSimulationResponse(
        project_id=req.project_id,
        delayed_scene_id=req.delayed_scene_id,
        runs=req.runs,
        stats=MonteCarloResultStats(
            expected_total_delay_days=expected_delay,
            p95_total_delay_days=p95_delay,
            expected_total_cost_impact=expected_cost,
            p95_total_cost_impact=p95_cost,
        ),
        insights=[f"Monte Carlo (n={req.runs}) estimates variability for delayed Scene {req.delayed_scene_id}."],
    )


@app.post("/assistant/ask", response_model=AssistantAskResponse)
def assistant_ask(req: AssistantAskRequest) -> Any:
    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes in project.")

    # Heuristic assistant answer grounded in computed data.
    q = req.question.lower()
    by_risk = sorted(scenes, key=lambda s: float(s.get("risk", 0.0)), reverse=True)
    top = by_risk[0] if by_risk else None

    if "bottleneck" in q or "critical" in q:
        # Weighted out-degree bottleneck.
        G = build_graph(scenes)
        best = None
        best_score = -1.0
        for nid in G.nodes():
            score = sum(float(G[nid][succ].get("weight", 1.0)) for succ in G.successors(nid))
            if score > best_score:
                best_score = score
                best = int(nid)
        answer = (
            f"Scene {best} is the strongest bottleneck based on weighted downstream dependencies."
            if best is not None
            else "No bottleneck found."
        )
    elif "risk" in q:
        if top is None:
            answer = "No scenes available for risk analysis."
        else:
            answer = (
                f"Highest-risk is Scene {top['scene_id']} "
                f"(risk {float(top.get('risk', 0.0)):.2f}, {top.get('type','')} {top.get('time','')})."
            )
    elif "location" in q or "group" in q or "optimize" in q:
        loc_map: Dict[str, List[int]] = {}
        for s in scenes:
            loc = (s.get("location") or "").strip()
            if not loc:
                continue
            loc_map.setdefault(loc, []).append(int(s["scene_id"]))
        groups = sorted([(k, v) for k, v in loc_map.items() if len(v) >= 2], key=lambda x: len(x[1]), reverse=True)
        if groups:
            loc, ids = groups[0]
            answer = f"Best location batch is {loc}: Scenes {', '.join(map(str, ids[:5]))}."
        else:
            answer = "No strong same-location batching opportunities were found."
    else:
        avg_risk = sum(float(s.get("risk", 0.0)) for s in scenes) / max(1, len(scenes))
        high = [s for s in scenes if float(s.get("risk", 0.0)) >= 0.66]
        answer = (
            f"This project has {len(scenes)} scenes, average risk {avg_risk:.2f}, "
            f"and {len(high)} high-risk scene(s). Ask about bottlenecks, risk, or location optimization."
        )

    return AssistantAskResponse(
        project_id=req.project_id,
        question=req.question,
        answer=answer,
    )


@app.get("/project/export")
def export_project(project_id: str) -> Any:
    project = STORE.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")

    scenes = project.get("scenes") or []
    graph_nodes = project.get("graph_nodes") or []
    graph_links = project.get("graph_links") or []
    insights = project.get("insights") or []

    avg_risk = 0.0
    if scenes:
        avg_risk = sum(float(s.get("risk", 0.0)) for s in scenes) / len(scenes)

    return {
        "project_id": project_id,
        "summary": {
            "scene_count": len(scenes),
            "avg_risk": round(avg_risk, 3),
            "high_risk_count": len([s for s in scenes if float(s.get("risk", 0.0)) >= 0.66]),
            "node_count": len(graph_nodes),
            "link_count": len(graph_links),
        },
        "scenes": scenes,
        "graph": {"nodes": graph_nodes, "links": graph_links},
        "insights": insights,
    }


@app.post("/simulate-worst-case", response_model=SimulateWorstCaseResponse)
def simulate_worst_case_endpoint(req: SimulateWorstCaseRequest) -> Any:
    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")
        
    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found.")
        
    G = build_graph(scenes)
    res = simulate_worst_case(G, scenes)
    
    insights = [f"Worst Case: Scene {res['worst_scene_id']} delay causes {res['max_delay_days']} days total cascade delay."]
    
    return SimulateWorstCaseResponse(
        project_id=req.project_id,
        worst_scene_id=res["worst_scene_id"],
        max_delay_days=res["max_delay_days"],
        max_cost_impact=res["max_cost_impact"],
        insights=insights
    )


@app.post("/optimize-schedule", response_model=OptimizeScheduleResponse)
def optimize_schedule_endpoint(req: OptimizeScheduleRequest) -> Any:
    project = STORE.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project_id")
        
    scenes: List[dict] = project.get("scenes") or []
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found.")

    # Auto-Reordering Magic: Group by Location, Time of Day, ascending complexity
    sorted_scenes = sorted(
        scenes,
        key=lambda s: (
            str(s.get("location_classification", "")),
            str(s.get("time", "")).lower(),
            float(s.get("complexity", 0.0))
        )
    )
    
    optimal_order = [int(s["scene_id"]) for s in sorted_scenes]
    total_days = sum(float(s.get("schedule_estimate_days", 0.0)) for s in sorted_scenes)
    insights = ["Schedule sequence optimized: Grouped by matching indoor/outdoor locations and day/night requirements to minimize company moves."]
    
    return OptimizeScheduleResponse(
        project_id=req.project_id,
        optimal_order=optimal_order,
        total_estimated_days=float(int(total_days * 100) / 100.0),
        schedule_insights=insights
    )


@app.post("/compare-scripts", response_model=ScriptComparisonResponse)
def compare_scripts_endpoint(req: ScriptComparisonRequest) -> Any:
    res_a = analyze_script(req.script_text_a, 12, False, "Script A")
    res_b = analyze_script(req.script_text_b, 12, False, "Script B")
    
    STORE.put(res_a["project_id"], res_a)
    STORE.put(res_b["project_id"], res_b)
    
    risk_a = sum(float(s.get("risk", 0)) for s in res_a["scenes"]) / max(1, len(res_a["scenes"]))
    risk_b = sum(float(s.get("risk", 0)) for s in res_b["scenes"]) / max(1, len(res_b["scenes"]))
    
    budget_a = sum(float(s.get("scene_cost", 0)) for s in res_a["scenes"])
    budget_b = sum(float(s.get("scene_cost", 0)) for s in res_b["scenes"])
    
    diff_r = float(int((risk_b - risk_a) * 1000) / 1000.0)
    diff_b = float(int((budget_b - budget_a) * 100) / 100.0)
    
    # Populate graphs for both (though revision_data is the one usually needed)
    G_a = build_graph(res_a["scenes"])
    nodes_a, links_a = graph_to_dto(G_a)
    res_a["graph"] = {"nodes": nodes_a, "links": links_a}
    G_b = build_graph(res_b["scenes"])
    nodes_b, links_b = graph_to_dto(G_b)
    res_b["graph"] = {"nodes": nodes_b, "links": links_b}
    
    insights = [f"Difference metrics calculated. Draft B changes base estimated budget by ${diff_b:,.0f} and adjusts net risk exposure by {(diff_r * 100):.1f}%."]
    
    return ScriptComparisonResponse(
        project_id_a=res_a["project_id"],
        project_id_b=res_b["project_id"],
        risk_diff=diff_r,
        budget_diff=diff_b,
        insights=insights,
        revision_data=AnalyzeScriptResponse(**res_b)
    )


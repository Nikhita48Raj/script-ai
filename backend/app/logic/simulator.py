from __future__ import annotations

from typing import Dict, List, Tuple

import networkx as nx


def simulate_delay(
    graph: nx.DiGraph,
    delayed_scene: int,
    delay_days: float,
    risk_amplification: float = 0.30,
) -> Dict[int, float]:
    """
    Propagate delay through outgoing edges.

    Returns a map: scene_id(int) -> propagated extra delay (float days).
    """
    delayed_scene_id = str(delayed_scene)
    affected: Dict[str, float] = {}
    queue: List[Tuple[str, float]] = [(delayed_scene_id, float(delay_days))]

    while queue:
        current, delay = queue.pop(0)
        if current in affected:
            affected[current] = max(affected[current], delay)
        else:
            affected[current] = delay

        for neighbor in graph.successors(current):
            edge_weight = graph[current][neighbor].get("weight", 1.0)
            neighbor_risk = float(graph.nodes.get(str(neighbor), {}).get("risk", 0.0))
            propagated_delay = delay * float(edge_weight) * (1.0 + risk_amplification * neighbor_risk)
            # Prevent exploding values in dense graphs.
            propagated_delay = min(propagated_delay, float(delay_days) * 10.0 + 365.0)
            queue.append((str(neighbor), propagated_delay))

    return {int(k): float(v) for k, v in affected.items()}


def estimate_cost_impact(graph: nx.DiGraph, delay_map: Dict[int, float]) -> float:
    total_cost = 0.0

    for scene_id, delay in delay_map.items():
        node = graph.nodes.get(str(scene_id), {})
        complexity = float(node.get("complexity", 0.0))
        risk = float(node.get("risk", 0.0))

        # Keep demo-friendly cost magnitude; clamp delay effect.
        delay = min(float(delay), 365.0)
        complexity = min(complexity, 200.0)

        cost = delay * complexity * (1.0 + risk) * 1200.0
        total_cost += cost

    return round(total_cost, 2)


def simulate_worst_case(graph: nx.DiGraph, scenes: List[dict]) -> dict:
    worst_node = -1
    max_cost = -1.0
    max_delay = -1.0
    
    for s in scenes:
        sid = int(s["scene_id"])
        # We test a baseline severe delay (e.g. 5 days) on each node
        d_map = simulate_delay(graph, sid, 5.0, 1.0)
        cost = estimate_cost_impact(graph, d_map)
        delay_sum = sum(d_map.values())
        if cost > max_cost:
            max_cost = cost
            max_delay = delay_sum
            worst_node = sid
            
    return {
        "worst_scene_id": worst_node,
        "max_delay_days": round(max_delay, 2),
        "max_cost_impact": round(max_cost, 2),
    }


def _scene_duration_days(complexity: float) -> float:
    # A simple mapping from complexity to schedule duration.
    # Clamp to keep timeline readable.
    return round(min(max(0.4, 0.5 + complexity / 60.0), 3.0), 2)


def build_timeline(graph: nx.DiGraph, scenes_order: List[int], extra_delay_map: Dict[int, float]) -> List[dict]:
    """
    Builds a sequential schedule timeline, shifting scene start times by extra delays.
    """
    timeline: List[dict] = []
    prev_end = 0.0

    for idx, scene_id in enumerate(scenes_order):
        node = graph.nodes[str(scene_id)]
        duration = _scene_duration_days(float(node.get("complexity", 0.0)))

        base_start = float(idx) * 1.0
        extra = float(extra_delay_map.get(scene_id, 0.0))

        start = max(prev_end, base_start + extra)
        end = start + duration
        timeline.append(
            {
                "scene_id": scene_id,
                "start_day": round(start, 2),
                "end_day": round(end, 2),
                "duration_days": round(duration, 2),
            }
        )
        prev_end = end

    return timeline


from __future__ import annotations

from typing import Dict, List, Tuple

import networkx as nx


def share_characters(scene1: dict, scene2: dict) -> bool:
    return scene1.get("num_characters", 0) > 0 and scene2.get("num_characters", 0) > 0


def same_location(scene1: dict, scene2: dict) -> bool:
    return (scene1.get("location") or "").strip() == (scene2.get("location") or "").strip()


def build_graph(scenes: List[dict]) -> nx.DiGraph:
    G = nx.DiGraph()

    for scene in scenes:
        G.add_node(str(scene["scene_id"]), **scene)

    # Baseline sequential edges
    for i in range(len(scenes) - 1):
        G.add_edge(str(scenes[i]["scene_id"]), str(scenes[i + 1]["scene_id"]), weight=1.0)

    # Smarter dependencies
    for i in range(len(scenes)):
        for j in range(i + 1, len(scenes)):
            s1 = scenes[i]
            s2 = scenes[j]
            is_same_loc = same_location(s1, s2)
            is_share_char = share_characters(s1, s2)
            if is_same_loc and is_share_char:
                G.add_edge(str(s1["scene_id"]), str(s2["scene_id"]), weight=3.0)
            elif is_same_loc:
                G.add_edge(str(s1["scene_id"]), str(s2["scene_id"]), weight=2.0)
            elif is_share_char:
                G.add_edge(str(s1["scene_id"]), str(s2["scene_id"]), weight=1.5)

    return G

def compute_impact_radius(G: nx.DiGraph, node_id: str) -> int:
    seen = set()
    stack = [node_id]
    while stack:
        curr = stack.pop()
        for succ in G.successors(curr):
            if succ not in seen:
                seen.add(succ)
                stack.append(succ)
    return len(seen)

    return G


def graph_to_dto(G: nx.DiGraph) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    links: List[dict] = []

    for node_id, data in G.nodes(data=True):
        nodes.append(
            {
                "id": str(node_id),
                "scene_id": int(data.get("scene_id")),
                "name": f"Scene {data.get('scene_id')}",
                "risk": float(data.get("risk", 0.0)),
                "risk_level": data.get("risk_level", "Safe"),
                "risk_color": data.get("risk_color", "#22c55e"),
                "complexity": float(data.get("complexity", 0.0)),
                "type": str(data.get("type", "")),
                "scene_type": str(data.get("scene_type", data.get("type", ""))),
                "location": str(data.get("location", "")),
                "time": str(data.get("time", "")),
                "emotion_score": float(data.get("emotion_score", data.get("ai_emotion_intensity", 0.0) or 0.0)),
                "text_excerpt": (data.get("text_excerpt") or "").strip(),
                "impact_radius": compute_impact_radius(G, str(node_id)),
            }
        )

    for u, v, data in G.edges(data=True):
        weight = float(data.get("weight", 1.0))
        dist_layer = "Strong" if weight >= 2.0 else "Medium" if weight > 1.0 else "Weak"
        links.append(
            {
                "source": str(u),
                "target": str(v),
                "weight": weight,
                "dependency_layer": dist_layer
            }
        )

    return nodes, links


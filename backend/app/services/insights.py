from __future__ import annotations

from typing import Dict, List, Tuple

import networkx as nx


def generate_insights(scenes: List[dict], graph: nx.DiGraph) -> List[str]:
    """
    Rule-based insights derived from the same features used for risk & graph.
    This keeps the demo consistent even if the LLM is rate-limited.
    """
    by_id: Dict[int, dict] = {int(s["scene_id"]): s for s in scenes}
    insights: List[str] = []

    # 1) Bottleneck detection (highest weighted outgoing influence)
    bottleneck: int | None = None
    best_score = -1.0
    for node_id in graph.nodes():
        node_risk = float(graph.nodes[node_id].get("risk", 0.0))
        score = 0.0
        for succ in graph.successors(node_id):
            score += float(graph[node_id][succ].get("weight", 1.0)) * (1.0 + 0.25 * float(graph.nodes[succ].get("risk", 0.0)))
        # Slightly prefer high-risk scenes for narrative clarity.
        score *= 1.0 + 0.15 * node_risk
        if score > best_score:
            best_score = score
            bottleneck = int(node_id)

    if bottleneck is not None:
        # Downstream reach (directed)
        seen: set[int] = set()
        stack = [bottleneck]
        while stack:
            cur = stack.pop()
            for nxt in graph.successors(str(cur)):
                nid = int(nxt)
                if nid in seen:
                    continue
                seen.add(nid)
                stack.append(nid)
        downstream = sorted(seen)

        s = by_id.get(bottleneck, {})
        st = str(s.get("type", ""))
        tm = str(s.get("time", ""))
        tags: List[str] = []
        if st.upper() == "EXT":
            tags.append("outdoor")
        if "NIGHT" in tm.upper():
            tags.append("night shoot")
        if not tags:
            tags.append("high coupling")

        if downstream:
            insights.append(
                f"Bottleneck: Scene {bottleneck} ({', '.join(tags)}) drives {len(downstream)} downstream scene(s)."
            )
        else:
            insights.append(f"Bottleneck: Scene {bottleneck} is the strongest production coupling point.")

    # 2) High-risk callouts
    high = [s for s in scenes if float(s.get("risk", 0.0)) >= 0.66]
    for s in sorted(high, key=lambda x: float(x.get("risk", 0.0)), reverse=True)[:3]:
        st = str(s.get("type", ""))
        tm = str(s.get("time", ""))
        reason: List[str] = []
        if st.upper() == "EXT":
            reason.append("outdoor")
        if "NIGHT" in tm.upper():
            reason.append("night")
        if not reason:
            reason.append("complex")
        insights.append(f"High-risk: Scene {s['scene_id']} flagged for {', '.join(reason)}.")

    # 3) Parallel shoot suggestions (same location, low dependency conflict)
    loc_map: Dict[str, List[int]] = {}
    for s in scenes:
        loc = (s.get("location") or "").strip()
        if not loc:
            continue
        loc_map.setdefault(loc, []).append(int(s["scene_id"]))

    def can_parallel(a: int, b: int) -> bool:
        # If directed dependency exists either way, treat as not parallel-safe.
        try:
            if nx.has_path(graph, str(a), str(b)) or nx.has_path(graph, str(b), str(a)):
                return False
        except nx.NetworkXError:
            return True
        return True

    candidate_groups: List[tuple[str, List[int]]] = []
    for loc, ids in loc_map.items():
        if len(ids) < 2:
            continue
        # Check if at least pair is parallel-safe.
        safe_ids: List[int] = []
        for i in range(len(ids)):
            a = ids[i]
            ok = True
            for j in range(len(ids)):
                if i == j:
                    continue
                if not can_parallel(a, ids[j]):
                    ok = False
                    break
            if ok:
                safe_ids.append(a)
        if len(safe_ids) >= 2:
            candidate_groups.append((loc, sorted(safe_ids)))

    candidate_groups.sort(key=lambda x: len(x[1]), reverse=True)
    if candidate_groups:
        loc, ids = candidate_groups[0]
        # Actor conflicts for the suggested set.
        overlap_counts: Dict[str, int] = {}
        for sid in ids:
            chars = by_id.get(sid, {}).get("characters") or []
            for c in chars:
                overlap_counts[str(c)] = overlap_counts.get(str(c), 0) + 1
        conflicts = [c for c, cnt in overlap_counts.items() if cnt >= 2]
        if conflicts:
            insights.append(
                f"Parallel-safe location: {loc} (Scenes {', '.join(map(str, ids[:3]))}). Actor overlap detected: {', '.join(conflicts[:3])}."
            )
        else:
            insights.append(f"Parallel-safe location: {loc}. Group Scenes {', '.join(map(str, ids[:3]))}.")

    # 4) Location optimization fallback (any same-location batching)
    shared_locations = [(loc, ids) for loc, ids in loc_map.items() if len(ids) >= 2]
    shared_locations.sort(key=lambda x: len(x[1]), reverse=True)
    if shared_locations:
        loc, ids = shared_locations[0]
        insights.append(f"Optimize logistics: batch Scenes {', '.join(map(str, ids[:4]))} at {loc}.")

    # 5) Risk clusters (graph-coupled high risk)
    cluster_start = [s for s in scenes if float(s.get("risk", 0.0)) >= 0.66]
    if cluster_start:
        seed = int(sorted(cluster_start, key=lambda x: float(x.get("risk", 0.0)), reverse=True)[0]["scene_id"])
        seen = set([seed])
        stack = [seed]
        while stack:
            cur = stack.pop()
            for succ in graph.successors(str(cur)):
                succ_id = int(succ)
                if succ_id in seen:
                    continue
                if float(by_id.get(succ_id, {}).get("risk", 0.0)) >= 0.5:
                    seen.add(succ_id)
                    stack.append(succ_id)
        if len(seen) >= 2:
            cluster_ids = sorted(seen)
            insights.append(f"Risk cluster: {', '.join(map(str, cluster_ids[:5]))} around Scene {seed}.")

    # 6) Critical path (longest weighted dependency chain)
    try:
        if nx.is_directed_acyclic_graph(graph):
            path = nx.dag_longest_path(graph, weight="weight")
            if path and len(path) >= 2:
                path_ids = [int(x) for x in path]
                insights.append(f"Critical path: {' -> '.join(map(str, path_ids[:6]))}.")
        else:
            dag = nx.DiGraph()
            dag.add_nodes_from(graph.nodes(data=True))
            dag.add_edges_from((u, v, d) for u, v, d in graph.edges(data=True) if int(u) < int(v))
            if dag.number_of_edges() > 0 and nx.is_directed_acyclic_graph(dag):
                path = nx.dag_longest_path(dag, weight="weight")
                if path and len(path) >= 2:
                    path_ids = [int(x) for x in path]
                    insights.append(f"Critical path: {' -> '.join(map(str, path_ids[:6]))}.")
    except Exception:
        pass

    # 7) Parallel scenes (independent nodes with no dependency path either way)
    independent_pairs: List[Tuple[int, int]] = []
    ids = [int(s["scene_id"]) for s in scenes]
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a = ids[i]
            b = ids[j]
            try:
                if not nx.has_path(graph, str(a), str(b)) and not nx.has_path(graph, str(b), str(a)):
                    independent_pairs.append((a, b))
            except Exception:
                continue
            if len(independent_pairs) >= 3:
                break
        if len(independent_pairs) >= 3:
            break
    if independent_pairs:
        pair_txt = ", ".join([f"{a}&{b}" for a, b in independent_pairs[:3]])
        insights.append(f"Parallel candidates: {pair_txt}.")

    # 8) Production score from risk + complexity + dependencies
    if scenes:
        avg_risk = sum(float(s.get("risk", 0.0)) for s in scenes) / len(scenes)
        avg_complexity = sum(float(s.get("complexity", 0.0)) for s in scenes) / len(scenes)
        dep_density = graph.number_of_edges() / max(1, graph.number_of_nodes() * 2)
        raw = 100.0 - (avg_risk * 45.0 + min(avg_complexity, 30.0) * 1.2 + dep_density * 35.0)
        score = int(max(0.0, min(100.0, raw)))
        insights.append(f"Production score: {score}/100 based on risk, complexity, and dependency load.")

    # Trim
    return insights[:8]


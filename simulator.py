def simulate_delay(graph, delayed_scene, delay_days=1):
    affected = {}
    queue = [(delayed_scene, delay_days)]

    while queue:
        current, delay = queue.pop(0)

        if current in affected:
            affected[current] = max(affected[current], delay)
        else:
            affected[current] = delay

        for neighbor in graph.successors(current):
            edge_weight = graph[current][neighbor].get("weight", 1)

            # Weighted propagation
            propagated_delay = delay * edge_weight

            queue.append((neighbor, propagated_delay))

    return affected


def estimate_cost_impact(graph, delay_map):
    total_cost = 0

    for scene_id, delay in delay_map.items():
        scene = graph.nodes[scene_id]

        complexity = scene["complexity"]
        risk = scene["risk"]

        # Improved cost formula
        cost = delay * complexity * (1 + risk) * 1200

        total_cost += cost

    return round(total_cost, 2)


def print_simulation(delay_map, total_cost):
    print("\n--- SIMULATION RESULT ---\n")

    for scene_id, delay in delay_map.items():
        print(f"Scene {scene_id} delayed by {round(delay,2)} day(s)")

    print(f"\nTotal Cost Impact: ₹{total_cost}")
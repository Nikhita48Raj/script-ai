import networkx as nx


def share_characters(scene1, scene2):
    # simple proxy: if both have characters > 0
    return scene1["num_characters"] > 0 and scene2["num_characters"] > 0


def same_location(scene1, scene2):
    return scene1["location"] == scene2["location"]


def build_graph(scenes):
    G = nx.DiGraph()

    # Add nodes
    for scene in scenes:
        G.add_node(scene["scene_id"], **scene)

    # Sequential edges (baseline)
    for i in range(len(scenes) - 1):
        G.add_edge(scenes[i]["scene_id"], scenes[i + 1]["scene_id"], weight=1)

    # Add smarter dependencies
    for i in range(len(scenes)):
        for j in range(i + 1, len(scenes)):
            s1 = scenes[i]
            s2 = scenes[j]

            # Same location → strong dependency
            if same_location(s1, s2):
                G.add_edge(s1["scene_id"], s2["scene_id"], weight=2)

            # Shared characters → medium dependency
            elif share_characters(s1, s2):
                G.add_edge(s1["scene_id"], s2["scene_id"], weight=1.5)

    return G


def print_graph(G):
    print("\n--- GRAPH STRUCTURE ---\n")

    for node_id, data in G.nodes(data=True):
        print(f"Scene {node_id} | Risk: {data['risk']} | Location: {data['location']}")

    print("\nDependencies:")
    for u, v, data in G.edges(data=True):
        print(f"Scene {u} → Scene {v} (weight={data['weight']})")
import sys
import os

# Add logic directory to path for direct imports
logic_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", "app", "logic"))
sys.path.append(logic_path)

try:
    from parser import split_scenes, extract_scene_info
    from features import extract_features
    from graph_builder import build_graph
    from simulator import simulate_delay, estimate_cost_impact
except ImportError as e:
    print(f"Error: Could not find high-fidelity logic in backend/app/logic. {e}")
    print("Falling back to local legacy logic...")
    from parser import split_scenes, extract_scene_info
    from features import extract_features
    from graph_builder import build_graph
    from simulator import simulate_delay, estimate_cost_impact

def main():
    sample_script = """
    INT. HOUSE - DAY
    John talks to Mary.
    They argue loudly.

    EXT. STREET - NIGHT
    A car explodes. Police arrive.

    INT. OFFICE - DAY
    Sarah discusses plans with Mike.
    """

    print("\n" + "="*50)
    print("   CINEMATIC PRODUCTION INTELLIGENCE - CLI")
    print("="*50)
    print("\n--- RAW SCRIPT ---\n")
    print(sample_script)

    # Step 1: Split scenes
    scenes = split_scenes(sample_script)

    # Step 2: Structure
    structured = [extract_scene_info(s) for s in scenes]

    # Step 3: Features
    featured = [extract_features(s) for s in structured]

    # Step 4: Print scenes
    print("\n--- PROCESSED SCENES ---\n")
    for scene in featured:
        print(f"Scene {scene['scene_id']} | {scene['type']} | {scene['location']} | {scene['time']}")
        print(f" - Characters: {scene.get('num_characters', 0)}")
        print(f" - Risk Score: {scene.get('risk', 0.0):.2f} ({scene.get('risk_level', 'Unknown')})")
        print(f" - Est. Cost:  ${scene.get('scene_cost', 0.0):,.2f}")
        print("-" * 40)

    # Step 5: Graph
    graph = build_graph(featured)
    print("\n--- PRODUCTION DEPENDENCIES ---\n")
    for u, v, data in graph.edges(data=True):
        print(f"Scene {u} -> Scene {v} (Dependency Weight: {data.get('weight', 1.0)})")

    # Step 6: Simulation
    # We simulate a 2-day delay in Scene 2
    delay_map = simulate_delay(graph, delayed_scene="2", delay_days=2.0)

    # Step 7: Cost
    total_cost = estimate_cost_impact(graph, delay_map)

    # Step 8: Output
    print("\n--- SHOCK SIMULATION: 2-DAY DELAY IN SCENE 2 ---\n")
    for scene_id, days in delay_map.items():
        if days > 0:
            print(f"Scene {scene_id}: Cascading Delay +{days:.1f} days")
    print(f"\nNET PRODUCTION BUDGET IMPACT: +${total_cost:,.2f}")
    
    print("\n" + "="*50)
    print("   TIPS: For the high-fidelity Visual Lab, visit:")
    print("   http://localhost:5173")
    print("="*50 + "\n")


if __name__ == "__main__":
    main()
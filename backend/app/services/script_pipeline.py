from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from app.ai.llm_scene_analyzer import LLMSceneAnalyzer, SceneLLMInput
from app.logic.features import extract_features
from app.logic.graph_builder import build_graph, graph_to_dto
from app.logic.parser import extract_scene_info, split_scenes
from app.services.insights import generate_insights


def _text_excerpt(text: str, max_len: int = 280) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def analyze_script(
    script_text: str,
    max_scenes_for_ai: int,
    enable_ai: bool,
    project_name: Optional[str] = None,
) -> Dict[str, Any]:
    scenes_raw = split_scenes(script_text)
    scenes_structured: List[dict] = [extract_scene_info(s) for s in scenes_raw]

    featured_scenes: List[dict] = []
    for sc in scenes_structured:
        features = extract_features(sc)
        features["text_excerpt"] = _text_excerpt(sc.get("text", ""), 280)

        # Heuristic Cinematic Enhancements
        loc_str = str(sc.get("location", "")).lower()
        time_str = str(sc.get("time", "")).lower()
        
        # Shot type & Camera
        if "ext" in sc.get("type", "").lower() or "street" in loc_str or "outside" in loc_str:
            features["shot_type"] = "Wide"
            features["camera_angle"] = "Drone / Overhead"
        elif "int" in sc.get("type", "").lower() and features.get("dialogue_density", 0) > 0.6:
            features["shot_type"] = "Close-up"
            features["camera_angle"] = "Over-the-shoulder"
        else:
            features["shot_type"] = "Medium"
            features["camera_angle"] = "Tracking"

        # Lighting notes
        if "night" in time_str:
            features["lighting_notes"] = "Low-key, high contrast, neon accents"
        else:
            features["lighting_notes"] = "Soft diffused daylight"

        # Sound notes
        if "action" in loc_str or "street" in loc_str:
            features["sound_notes"] = "Heavy foley, tense heartbeat score"
            features["background_score"] = "Action Sync"
        else:
            features["sound_notes"] = "Room tone, crisp dialogue"
            features["background_score"] = "Ambient Motif"
            
        # Production
        features["production_stage"] = "Pre-production"

        featured_scenes.append(features)

    # Build graph & insights (deterministic)
    G = build_graph(featured_scenes)
    insights = generate_insights(featured_scenes, G)

    ai_analyses: Dict[int, dict] = {}
    ai_enabled = bool(enable_ai)
    if ai_enabled and featured_scenes:
        # Choose which scenes to send to the LLM:
        # prioritize risk then complexity.
        sorted_for_ai = sorted(
            featured_scenes,
            key=lambda s: (float(s.get("risk", 0.0)), float(s.get("complexity", 0.0))),
            reverse=True,
        )[: max_scenes_for_ai]

        try:
            analyzer = LLMSceneAnalyzer()
            llm_inputs: List[SceneLLMInput] = [
                SceneLLMInput(
                    scene_id=int(s["scene_id"]),
                    type=str(s.get("type", "")),
                    location=str(s.get("location", "")),
                    time=str(s.get("time", "")),
                    characters=list(s.get("characters") or []),
                    complexity=float(s.get("complexity", 0.0)),
                    risk=float(s.get("risk", 0.0)),
                    text_excerpt=str(s.get("text_excerpt", ""))[:900],
                )
                for s in sorted_for_ai
            ]
            ai_result = analyzer.analyze_scenes(llm_inputs)
            ai_analyses = {int(k): v for k, v in ai_result.items()}
        except Exception as e:
            insights.insert(0, f"AI enrichment skipped: {str(e)[:140]}")
            ai_enabled = False

    # Attach AI fields back onto scenes
    if ai_enabled and ai_analyses:
        for s in featured_scenes:
            sid = int(s["scene_id"])
            if sid not in ai_analyses:
                continue
            r = ai_analyses[sid]
            # Validate/normalize keys defensively.
            s["ai_summary"] = str(r.get("summary") or "").strip()
            s["ai_emotion_tone"] = str(r.get("emotion_tone") or "").strip()
            s["ai_category"] = str(r.get("category") or "Unknown").strip()
            # Numeric enrichment for curves/engagement.
            if r.get("emotion_intensity") is not None:
                try:
                    s["ai_emotion_intensity"] = float(r.get("emotion_intensity"))
                    s["emotion_score"] = float(r.get("emotion_intensity"))
                except Exception:
                    pass
            if r.get("engagement_score") is not None:
                try:
                    s["ai_engagement_score"] = float(r.get("engagement_score"))
                    s["engagement_score"] = float(r.get("engagement_score"))
                except Exception:
                    pass

            # Fallbacks if the model returned unexpected values.
            if not s["ai_category"]:
                s["ai_category"] = "Unknown"

    # Build cinematic project heuristics
    genre = "Thriller / Drama"
    main_cast_set = set()
    for s in featured_scenes:
        for c in s.get("characters", []):
            main_cast_set.add(c)
    main_cast = list(main_cast_set)[:5] or ["TBD"]
    
    total_words = sum(s.get("scene_length", 0) for s in featured_scenes)
    est_runtime_mins = total_words / 150.0  # roughly 150 words per minute of screen time
    
    film_project_meta = {
        "genre": genre,
        "runtime": f"{max(1, int(est_runtime_mins))} min",
        "main_cast": main_cast,
        "crew": "Director: J. Doe | DP: S. Smith",
        "genre_detected": "Action Thriller" if sum(1 for s in featured_scenes if s.get("scene_classification") == "Action") > len(featured_scenes) * 0.3 else "Drama",
        "film_tone": "Tense & Dramatic" if sum(s.get("emotion_score", 0) for s in featured_scenes) > len(featured_scenes) * 0.5 else "Balanced"
    }

    cinematic_analytics = {
        "scene_completion_pct": 0.0,
        "shooting_efficiency": 85.5,
        "estimated_runtime_mins": est_runtime_mins,
        "expected_budget": len(featured_scenes) * 150000.0
    }

    project_id = str(uuid.uuid4())
    nodes, links = graph_to_dto(G)

    overall_budget = round(sum(s.get("scene_cost", 0.0) for s in featured_scenes), 2)
    dialogue_scenes = sum(1 for s in featured_scenes if s.get("scene_classification") == "Dialogue")
    action_scenes = sum(1 for s in featured_scenes if s.get("scene_classification") == "Action")
    ratio = round(dialogue_scenes / max(1, action_scenes), 2)
    climax = max(featured_scenes, key=lambda s: float(s.get("engagement_score", 0.0)), default=None)
    climax_id = int(climax["scene_id"]) if climax else None

    return {
        "project_id": project_id,
        "project_name": project_name,
        "scenes": featured_scenes,
        "graph_nodes": nodes,
        "graph_links": links,
        "insights": insights,
        "film_project_meta": film_project_meta,
        "cinematic_analytics": cinematic_analytics,
        "overall_budget": overall_budget,
        "dialogue_action_ratio": ratio,
        "climax_scene_id": climax_id
    }


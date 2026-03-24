from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple


try:
    import spacy  # type: ignore

    try:
        _NLP = spacy.load("en_core_web_sm")
    except Exception:
        _NLP = None
except Exception:
    _NLP = None


ACTION_KEYWORDS = ["explosion", "fight", "chase", "gun", "run", "screams", "scream", "battle"]
EMOTIONAL_KEYWORDS = ["cry", "tears", "hug", "love", "grief", "fear", "panic", "heart", "silence", "whisper"]
CROWD_KEYWORDS = ["crowd", "extras", "audience", "people", "mob", "thousands", "packed"]
PROP_KEYWORDS = ["gun", "phone", "car", "sword", "letter", "blood", "knife", "bag", "laptop", "glass", "bottle", "keys"]
TRANSITION_KEYWORDS = ["later", "meanwhile", "next day", "cut to", "fade out", "dissolve"]


def _fallback_extract_characters(text: str) -> List[str]:
    """
    Heuristic character extraction for demo reliability:
    Look for ALL-CAPS name lines followed by ":" or "(".
    """
    characters = set()
    # Common screenplay format: "JOHN:" or "MARY (O.S.):"
    # We also allow multi-word uppercase names.
    for m in re.finditer(r"\b([A-Z][A-Z0-9]+(?:\s+[A-Z][A-Z0-9]+){0,3})\s*[:\(]", text):
        name = m.group(1).strip()
        if 1 < len(name) < 40:
            characters.add(name.title())
    return sorted(characters)


def extract_characters(text: str) -> List[str]:
    if not text.strip():
        return []

    if _NLP is None:
        return _fallback_extract_characters(text)

    doc = _NLP(text)
    chars = set()
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            val = ent.text.strip()
            if 1 < len(val) < 60:
                chars.add(val)
    return sorted(chars)


def dialogue_density(text: str) -> float:
    """
    Proxy dialogue density: fraction of short non-empty lines (<10 words).
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if not lines:
        return 0.0

    dialogue_lines = [ln for ln in lines if len(ln.split()) < 10]
    return round(float(len(dialogue_lines) / len(lines)), 2)


def scene_length_words(text: str) -> int:
    return len([w for w in text.split() if w.strip()])


def compute_complexity(scene_type: str, num_characters: int, length_words: int, time: str) -> float:
    score = 0.0
    score += num_characters * 2.0
    score += length_words / 20.0

    if scene_type.upper() == "EXT":
        score += 3.0

    if "NIGHT" in (time or "").upper():
        score += 2.0

    return float(int(score * 100) / 100.0)


def compute_risk(complexity: float, scene_type: str, time: str) -> float:
    risk = 0.0
    risk += complexity * 0.05

    if scene_type.upper() == "EXT":
        risk += 0.2

    if "NIGHT" in (time or "").upper():
        risk += 0.15

    return round(min(risk, 1.0), 2)


def detect_action_scene(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in ACTION_KEYWORDS)


def classify_scene_type(is_action: bool, dialogue: float, text: str) -> str:
    t = (text or "").lower()
    emotional_hits = sum(1 for kw in EMOTIONAL_KEYWORDS if kw in t)
    trans_hits = sum(1 for kw in TRANSITION_KEYWORDS if kw in t)
    
    if trans_hits >= 1 and len(text.split()) < 20:
        return "transition"
    if is_action:
        return "action"
    if emotional_hits >= 2:
        return "emotional"
    if dialogue >= 0.45:
        return "dialogue"
    return "dialogue" if dialogue >= 0.3 else "action"


def classify_location(scene_type: str, location: str) -> str:
    st = (scene_type or "").upper()
    loc = (location or "").lower()
    if st == "EXT":
        return "outdoor"
    if "studio" in loc or "set" in loc or "stage" in loc:
        return "studio"
    return "indoor"


def shot_complexity_tag(is_action: bool, crowd_scene: bool, complexity: float) -> str:
    if is_action and crowd_scene:
        return "high"
    if complexity >= 18:
        return "high"
    if complexity >= 10:
        return "medium"
    return "low"


def heuristic_emotion_score(text: str, risk: float, dialogue: float) -> float:
    t = (text or "").lower()
    emotional_hits = sum(1 for kw in EMOTIONAL_KEYWORDS if kw in t)
    raw = 0.15 + emotional_hits * 0.08 + risk * 0.35 + dialogue * 0.25
    return float(int(max(0.0, min(1.0, raw)) * 1000) / 1000.0)


def heuristic_engagement_score(risk: float, complexity: float, is_action: bool, dialogue: float) -> float:
    action_boost = 12.0 if is_action else 0.0
    raw = 35.0 + risk * 25.0 + min(complexity, 30.0) * 1.2 + action_boost + dialogue * 8.0
    return float(int(max(0.0, min(100.0, raw)) * 100) / 100.0)


def risk_level_and_color(risk: float) -> Tuple[str, str]:
    # Meaningful cinematic palette
    if risk < 0.33:
        return "Safe", "#22c55e"
    if risk < 0.66:
        return "Medium", "#fbbf24"
    return "High", "#ef4444"


def extract_props(text: str) -> List[str]:
    t = text.lower()
    return [p for p in PROP_KEYWORDS if p in t]


def extract_keywords(text: str, is_action: bool) -> List[str]:
    t = text.lower()
    kw = []
    if is_action: kw.append("high-intensity")
    if sum(1 for k in EMOTIONAL_KEYWORDS if k in t) > 0: kw.append("dramatic")
    kw.extend(extract_props(text)[:2])
    return kw


def estimate_crew_req(complexity: float, is_action: bool, crowd_scene: bool) -> int:
    base = 15
    if is_action: base += 20
    if crowd_scene: base += 10
    base += int(complexity * 0.5)
    return min(base, 150)


def estimate_equipment(text: str, is_action: bool, loc_class: str) -> List[str]:
    t = text.lower()
    eq = ["Standard Camera Kit", "Sound Boom"]
    if is_action: eq.append("Steadicam")
    if "fly" in t or "above" in t or "sky" in t: eq.append("Drone")
    if loc_class == "indoor": eq.append("Studio Lighting Rig")
    if loc_class == "outdoor" and "night" in t: eq.append("Heavy Night Lighting")
    return eq


def compute_cost_breakdown(num_chars: int, complexity: float, loc_class: str, days: float) -> Dict[str, float]:
    actor_cost = num_chars * 1500.0 * days
    loc_cost = 5000.0 * days if loc_class == "outdoor" else 2000.0 * days
    comp_cost = complexity * 100.0 * days
    return {"actors": float(int(actor_cost * 100) / 100.0), "location": float(int(loc_cost * 100) / 100.0), "complexity": float(int(comp_cost * 100) / 100.0)}


def detect_shot_type(text: str, is_action: bool) -> str:
    t = text.lower()
    if any(k in t for k in ["eyes", "face", "whisper", "tear", "looks"]):
        return "Close-up"
    if any(k in t for k in ["city", "landscape", "sky", "crowd", "distant"]):
        return "Wide Shot"
    if is_action:
        return "Action Tracking"
    return "Medium Shot"


def generate_storyboard_prompt(scene_type: str, chars: List[str], loc: str, text: str) -> str:
    c_str = ", ".join(chars[:2]) if chars else "silhouette figures"
    short_text = " ".join(text.split()[:15]) + "..."
    return f"Storyboard sketch, cinematic lighting, {scene_type} scene at {loc}. Featuring {c_str}. Action: {short_text}"


def extract_features(scene: dict) -> dict:
    text = scene.get("text", "") or ""
    scene_type = scene.get("type", "") or "UNK"
    location = scene.get("location", "") or ""
    time = scene.get("time", "") or "UNKNOWN"

    chars = extract_characters(text)
    num_characters = len(chars)
    length = scene_length_words(text)
    dialogue = dialogue_density(text)

    is_action = detect_action_scene(text)

    complexity = compute_complexity(scene_type, num_characters, length, time)
    if is_action:
        complexity += 2.0

    risk = compute_risk(complexity, scene_type, time)
    risk_level, risk_color = risk_level_and_color(risk)
    crowd_scene = any(kw in text.lower() for kw in CROWD_KEYWORDS) or num_characters >= 8
    loc_class = classify_location(scene_type, location)
    shot_tag = shot_complexity_tag(is_action, crowd_scene, complexity)
    emotion_score = heuristic_emotion_score(text, risk, dialogue)
    engagement_score = heuristic_engagement_score(risk, complexity, is_action, dialogue)
    schedule_estimate_days = float(int(min(max(0.5, 0.35 + complexity / 14.0 + length / 900.0), 6.0) * 100) / 100.0)
    weather_risk = float(int((0.25 + risk * 0.55) * 1000) / 1000.0) if loc_class == "outdoor" else 0.0
    retake_risk = float(int(min(1.0, complexity / 28.0 + (0.15 if is_action else 0.0)) * 1000) / 1000.0)
    actor_conflict_score = float(int(min(1.0, num_characters / 10.0 + dialogue * 0.2) * 1000) / 1000.0)
    scene_domain_type = classify_scene_type(is_action, dialogue, text)

    # NEW SCRIPT INTELLIGENCE FEATURES
    props = extract_props(text)
    keywords = extract_keywords(text, is_action)
    crew = estimate_crew_req(complexity, is_action, crowd_scene)
    equip = estimate_equipment(text, is_action, loc_class)
    cost_bd = compute_cost_breakdown(num_characters, complexity, loc_class, schedule_estimate_days)
    total_scene_cost = sum(cost_bd.values())
    shot_type = detect_shot_type(text, is_action)
    prompt = generate_storyboard_prompt(scene_domain_type, chars, location, text)
    importance_score = float(int(min(1.0, (num_characters * 0.1) + (engagement_score / 150.0)) * 100) / 100.0)

    return {
        **scene,
        "characters": chars,
        "num_characters": num_characters,
        "scene_length": length,
        "dialogue_density": dialogue,
        "complexity": float(int(complexity * 100) / 100.0),
        "risk": float(risk),
        "risk_level": risk_level,
        "risk_color": risk_color,
        "is_action": bool(is_action),
        "scene_type": scene_domain_type,
        "emotion_score": emotion_score,
        "engagement_score": engagement_score,
        "location_classification": loc_class,
        "schedule_estimate_days": schedule_estimate_days,
        "shot_complexity_tag": shot_tag,
        "crowd_scene": bool(crowd_scene),
        "weather_risk": weather_risk,
        "retake_risk": retake_risk,
        "actor_conflict_score": actor_conflict_score,
        "scene_classification": scene_domain_type.capitalize(),
        "importance_score": importance_score,
        "keywords": keywords,
        "props_detected": props,
        "crew_req": crew,
        "equipment_req": equip,
        "scene_cost": round(float(total_scene_cost), 2),
        "cost_breakdown": cost_bd,
        "shot_type_detected": shot_type,
        "storyboard_prompt": prompt,
    }


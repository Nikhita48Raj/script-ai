import spacy

try:
    nlp = spacy.load("en_core_web_sm")
except:
    raise Exception("spaCy model not found. Install it properly.")


def count_characters(text):
    doc = nlp(text)
    characters = set()

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            characters.add(ent.text.strip())

    return len(characters)


def dialogue_density(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if len(lines) == 0:
        return 0.0

    dialogue_lines = [line for line in lines if len(line.split()) < 10]

    return len(dialogue_lines) / len(lines)


def scene_length(text):
    return len(text.split())


def compute_complexity(scene, num_characters, length):
    score = 0

    score += num_characters * 2
    score += length / 20

    if scene["type"] == "EXT":
        score += 3

    if "NIGHT" in scene["time"].upper():
        score += 2

    return round(score, 2)


def compute_risk(scene, complexity):
    risk = 0

    risk += complexity * 0.05

    if scene["type"] == "EXT":
        risk += 0.2

    if "NIGHT" in scene["time"].upper():
        risk += 0.15

    return round(min(risk, 1.0), 2)


def extract_features(scene):
    text = scene.get("text", "")

    num_characters = count_characters(text)
    length = scene_length(text)
    dialogue = dialogue_density(text)

    complexity = compute_complexity(scene, num_characters, length)
    risk = compute_risk(scene, complexity)
    is_action = detect_action_scene(text)

    if is_action:
        complexity += 2
    return {
        **scene,
        "num_characters": num_characters,
        "scene_length": length,
        "dialogue_density": round(dialogue, 2),
        "complexity": complexity,
        "risk": risk,
    }
    

def detect_action_scene(text):
    action_keywords = ["explosion", "fight", "chase", "gun", "run"]

    text_lower = text.lower()

    for word in action_keywords:
        if word in text_lower:
            return True

    return False
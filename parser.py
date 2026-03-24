import re

def split_scenes(script_text):
    pattern = r"(INT\.|EXT\.)"
    parts = re.split(pattern, script_text)

    scenes = []
    i = 1

    for j in range(1, len(parts), 2):
        heading = parts[j] + parts[j+1].split("\n")[0]
        content = "\n".join(parts[j+1].split("\n")[1:])

        scenes.append({
            "scene_id": i,
            "heading": heading.strip(),
            "text": content.strip()
        })
        i += 1

    return scenes


def extract_scene_info(scene):
    heading = scene["heading"]

    parts = heading.split("-")

    location_part = parts[0]
    time_part = parts[1] if len(parts) > 1 else "UNKNOWN"

    location_tokens = location_part.split()

    return {
        "scene_id": scene["scene_id"],
        "type": location_tokens[0].replace(".", ""),
        "location": " ".join(location_tokens[1:]),
        "time": time_part.strip(),
        "text": scene["text"]
    }
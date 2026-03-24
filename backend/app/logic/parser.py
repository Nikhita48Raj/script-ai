from __future__ import annotations

import re
from typing import Dict, List


HEADING_RE = re.compile(r"^(INT\.|EXT\.).+$", re.IGNORECASE)


def split_scenes(script_text: str) -> List[Dict[str, str]]:
    """
    Splits a screenplay-like text into scene blocks.

    Expected format:
    INT. LOCATION - TIME
    (scene content...)
    """
    lines = script_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    scenes: List[Dict[str, str]] = []

    current_heading: str | None = None
    current_lines: List[str] = []
    scene_id = 1

    def flush() -> None:
        nonlocal scene_id, current_heading, current_lines
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        scenes.append(
            {
                "scene_id": scene_id,
                "heading": current_heading.strip(),
                "text": content,
            }
        )
        scene_id += 1

    for raw in lines:
        line = raw.strip()
        if not line:
            # Keep empty lines within a scene for more natural text for AI.
            if current_heading is not None:
                current_lines.append("")
            continue

        if HEADING_RE.match(line):
            flush()
            current_heading = line
            current_lines = []
        else:
            if current_heading is None:
                # Ignore preamble text.
                continue
            current_lines.append(raw)

    flush()
    return scenes


def extract_scene_info(scene: Dict[str, str]) -> Dict[str, str]:
    heading = scene["heading"]

    # Typical heading: "INT. HOUSE - DAY"
    # Split into: type, location, time
    m = re.match(r"^(INT|EXT)\.?\s*(.+)$", heading.strip(), flags=re.IGNORECASE)
    if not m:
        # Fallback: treat as unknown.
        return {
            "scene_id": int(scene["scene_id"]),
            "type": "UNK",
            "location": heading,
            "time": "UNKNOWN",
            "text": scene["text"],
        }

    scene_type = m.group(1).upper()
    remainder = m.group(2).strip()

    # Now try to split remainder by "-".
    # Use maxsplit=1 to keep "-" inside locations if present.
    parts = [p.strip() for p in remainder.split("-", maxsplit=1)]
    location = parts[0] if parts else remainder
    time = parts[1] if len(parts) > 1 and parts[1] else "UNKNOWN"

    return {
        "scene_id": int(scene["scene_id"]),
        "type": scene_type,
        "location": location,
        "time": time,
        "text": scene["text"],
    }


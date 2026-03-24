from __future__ import annotations

import json
import os
import hashlib
from dataclasses import dataclass
from typing import Dict, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential


try:
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


@dataclass(frozen=True)
class SceneLLMInput:
    scene_id: int
    type: str
    location: str
    time: str
    characters: List[str]
    complexity: float
    risk: float
    text_excerpt: str


class LLMSceneAnalyzer:
    """
    Real LLM integration for scene summaries + emotion tone.

    Requires OPENAI_API_KEY to be set in the environment.
    """

    def __init__(self, model: str = "gpt-4o-mini"):
        if OpenAI is None:
            raise RuntimeError("openai package not available. Install backend requirements.")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Please export OPENAI_API_KEY to enable AI.")

        self._client = OpenAI(api_key=api_key)
        self._model = model

        # Simple in-memory cache to keep demo runs fast.
        self._cache: Dict[str, dict] = {}

    def _cache_key(self, payload: str) -> str:
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(3))
    def analyze_batch(self, scenes: List[SceneLLMInput]) -> List[dict]:
        """
        Returns a list of objects:
        [{scene_id, summary, emotion_tone, category, emotion_intensity, engagement_score}, ...]
        """
        joined = "\n\n".join(
            [
                f"Scene {s.scene_id}\nHeading: {s.type}. {s.location} - {s.time}\nCharacters: {', '.join(s.characters) or 'None'}\nComplexity: {s.complexity}\nRisk: {s.risk}\nText: {s.text_excerpt}"
                for s in scenes
            ]
        )

        system = (
            "You are a production assistant helping analyze film scripts for scheduling risk. "
            "You must return ONLY valid JSON with no surrounding text."
        )

        user = (
            "For each scene, output an object with keys:\n"
            "- scene_id (number)\n"
            "- summary (<= 30 words)\n"
            "- emotion_tone (one of: tense, calm, action, ominous, chaotic)\n"
            "- category (one of: Dialogue, Action, Emotional, Unknown)\n\n"
            "- emotion_intensity (number between 0 and 1)\n"
            "- engagement_score (number between 0 and 100)\n\n"
            "Use the text excerpt to infer emotion tone and category.\n"
            "Scenes:\n"
            f"{joined}\n"
            "Return JSON in the form: {\"scenes\": [ ... ]}."
        )

        resp = self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )

        content = resp.choices[0].message.content or ""
        content = content.strip()

        parsed = json.loads(content)
        if "scenes" not in parsed or not isinstance(parsed["scenes"], list):
            raise ValueError("LLM response missing 'scenes' array.")

        # Normalize numeric fields (defensive against model formatting).
        normalized: List[dict] = []
        for item in parsed["scenes"]:
            if not isinstance(item, dict):
                continue
            emotion_intensity = item.get("emotion_intensity")
            engagement_score = item.get("engagement_score")
            try:
                if emotion_intensity is not None:
                    item["emotion_intensity"] = max(0.0, min(1.0, float(emotion_intensity)))
                if engagement_score is not None:
                    item["engagement_score"] = max(0.0, min(100.0, float(engagement_score)))
            except Exception:
                # If conversion fails, drop fields and let callers apply defaults.
                item.pop("emotion_intensity", None)
                item.pop("engagement_score", None)
            normalized.append(item)

        # Cache by whole response for simplicity.
        return normalized

    def analyze_scenes(self, scenes: List[SceneLLMInput]) -> Dict[int, dict]:
        """
        Batch process with caching.
        """
        if not scenes:
            return {}

        # Cache by scene payload hash so repeated demo inputs are fast.
        output: Dict[int, dict] = {}
        uncached: List[SceneLLMInput] = []
        uncached_keys: List[str] = []

        for s in scenes:
            payload = f"{s.scene_id}|{s.text_excerpt}"
            key = self._cache_key(payload)
            if key in self._cache:
                output[s.scene_id] = self._cache[key]
            else:
                uncached.append(s)
                uncached_keys.append(key)

        if uncached:
            # Keep batch size moderate for reliability.
            # (We also respect scenes count in the orchestrator.)
            results = self.analyze_batch(uncached)
            for key, r in zip(uncached_keys, results):
                self._cache[key] = r
                output[int(r["scene_id"])] = r

        return output


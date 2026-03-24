from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


RiskLevel = Literal["Safe", "Medium", "High"]
SceneCategory = Literal["Dialogue", "Action", "Emotional", "Unknown"]


class AnalyzeScriptRequest(BaseModel):
    script_text: str = Field(..., min_length=1, description="Raw script text (INT./EXT. headings).")
    project_name: Optional[str] = Field(default=None, description="Optional display name.")
    max_scenes_for_ai: int = Field(default=12, ge=1, le=60)
    enable_ai: bool = Field(default=True)


class SceneCard(BaseModel):
    scene_id: int
    type: str
    location: str
    time: str
    characters: List[str] = Field(default_factory=list)
    num_characters: int
    scene_length: int
    dialogue_density: float
    complexity: float
    risk: float
    risk_level: RiskLevel
    risk_color: str
    is_action: bool = False
    text_excerpt: str = ""

    # AI-enhancement (optional)
    ai_summary: Optional[str] = None
    ai_emotion_tone: Optional[str] = None
    ai_category: Optional[SceneCategory] = None
    ai_emotion_intensity: Optional[float] = None  # 0..1
    ai_engagement_score: Optional[float] = None  # 0..100
    scene_type: Optional[str] = None
    emotion_score: Optional[float] = None
    engagement_score: Optional[float] = None
    location_classification: Optional[str] = None
    schedule_estimate_days: Optional[float] = None
    shot_complexity_tag: Optional[str] = None
    crowd_scene: Optional[bool] = None
    weather_risk: Optional[float] = None
    retake_risk: Optional[float] = None
    actor_conflict_score: Optional[float] = None
    shot_type: Optional[str] = None
    camera_angle: Optional[str] = None
    lighting_notes: Optional[str] = None
    sound_notes: Optional[str] = None
    background_score: Optional[str] = None
    actor_assigned: Optional[str] = None
    production_stage: Optional[str] = None
    
    # NEW FIELDS: Script Intelligence & Production
    scene_classification: Optional[str] = None
    importance_score: Optional[float] = None
    keywords: List[str] = Field(default_factory=list)
    props_detected: List[str] = Field(default_factory=list)
    crew_req: Optional[int] = None
    equipment_req: List[str] = Field(default_factory=list)
    scene_cost: Optional[float] = None
    cost_breakdown: Optional[Dict[str, float]] = None
    shot_type_detected: Optional[str] = None
    storyboard_prompt: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    scene_id: int
    name: str
    risk: float
    risk_level: RiskLevel
    risk_color: str
    complexity: float
    type: str
    location: str
    time: str
    text_excerpt: str
    scene_type: Optional[str] = None
    emotion_score: Optional[float] = None


class GraphLink(BaseModel):
    source: str
    target: str
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    links: List[GraphLink] = Field(default_factory=list)


class FilmProjectMeta(BaseModel):
    genre: str
    runtime: str
    main_cast: List[str]
    crew: str
    genre_detected: Optional[str] = None
    film_tone: Optional[str] = None


class CinematicAnalytics(BaseModel):
    scene_completion_pct: float
    shooting_efficiency: float
    estimated_runtime_mins: float
    expected_budget: float


class AnalyzeScriptResponse(BaseModel):
    project_id: str
    scenes: List[SceneCard]
    insights: List[str]
    film_project_meta: Optional[FilmProjectMeta] = None
    cinematic_analytics: Optional[CinematicAnalytics] = None
    overall_budget: Optional[float] = None
    dialogue_action_ratio: Optional[float] = None
    climax_scene_id: Optional[int] = None
    graph: Optional[GraphData] = None


class AssistantAskRequest(BaseModel):
    project_id: str
    question: str = Field(..., min_length=1, max_length=1200)


class AssistantAskResponse(BaseModel):
    project_id: str
    question: str
    answer: str


class GraphResponse(BaseModel):
    project_id: str
    graph: GraphData


class ScriptComparisonRequest(BaseModel):
    script_text_a: str
    script_text_b: str

class ScriptComparisonResponse(BaseModel):
    project_id_a: str
    project_id_b: str
    risk_diff: float
    budget_diff: float
    insights: List[str]
    revision_data: Optional[AnalyzeScriptResponse] = None

class OptimizeScheduleRequest(BaseModel):
    project_id: str

class OptimizeScheduleResponse(BaseModel):
    project_id: str
    optimal_order: List[int]
    total_estimated_days: float
    schedule_insights: List[str]

class SimulateWorstCaseRequest(BaseModel):
    project_id: str

class SimulateWorstCaseResponse(BaseModel):
    project_id: str
    worst_scene_id: int
    max_delay_days: float
    max_cost_impact: float
    insights: List[str]


class SimulationRequest(BaseModel):
    project_id: str
    delayed_scene_id: int
    delay_days: float = Field(..., ge=0.0, le=365.0)
    risk_amplification: float = Field(default=0.30, ge=0.0, le=2.0)


class MultiSimulationScenario(BaseModel):
    delayed_scene_id: int
    delay_days: float = Field(..., ge=0.0, le=365.0)


class MultiSimulationRequest(BaseModel):
    project_id: str
    scenarios: List[MultiSimulationScenario] = Field(..., min_length=1, max_length=4)
    risk_amplification: float = Field(default=0.30, ge=0.0, le=2.0)


class MultiSimulationScenarioEffect(BaseModel):
    delayed_scene_id: int
    delay_days: float
    affected_nodes: List[SimulationSceneEffect]
    graph_affected_node_ids: List[str]
    total_delay_days: float
    total_cost_impact: float


class TimelineItem(BaseModel):
    scene_id: int
    start_day: float
    end_day: float
    duration_days: float


class SimulationSceneEffect(BaseModel):
    scene_id: int
    delay_days: float


class SimulationResponse(BaseModel):
    project_id: str
    delayed_scene_id: int
    delay_days: float

    total_delay_days: float
    total_cost_impact: float

    affected_nodes: List[SimulationSceneEffect]
    graph_affected_node_ids: List[str]

    timeline_before: List[TimelineItem]
    timeline_after: List[TimelineItem]

    insights: List[str] = Field(default_factory=list)


class MultiSimulationResponse(BaseModel):
    project_id: str
    scenarios: List[MultiSimulationScenarioEffect]
    combined_affected_nodes: List[SimulationSceneEffect]
    combined_graph_affected_node_ids: List[str]
    total_cost_impact_combined: float
    total_delay_days_combined: float
    timeline_before: List[TimelineItem]
    timeline_after_combined: List[TimelineItem]
    insights: List[str] = Field(default_factory=list)


class MonteCarloSimulationRequest(BaseModel):
    project_id: str
    delayed_scene_id: int
    delay_mean_days: float = Field(..., ge=0.0, le=365.0)
    delay_std_days: float = Field(..., ge=0.0, le=100.0)
    runs: int = Field(..., ge=20, le=500)


class MonteCarloResultStats(BaseModel):
    expected_total_delay_days: float
    p95_total_delay_days: float
    expected_total_cost_impact: float
    p95_total_cost_impact: float


class MonteCarloSimulationResponse(BaseModel):
    project_id: str
    delayed_scene_id: int
    runs: int
    stats: MonteCarloResultStats
    insights: List[str] = Field(default_factory=list)


class SceneAIAnalysis(BaseModel):
    scene_id: int
    summary: str
    emotion_tone: str
    category: SceneCategory
    emotion_intensity: float
    engagement_score: float


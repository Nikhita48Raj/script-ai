const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "http://localhost:8000";

export type AnalyzeScriptResponse = {
  project_id: string;
  scenes: any[];
  insights: string[];
  film_project_meta?: {
    genre: string;
    runtime: string;
    main_cast: string[];
    crew: string;
    genre_detected?: string;
    film_tone?: string;
  };
  cinematic_analytics?: {
    scene_completion_pct: number;
    shooting_efficiency: number;
    estimated_runtime_mins: number;
    expected_budget: number;
  };
  overall_budget?: number;
  dialogue_action_ratio?: number;
  climax_scene_id?: number;
  graph?: { nodes: any[]; links: any[] };
};

export type AssistantAskResponse = {
  project_id: string;
  question: string;
  answer: string;
};

export type GraphResponse = {
  project_id: string;
  graph: {
    nodes: any[];
    links: any[];
  };
};

export type SimulationResponse = {
  project_id: string;
  delayed_scene_id: number;
  delay_days: number;
  total_delay_days: number;
  total_cost_impact: number;
  affected_nodes: { scene_id: number; delay_days: number }[];
  graph_affected_node_ids: string[];
  timeline_before: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  timeline_after: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  insights: string[];
};

export type MultiSimulationScenarioEffect = {
  delayed_scene_id: number;
  delay_days: number;
  affected_nodes: { scene_id: number; delay_days: number }[];
  graph_affected_node_ids: string[];
  total_delay_days: number;
  total_cost_impact: number;
};

export type MultiSimulationResponse = {
  project_id: string;
  scenarios: MultiSimulationScenarioEffect[];
  combined_affected_nodes: { scene_id: number; delay_days: number }[];
  combined_graph_affected_node_ids: string[];
  total_cost_impact_combined: number;
  total_delay_days_combined: number;
  timeline_before: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  timeline_after_combined: { scene_id: number; start_day: number; end_day: number; duration_days: number }[];
  insights: string[];
};

export type MonteCarloSimulationResponse = {
  project_id: string;
  delayed_scene_id: number;
  runs: number;
  stats: {
    expected_total_delay_days: number;
    p95_total_delay_days: number;
    expected_total_cost_impact: number;
    p95_total_cost_impact: number;
  };
  insights: string[];
};

export type ScriptComparisonResponse = {
  project_id_a: string;
  project_id_b: string;
  risk_diff: number;
  budget_diff: number;
  insights: string[];
  revision_data?: AnalyzeScriptResponse;
};

export type OptimizeScheduleResponse = {
  project_id: string;
  optimal_order: number[];
  total_estimated_days: number;
  schedule_insights: string[];
};

export type SimulateWorstCaseResponse = {
  project_id: string;
  worst_scene_id: number;
  max_delay_days: number;
  max_cost_impact: number;
  insights: string[];
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function analyzeScript(params: {
  script_text: string;
  project_name?: string;
  max_scenes_for_ai?: number;
  enable_ai?: boolean;
}): Promise<AnalyzeScriptResponse> {
  // New canonical endpoint with backward-compatible backend alias.
  return postJson<AnalyzeScriptResponse>("/analyze", params);
}

export async function getGraph(project_id: string): Promise<GraphResponse> {
  const res = await fetch(`${API_BASE}/graph?project_id=${encodeURIComponent(project_id)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as GraphResponse;
}

export async function runSimulation(params: {
  project_id: string;
  delayed_scene_id: number;
  delay_days: number;
  risk_amplification?: number;
}): Promise<SimulationResponse> {
  return postJson<SimulationResponse>("/simulate", params);
}

export async function runMultiSimulation(params: {
  project_id: string;
  scenarios: { delayed_scene_id: number; delay_days: number }[];
  risk_amplification?: number;
}): Promise<MultiSimulationResponse> {
  return postJson<MultiSimulationResponse>("/simulate-multi", params);
}

export async function askAssistant(params: { project_id: string; question: string }): Promise<AssistantAskResponse> {
  return postJson<AssistantAskResponse>("/assistant/ask", params);
}

export async function runMonteCarlo(params: {
  project_id: string;
  delayed_scene_id: number;
  delay_mean_days: number;
  delay_std_days: number;
  runs: number;
}): Promise<MonteCarloSimulationResponse> {
  return postJson<MonteCarloSimulationResponse>("/simulate-monte-carlo", params);
}

export async function exportProject(project_id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/project/export?project_id=${encodeURIComponent(project_id)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}

export async function compareScripts(params: { script_text_a: string; script_text_b: string }): Promise<ScriptComparisonResponse> {
  return postJson<ScriptComparisonResponse>("/compare-scripts", params);
}

export async function optimizeSchedule(params: { project_id: string }): Promise<OptimizeScheduleResponse> {
  return postJson<OptimizeScheduleResponse>("/optimize-schedule", params);
}

export async function simulateWorstCase(params: { project_id: string }): Promise<SimulateWorstCaseResponse> {
  return postJson<SimulateWorstCaseResponse>("/simulate-worst-case", params);
}

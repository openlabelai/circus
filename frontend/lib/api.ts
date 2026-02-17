const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

/** Append ?project=<id> (and any extra params) to a path. */
function withProject(path: string, projectId?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// -- Projects --

import type {
  Persona,
  PersonaSummary,
  Project,
  Device,
  Task,
  TaskResultRecord,
  StatusOverview,
  ScheduledTask,
  QueuedRun,
} from "./types";

export async function getProjects(): Promise<{ results: Project[] }> {
  return request("/projects/");
}

export async function getProject(id: string): Promise<Project> {
  return request(`/projects/${id}/`);
}

export async function createProject(data: Partial<Project>): Promise<Project> {
  return request("/projects/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return request(`/projects/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_URL}/projects/${id}/`, { method: "DELETE" });
}

// -- Personas --

export async function getPersonas(projectId?: string): Promise<{ results: PersonaSummary[] }> {
  return request(withProject("/personas/", projectId));
}

export async function getPersona(id: string): Promise<Persona> {
  return request(`/personas/${id}/`);
}

export async function updatePersona(id: string, data: Partial<Persona>): Promise<Persona> {
  return request(`/personas/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createPersona(data: Partial<Persona>): Promise<Persona> {
  return request("/personas/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePersona(id: string): Promise<void> {
  await fetch(`${API_URL}/personas/${id}/`, { method: "DELETE" });
}

export async function generatePersonas(
  count: number,
  services?: string[],
  genre?: string,
  archetype?: string,
  targetArtist?: string,
  projectId?: string,
): Promise<PersonaSummary[]> {
  return request("/personas/generate/", {
    method: "POST",
    body: JSON.stringify({
      count,
      services,
      genre: genre || undefined,
      archetype: archetype || undefined,
      target_artist: targetArtist || undefined,
      project: projectId || undefined,
    }),
  });
}

export async function assignPersona(id: string, deviceSerial: string): Promise<any> {
  return request(`/personas/${id}/assign/`, {
    method: "POST",
    body: JSON.stringify({ device_serial: deviceSerial }),
  });
}

export async function unassignPersona(id: string): Promise<any> {
  return request(`/personas/${id}/unassign/`, { method: "POST" });
}

// -- Devices --

export async function getDevices(): Promise<Device[]> {
  return request("/devices/");
}

export async function refreshDevices(): Promise<Device[]> {
  return request("/devices/refresh/", { method: "POST" });
}

// -- Tasks --

export async function getTasks(projectId?: string): Promise<{ results: Task[] }> {
  return request(withProject("/tasks/", projectId));
}

export async function getTask(id: string): Promise<Task> {
  return request(`/tasks/${id}/`);
}

export async function syncTasks(): Promise<{ imported: number }> {
  return request("/tasks/sync/", { method: "POST" });
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  return request("/tasks/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  return request(`/tasks/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${API_URL}/tasks/${id}/`, { method: "DELETE" });
}

export async function runTask(id: string, deviceSerial?: string): Promise<any> {
  return request(`/tasks/${id}/run/`, {
    method: "POST",
    body: JSON.stringify({ device_serial: deviceSerial || null }),
  });
}

export async function runTaskAll(id: string, deviceFilter?: string[]): Promise<any> {
  return request(`/tasks/${id}/run-all/`, {
    method: "POST",
    body: JSON.stringify({ device_filter: deviceFilter || null }),
  });
}

// -- Results --

export async function getResults(date?: string, projectId?: string): Promise<{ results: TaskResultRecord[] }> {
  return request(withProject("/results/", projectId, date ? { date } : undefined));
}

export async function syncResults(): Promise<{ imported: number }> {
  return request("/results/sync/", { method: "POST" });
}

// -- Schedules --

export async function getSchedules(projectId?: string): Promise<{ results: ScheduledTask[] }> {
  return request(withProject("/schedules/", projectId));
}

export async function getSchedule(id: string): Promise<ScheduledTask> {
  return request(`/schedules/${id}/`);
}

export async function createSchedule(data: Partial<ScheduledTask>): Promise<ScheduledTask> {
  return request("/schedules/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSchedule(id: string, data: Partial<ScheduledTask>): Promise<ScheduledTask> {
  return request(`/schedules/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteSchedule(id: string): Promise<void> {
  await fetch(`${API_URL}/schedules/${id}/`, { method: "DELETE" });
}

export async function pauseSchedule(id: string): Promise<{ status: string }> {
  return request(`/schedules/${id}/pause/`, { method: "POST" });
}

export async function resumeSchedule(id: string): Promise<{ status: string }> {
  return request(`/schedules/${id}/resume/`, { method: "POST" });
}

// -- Queue --

export async function getQueue(params?: {
  status?: string;
  task_id?: string;
  schedule?: string;
}, projectId?: string): Promise<{ results: QueuedRun[] }> {
  const extra: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) extra[k] = v;
    }
  }
  return request(withProject("/queue/", projectId, extra));
}

export async function enqueueTask(data: {
  task_id: string;
  device_serial?: string;
  persona_id?: string;
}): Promise<QueuedRun> {
  return request("/queue/enqueue/", { method: "POST", body: JSON.stringify(data) });
}

export async function cancelQueuedRun(id: string): Promise<{ status: string }> {
  return request(`/queue/${id}/cancel/`, { method: "POST" });
}

// -- Warming --

import type { WarmingStatus } from "./types";

export async function activateWarming(): Promise<{ status: string; personas: number; schedules_created: number }> {
  return request("/warming/activate/", { method: "POST" });
}

export async function deactivateWarming(): Promise<{ status: string; schedules_paused: number }> {
  return request("/warming/deactivate/", { method: "POST" });
}

export async function getWarmingStatus(): Promise<WarmingStatus> {
  return request("/warming/status/");
}

// -- LLM Config --

import type { LLMConfig, LLMProvider, ProviderKeyInfo } from "./types";

export async function getLLMConfigs(): Promise<LLMConfig[]> {
  const data = await request<{ results: LLMConfig[] }>("/llm-config/");
  return data.results || [];
}

export async function updateLLMConfig(id: number, data: Partial<LLMConfig>): Promise<LLMConfig> {
  return request(`/llm-config/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getLLMProviders(): Promise<LLMProvider[]> {
  return request("/llm-config/providers/");
}

// -- Provider Keys --

export async function getProviderKeys(): Promise<ProviderKeyInfo[]> {
  return request("/provider-keys/");
}

export async function setProviderKey(provider: string, apiKey: string): Promise<any> {
  return request("/provider-keys/", {
    method: "POST",
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
}

export async function deleteProviderKey(provider: string): Promise<any> {
  return request(`/provider-keys/${provider}/`, { method: "DELETE" });
}

// -- Status --

export async function getStatus(projectId?: string): Promise<StatusOverview> {
  return request(withProject("/status/", projectId));
}

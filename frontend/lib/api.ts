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

// -- Personas --

import type {
  Persona,
  PersonaSummary,
  Device,
  Task,
  TaskResultRecord,
  StatusOverview,
  ScheduledTask,
  QueuedRun,
} from "./types";

export async function getPersonas(): Promise<{ results: PersonaSummary[] }> {
  return request("/personas/");
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

export async function generatePersonas(count: number, services?: string[]): Promise<PersonaSummary[]> {
  return request("/personas/generate/", {
    method: "POST",
    body: JSON.stringify({ count, services }),
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

export async function getTasks(): Promise<{ results: Task[] }> {
  return request("/tasks/");
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

export async function getResults(date?: string): Promise<{ results: TaskResultRecord[] }> {
  const params = date ? `?date=${date}` : "";
  return request(`/results/${params}`);
}

export async function syncResults(): Promise<{ imported: number }> {
  return request("/results/sync/", { method: "POST" });
}

// -- Schedules --

export async function getSchedules(): Promise<{ results: ScheduledTask[] }> {
  return request("/schedules/");
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
}): Promise<{ results: QueuedRun[] }> {
  const query = params
    ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][]
      ).toString()
    : "";
  return request(`/queue/${query}`);
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

export async function getStatus(): Promise<StatusOverview> {
  return request("/status/");
}

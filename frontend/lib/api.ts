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

// -- Status --

export async function getStatus(): Promise<StatusOverview> {
  return request("/status/");
}

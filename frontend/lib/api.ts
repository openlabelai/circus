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

/** Append ?campaign=<id> (and any extra params) to a path. */
function withCampaign(path: string, campaignId?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaign", campaignId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// -- Artist Profiles --

import type {
  Account,
  Agent,
  ArtistProfile,
  Persona,
  PersonaSummary,
  Campaign,
  Device,
  Proxy,
  Task,
  TaskResultRecord,
  StatusOverview,
  ScheduledTask,
  QueuedRun,
} from "./types";

export async function getArtistProfiles(): Promise<{ results: ArtistProfile[] }> {
  return request("/artist-profiles/");
}

export async function getArtistProfile(id: string): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/`);
}

export async function createArtistProfile(data: Partial<ArtistProfile>): Promise<ArtistProfile> {
  return request("/artist-profiles/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateArtistProfile(id: string, data: Partial<ArtistProfile>): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteArtistProfile(id: string): Promise<void> {
  await fetch(`${API_URL}/artist-profiles/${id}/`, { method: "DELETE" });
}

export async function runArtistResearch(id: string): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/research/`, { method: "POST" });
}

export async function fetchArtistComments(id: string, source: "youtube" | "instagram", intensity: "soft" | "mid" | "hard" = "mid", deviceSerial?: string): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/fetch_comments/`, {
    method: "POST",
    body: JSON.stringify({ source, intensity, device_serial: deviceSerial || undefined }),
  });
}

export async function clearArtistComments(id: string): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/clear_comments/`, { method: "POST" });
}

export async function enrichArtistAPIs(id: string): Promise<ArtistProfile> {
  return request(`/artist-profiles/${id}/enrich/`, { method: "POST" });
}

// -- Campaigns --

export async function getCampaigns(): Promise<{ results: Campaign[] }> {
  return request("/campaigns/");
}

export async function getCampaign(id: string): Promise<Campaign> {
  return request(`/campaigns/${id}/`);
}

export async function createCampaign(data: Partial<Campaign>): Promise<Campaign> {
  return request("/campaigns/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
  return request(`/campaigns/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteCampaign(id: string): Promise<void> {
  await fetch(`${API_URL}/campaigns/${id}/`, { method: "DELETE" });
}

import type { CampaignStats } from "./types";

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  return request(`/campaigns/${id}/stats/`);
}

// -- Personas --

export async function getPersonas(campaignId?: string): Promise<{ results: PersonaSummary[] }> {
  return request(withCampaign("/personas/", campaignId));
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
  campaignId?: string,
): Promise<PersonaSummary[]> {
  return request("/personas/generate/", {
    method: "POST",
    body: JSON.stringify({
      count,
      services,
      genre: genre || undefined,
      archetype: archetype || undefined,
      target_artist: targetArtist || undefined,
      campaign: campaignId || undefined,
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

// -- Agents --

export async function getAgents(campaignId?: string): Promise<{ results: Agent[] }> {
  return request(withCampaign("/agents/", campaignId));
}

export async function getAgent(id: string): Promise<Agent> {
  return request(`/agents/${id}/`);
}

export async function createAgent(data: Partial<Agent>): Promise<Agent> {
  return request("/agents/", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteAgent(id: string): Promise<void> {
  await fetch(`${API_URL}/agents/${id}/`, { method: "DELETE" });
}

export async function activateAgent(id: string): Promise<{ status: string; detail: string }> {
  return request(`/agents/${id}/activate/`, { method: "POST" });
}

export async function deactivateAgent(id: string): Promise<{ status: string }> {
  return request(`/agents/${id}/deactivate/`, { method: "POST" });
}

export async function executeAgentAction(
  id: string,
  data: { action: string; target: string; text?: string; max_comments?: number },
): Promise<{ success: boolean; detail: string; data?: any }> {
  return request(`/agents/${id}/execute_action/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function spawnAgents(
  campaignId: string,
  platform?: string,
): Promise<Agent[]> {
  return request(`/campaigns/${campaignId}/spawn_agents/`, {
    method: "POST",
    body: JSON.stringify({ platform: platform || "instagram" }),
  });
}

export async function generateFans(
  campaignId: string,
  count: number,
  platform?: string,
): Promise<Agent[]> {
  return request(`/campaigns/${campaignId}/generate_fans/`, {
    method: "POST",
    body: JSON.stringify({ count, platform: platform || undefined }),
  });
}

export async function startCampaign(
  campaignId: string,
  platform?: string,
): Promise<{ provisioned: number; remaining_ready: number }> {
  return request(`/campaigns/${campaignId}/start_campaign/`, {
    method: "POST",
    body: JSON.stringify({ platform: platform || undefined }),
  });
}

// -- Accounts --

export async function getAccounts(platform?: string, status?: string): Promise<{ results: Account[] }> {
  const params = new URLSearchParams();
  if (platform) params.set("platform", platform);
  if (status) params.set("status", status);
  const qs = params.toString();
  return request(`/accounts/${qs ? `?${qs}` : ""}`);
}

export async function createAccount(data: Partial<Account>): Promise<Account> {
  return request("/accounts/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  return request(`/accounts/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteAccount(id: string): Promise<void> {
  await fetch(`${API_URL}/accounts/${id}/`, { method: "DELETE" });
}

// -- Devices --

export async function getDevices(): Promise<Device[]> {
  return request("/devices/");
}

export async function refreshDevices(): Promise<Device[]> {
  return request("/devices/refresh/", { method: "POST" });
}

export async function updateDeviceMetadata(
  serial: string,
  data: { name?: string; bay?: string; slot?: string; location_label?: string; device_ip?: string | null },
): Promise<Device> {
  return request(`/devices/${serial}/metadata/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// -- Proxies --

export async function getProxies(proxyStatus?: string, country?: string): Promise<{ results: Proxy[] }> {
  const params = new URLSearchParams();
  if (proxyStatus) params.set("status", proxyStatus);
  if (country) params.set("country", country);
  const qs = params.toString();
  return request(`/proxies/${qs ? `?${qs}` : ""}`);
}

export async function createProxy(data: Partial<Proxy>): Promise<Proxy> {
  return request("/proxies/", { method: "POST", body: JSON.stringify(data) });
}

export async function updateProxy(id: string, data: Partial<Proxy>): Promise<Proxy> {
  return request(`/proxies/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteProxy(id: string): Promise<void> {
  await fetch(`${API_URL}/proxies/${id}/`, { method: "DELETE" });
}

// -- Tasks --

export async function getTasks(campaignId?: string): Promise<{ results: Task[] }> {
  return request(withCampaign("/tasks/", campaignId));
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

export async function getResults(date?: string, campaignId?: string): Promise<{ results: TaskResultRecord[] }> {
  return request(withCampaign("/results/", campaignId, date ? { date } : undefined));
}

export async function syncResults(): Promise<{ imported: number }> {
  return request("/results/sync/", { method: "POST" });
}

// -- Schedules --

export async function getSchedules(campaignId?: string): Promise<{ results: ScheduledTask[] }> {
  return request(withCampaign("/schedules/", campaignId));
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
}, campaignId?: string): Promise<{ results: QueuedRun[] }> {
  const extra: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) extra[k] = v;
    }
  }
  return request(withCampaign("/queue/", campaignId, extra));
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

export async function getStatus(campaignId?: string): Promise<StatusOverview> {
  return request(withCampaign("/status/", campaignId));
}

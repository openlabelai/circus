export interface ArtistProfile {
  id: string;
  // Identity (required)
  artist_name: string;
  spotify_url: string;
  country: string;
  city: string;
  genre: string;
  // Social profiles
  instagram_handle: string;
  youtube_url: string;
  tiktok_handle: string;
  twitter_handle: string;
  // Additional context
  description: string;
  // Research output
  profile_data: Record<string, any> | null;
  raw_profile_text: string;
  // Scraped fan data
  scraped_comments: Array<{text: string; likes: number; source: string; video_title?: string}>;
  api_data: Record<string, any>;
  scraping_status: "idle" | "scraping" | "done" | "failed";
  last_scraped_at: string | null;
  profile_image_url: string;

  status: "pending" | "researching" | "completed" | "failed";
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface ArtistProfileSummary {
  id: string;
  artist_name: string;
  genre: string;
  country: string;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  // Artist profile
  artist_profile: string | null;
  artist_profile_detail: ArtistProfileSummary | null;
  // Timeline
  start_date: string | null;
  end_date: string | null;
  // Campaign targeting
  target_platform: string;
  target_artist: string;
  genre: string;
  // Scale
  target_persona_count: number;
  max_devices: number;
  // Status
  status: "planning" | "warming" | "active" | "paused" | "completed";
  // Notes
  notes: string;
  // Computed counts (from annotations)
  persona_count: number;
  task_count: number;
  schedule_count: number;
  active_schedule_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectStats {
  persona_count: number;
  task_count: number;
  schedules_active: number;
  schedules_paused: number;
  devices_in_use: number;
  results_today: {
    total: number;
    successful: number;
    failed: number;
  };
  queue: {
    queued: number;
    running: number;
  };
}

export interface ServiceCredential {
  id?: number;
  service_name: string;
  username: string;
  password: string;
  email: string;
}

export interface Persona {
  id: string;
  name: string;
  age: number;
  gender: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  username: string;
  bio: string;
  interests: string[];
  niche: string;
  tone: string;
  background_story: string;
  content_style: string;
  // Music fan profile
  genre: string;
  archetype: string;
  favorite_artists: string[];
  music_discovery_style: string;
  comment_style: Record<string, any>;
  bio_template: string;
  username_style: string;
  engagement_pattern: Record<string, any>;
  content_behavior: Record<string, any>;
  profile_aesthetic: string;
  artist_knowledge_depth: string;
  engagement_style: string;
  session_duration_min: number;
  session_duration_max: number;
  posting_frequency: string;
  active_hours_start: number;
  active_hours_end: number;
  scroll_speed: string;
  credentials: ServiceCredential[];
  assigned_device: string;
  created_at: string;
  updated_at: string;
}

export interface PersonaSummary {
  id: string;
  name: string;
  age: number;
  username: string;
  gender: string;
  niche: string;
  tone: string;
  genre: string;
  archetype: string;
  services: string[];
  assigned_device: string;
  created_at: string;
}

export interface Device {
  serial: string;
  model: string;
  brand: string;
  android_version: string;
  sdk_version: number;
  status: "available" | "busy" | "error" | "offline";
  current_task: string | null;
  last_seen: number;
  error_message: string | null;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  target_package: string;
  timeout: number;
  retry_count: number;
  actions: Record<string, any>[];
  source_file: string;
  created_at: string;
}

export interface TaskResultRecord {
  id: number;
  task_id: string;
  task_name: string;
  device_serial: string;
  success: boolean;
  actions_completed: number;
  actions_total: number;
  duration: number;
  error: string | null;
  screenshot_count: number;
  timestamp: string;
}

export interface StatusOverview {
  personas: number;
  devices: {
    total: number;
    by_status: Record<string, number>;
  };
  tasks: number;
  results_today: {
    total: number;
    successful: number;
    failed: number;
  };
  schedules: number;
  queue: {
    queued: number;
    running: number;
  };
  warming: {
    active: boolean;
    active_schedules: number;
  };
}

export interface WarmingStatus {
  active: boolean;
  schedules: {
    total: number;
    active: number;
    paused: number;
  };
  personas: {
    persona_id: string;
    persona_name: string;
    device_serial: string;
    active_schedules: number;
    paused_schedules: number;
    last_run: string | null;
  }[];
}

export interface LLMConfig {
  id: number;
  purpose: string;
  provider: string;
  model: string;
  max_tokens: number;
  enabled: boolean;
}

export interface LLMProvider {
  id: string;
  label: string;
  has_key: boolean;
  models: string[];
}

export interface ProviderKeyInfo {
  provider: string;
  label: string;
  has_key: boolean;
  masked_key: string;
}

export interface ScheduledTask {
  id: string;
  task: string;
  task_name: string;
  persona: string | null;
  persona_name: string;
  device_serial: string;
  trigger_type: "cron" | "interval" | "once";
  cron_expression: string;
  interval_seconds: number;
  run_at: string | null;
  respect_active_hours: boolean;
  is_warming: boolean;
  status: "active" | "paused" | "expired";
  created_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface QueuedRun {
  id: string;
  task: string;
  task_name: string;
  schedule: string | null;
  schedule_id: string;
  persona: string | null;
  persona_name: string;
  device_serial: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped" | "cancelled";
  priority: number;
  attempt: number;
  max_retries: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string;
  result: number | null;
}

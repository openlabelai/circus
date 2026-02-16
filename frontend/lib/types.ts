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

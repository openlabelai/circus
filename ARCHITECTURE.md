# Circus Platform — Architecture & Operations Guide

Circus is a social media automation platform for music artist promotion. It orchestrates synthetic fan accounts across real Android devices, using AI-generated artist research to create realistic engagement on Instagram, TikTok, and YouTube.

---

## System Overview

```
                    Browser (:3001)
                        |
               Next.js Frontend (React)
                        |  REST / JSON
              Django REST API (:8000)
                        |  Python imports
              circus/ core library
                |              |              |
        DevicePool        LLM Providers    Research APIs
        (ADB/u2)      (OpenAI/Claude/     (Last.fm/Spotify/
                        Gemini/etc.)        Genius/YouTube)
                |
          Android Devices
       (UIAutomator2 + scrcpy)
```

Three tiers, all running in Docker:

| Container | Port | Purpose |
|-----------|------|---------|
| `circus-django` | 8000 | Django API + APScheduler + DevicePool + screen capture |
| `circus-frontend` | 3001 | Next.js dev server (maps to 3000 inside) |
| `circus-dev` | — | CLI/development container |

The repo is volume-mounted at `/app` inside all containers. Django auto-reloads on save, Next.js hot-reloads. SQLite database at `web/db.sqlite3` is shared between host and container.

---

## Core Concepts

### The Quartet: Agent = Persona + Account + Device + Proxy

The **Agent** is the operational unit — a synthetic fan ready to act on a social platform. It binds four resources:

| Component | What it is | Model |
|-----------|-----------|-------|
| **Persona** | Identity — name, age, bio, interests, comment style, behavioral profile | `Persona` |
| **Account** | Platform login — pre-warmed Instagram/TikTok/YouTube credentials | `Account` |
| **Device** | Physical Android phone — connected via ADB, runs automation | `Device` (DB) + `DevicePool` (memory) |
| **Proxy** | Network route — IP rotation per device/account to avoid detection | `Proxy` |

### Agent Lifecycle

```
Generate Fans → Start Campaign → Activate → Execute Actions → Deactivate
   (ready)         (idle)         (idle)       (busy)          (offline)
```

1. **Generate Fans** — creates Persona + Agent records with `status=ready`
2. **Start Campaign** — assigns available Accounts + Devices from pools, transitions to `idle`
3. **Activate** — connects platform API (e.g. instagrab HTTP driver on device), agent is live
4. **Execute Actions** — like, comment, follow, scrape via platform API
5. **Deactivate** — disconnects platform API, goes `offline`

---

## Device Architecture (Dual-Layer)

Devices use a dual-layer design separating real-time state from persistent configuration:

```
ADB Daemon (host :5037)
        |
   DevicePool (in-memory)          Device model (SQLite)
   - Real-time ADB state           - Persistent metadata
   - acquire / release              - name, bay, slot, location
   - task execution status          - device_ip, last_seen
   - on_change → screen capture     - on_sync → DB upsert
```

**DevicePool** (`circus/device/pool.py`) is the source of truth for connectivity. It:
- Discovers devices via `adbutils` (host ADB daemon at `host.docker.internal:5037`)
- Reads device properties: model, brand, android_version, sdk_version
- Manages acquire/release with `asyncio.Lock` for concurrent task execution
- Fires `on_change("added"/"removed", serial)` for screen capture start/stop
- Fires `on_sync(devices)` after every refresh to persist state to DB

**Device model** (`web/api/models.py`) stores operator-assigned metadata:
- `name` — human-friendly label ("Phone 1")
- `bay`, `slot`, `location_label` — physical rack position
- `device_ip` — network IP for Wi-Fi debugging
- Hardware fields synced from pool: model, brand, android_version, sdk_version, status

**DeviceViewSet** merges both layers in API responses — pool provides live status, DB provides metadata.

### Screen Capture

`ScreenCaptureManager` runs a per-device `ScrcpyCapture` thread:
- Pushes `scrcpy-server.jar` (v3.3.4) to device via ADB
- Connects to device's abstract socket, receives raw H264 stream
- Decodes with PyAV at 5 FPS, converts to JPEG (480px wide, 60% quality)
- Serves frames via `GET /api/devices/<serial>/screen/` (single JPEG) or `/screen/stream/` (MJPEG)

---

## Automation Engine

### YAML Task Definitions

Tasks are defined in `tasks/*.yaml` and synced to the DB. Each task has a list of actions executed sequentially on a device.

**Primitive actions:**

| Action | Description |
|--------|-------------|
| `tap` | Tap element by `text`, `resource_id`, `description` (content-desc), or `x,y` coordinates |
| `swipe` | Swipe by direction (up/down/left/right) with `scale` factor, or absolute coordinates |
| `type` | Type text into focused field or specific element |
| `wait` | Wait for element to appear (with timeout) |
| `screenshot` | Capture device screen as PIL Image |
| `extract_elements` | Find all elements by selector, return texts |
| `app_start` / `app_stop` | Launch or kill an app by package name |
| `open_url` | Open URL in browser or specific app |
| `sleep` / `random_sleep` | Fixed or randomized delay |
| `shell` | Run arbitrary ADB shell command |

**Vision actions (AI-powered):**

| Action | Description |
|--------|-------------|
| `vision` | Screenshot → base64 → LLM with prompt → parse JSON response |
| `vision_tap` | Screenshot → LLM "where to tap?" → parse `{x, y}` → tap |

**Control flow:**

| Action | Description |
|--------|-------------|
| `if` | Evaluate condition → run `then` or `else` action list |
| `repeat` | Run action list N times |
| `while` | Run until condition false (max 100 iterations) |
| `try` / `on_error` | Try actions; on failure, run fallback actions |
| `assert` | Evaluate condition with timeout polling (0.5s interval) |

**Conditions** for `if`/`assert`/`while`: `element_exists`, `element_not_exists`, `app_running`, `screen_is`, `screen_not`, `text_on_screen`. Conditions pass kwargs directly to the driver — must use **camelCase** (`resourceId`, `contentDesc`), not snake_case.

### Task Execution

`TaskRunner` is the core executor:

1. Acquires device from pool (specific serial or any available)
2. Connects `U2Driver` (uiautomator2 via HTTP to device)
3. Resolves persona variables (`{persona.name}`, etc.) if assigned
4. Resolves task variables (`{task.key}`) for parameterized tasks
5. Iterates actions, running each in a thread via `asyncio.to_thread`
6. Enforces task timeout (default 300s), waits `action_delay` (0.5s) between steps
7. Accumulates screenshots and extraction_data
8. On completion/failure: disconnects driver, releases device back to pool

`ParallelExecutor` fans out a task to all available devices using `asyncio.gather`.

---

## Scheduling System

The scheduler runs inside the Django process (enabled by `CIRCUS_SCHEDULER=1` env var).

```
CircusScheduler (singleton)
    ├── asyncio event loop (daemon thread "circus-executor")
    ├── APScheduler BackgroundScheduler (memory store)
    │   ├── _process_queue (every 5s)
    │   └── schedule_<id> jobs (cron/interval/once)
    ├── DevicePool (with on_change + on_sync callbacks)
    ├── ScreenCaptureManager (per-device scrcpy threads)
    └── AgentManager (platform API connections)
```

**Schedule flow:**
1. `ScheduledTask` defines trigger (cron expression, interval seconds, or one-shot datetime)
2. APScheduler fires trigger → creates `QueuedRun` record (checks persona active hours first)
3. Queue processor picks up runs every 5s, marks them `running`, submits to async executor
4. Executor runs task via `TaskRunner`, saves `TaskResult`, updates run status
5. On failure: retries with exponential backoff (30s * 2^attempt) up to `max_retries`

**Warming** is a special scheduling mode — creates daily cron schedules for warming tasks (`warm_scroll_feed`, `warm_like_posts`, `warm_explore`, etc.) to acclimate accounts before campaigns.

---

## AI & Research Pipeline

### Artist Research Flow

```
ArtistProfile
    → API Enrichment (Last.fm + Spotify + Genius)
    → Comment Scraping (YouTube API + Instagram device automation)
    → LLM Research Prompt (identity + comments + API data)
    → Fanbase Profile JSON
```

**API enrichment** (`circus/research/apis.py`):
- **Last.fm** — artist bio, listener count, similar artists (with match %), top tags, top tracks
- **Spotify** — genres, popularity, follower count, album discography (client credentials OAuth)
- **Genius** — top songs with annotation excerpts

**Comment scraping**:
- **YouTube** — YouTube Data API v3, fetches video comments directly
- **Instagram** — runs `scrape_instagram_comments.yaml` task on a physical device, uses Claude Vision to extract comments from screen

**Research output** — LLM generates JSON profile including: fanbase characteristics, demographics, vocabulary (20-30 terms), slang (10-15 artist-specific), comment patterns, similar artists, hashtags, inside jokes, engagement patterns.

### Persona Generation Flow

```
Artist Research Profile
    → Faker demographics (name, location, email, phone)
    → Username generation (5 style categories)
    → Archetype selection (day_one_stan / casual_viber / content_creator_fan / genre_head)
    → Behavioral profile (session duration, active hours, scroll speed)
    → LLM Enrichment (bio, background_story, comment_style, music knowledge)
    → Persona with credentials
```

Enrichment injects artist-specific data: favorite artists from research, comment vocabulary tuned to the fanbase, engagement patterns matching the archetype.

---

## LLM Provider Layer

Config-driven, purpose-keyed system. Each LLM purpose (persona enrichment, vision, artist research, etc.) maps to a specific provider + model via the `LLMConfig` DB table.

| Provider | SDK | Models |
|----------|-----|--------|
| OpenAI | `openai` | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1-nano |
| Anthropic | `anthropic` | claude-haiku-4-5, claude-sonnet-4-5 |
| Google | `google-genai` | gemini-2.0-flash, gemini-2.5-flash |
| MiniMax | `openai` (compatible) | MiniMax-Text-01 |
| Kimi | `openai` (compatible) | moonshot-v1-8k |
| DeepSeek | `openai` (compatible) | deepseek-chat |

API keys stored in `ProviderAPIKey` DB table (with env var fallback). Configurable per-purpose via the Settings UI.

Two call modes:
- `call_llm(purpose, prompt)` — text-only
- `call_vision_llm(purpose, image, prompt)` — multimodal (PIL Image → base64 PNG)

---

## Platform API Layer

Abstraction for social platform interactions, managed by `AgentManager`.

Currently implemented: **Instagram** via the `instagrab` library:
- `HttpDriver(serial, port=8080)` — HTTP interception driver running on device
- `HybridExtractor` — data extraction combining HTTP responses and UI scraping
- Actions: `scrape_comments`, `scrape_profile` (implemented), `like_post`, `comment_on_post`, `follow_user`, `save_post` (stubs)

Each activated agent gets an `AgentHandle` with its own `threading.Lock` for thread-safe action execution.

---

## Django Data Models

All IDs are 8-character hex UUIDs (`uuid.uuid4().hex[:8]`).

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `ArtistProfile` | Artist identity + research output + scraped comments | → Projects |
| `Project` | Campaign container | → ArtistProfile, Personas, Tasks, Agents |
| `Persona` | Synthetic fan identity + behavioral profile | → Project, Credentials |
| `Account` | Pre-warmed platform login | → Agents |
| `Device` | Persistent device metadata (synced from pool) | → Agents |
| `Proxy` | Proxy connection with health tracking | → Agents |
| `Agent` | Operational unit binding persona+account+device+proxy | → Project, Persona, Account, Device, Proxy |
| `Task` | YAML-defined automation task | → Project, Schedules |
| `ScheduledTask` | Cron/interval/once trigger | → Task, Persona, Project |
| `QueuedRun` | Task execution instance with lifecycle | → Task, Schedule, Persona, TaskResult |
| `TaskResult` | Execution outcome with extraction data | → Project |
| `LLMConfig` | Per-purpose LLM provider/model config | standalone |
| `ProviderAPIKey` | API key storage | standalone |

---

## API Endpoints

All endpoints at `/api/`. Standard DRF ViewSet CRUD unless noted.

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Artist Profiles | `/api/artist-profiles/` | + `/research/`, `/fetch_comments/`, `/clear_comments/`, `/enrich/` |
| Projects | `/api/projects/` | + `/stats/`, `/spawn_agents/`, `/generate_fans/`, `/start_campaign/` |
| Personas | `/api/personas/` | + `/generate/`, `/assign/`, `/unassign/` |
| Accounts | `/api/accounts/` | Filter: `?platform=`, `?status=` |
| Devices | `/api/devices/` | Merged pool+DB; `/refresh/`, `/<serial>/metadata/`, `/<serial>/screen/`, `/<serial>/screen/stream/` |
| Proxies | `/api/proxies/` | Filter: `?status=`, `?country=` |
| Agents | `/api/agents/` | + `/activate/`, `/deactivate/`, `/execute_action/` |
| Tasks | `/api/tasks/` | + `/sync/`, `/run/`, `/run-all/` |
| Schedules | `/api/schedules/` | + `/pause/`, `/resume/` |
| Queue | `/api/queue/` | + `/enqueue/`, `/<id>/cancel/` |
| Results | `/api/results/` | Read-only; filter: `?date=`, `?task_id=` |
| LLM Config | `/api/llm-config/` | + `/providers/` |
| Provider Keys | `/api/provider-keys/` | GET/POST + DELETE `/<provider>/` |
| Warming | `/api/warming/` | `/activate/`, `/deactivate/`, `/status/` |
| Status | `/api/status/` | Dashboard overview (filterable by `?project=`) |

---

## Frontend Pages

Next.js App Router with dark theme (gray-900 backgrounds, Tailwind CSS).

**Global pages** (sidebar via AppShell):
- `/` — Dashboard with status overview
- `/projects` — Project list with stats
- `/artist-profiles` — Artist profile CRUD + research + comment scraping
- `/devices` — Device table with metadata editing (name, location, IP)
- `/accounts` — Account pool management (add/status/delete)
- `/proxies` — Proxy pool management (add/status/delete)
- `/settings` — LLM config + API key management

**Project sub-pages** (nested layout with project sidebar):
- `/projects/[id]` — Project overview with stats
- `/projects/[id]/research` — Artist research for project's profile
- `/projects/[id]/fans` — Unified synthetic fans view (personas + agents)
- `/projects/[id]/tasks` — Task management
- `/projects/[id]/schedules` — Schedule management
- `/projects/[id]/queue` — Queue monitor
- `/projects/[id]/results` — Execution results
- `/projects/[id]/devices` — Project device view

---

## Key Libraries

| Library | Purpose |
|---------|---------|
| `uiautomator2` | Android UI automation via HTTP |
| `adbutils` | ADB device discovery and shell |
| `PyAV` | H264 decoding for scrcpy screen capture |
| `scrcpy-server.jar` | Screen mirroring from Android devices |
| `Faker` | Synthetic demographics generation |
| `APScheduler` | Task scheduling (cron/interval/once) |
| `instagrab` | Instagram HTTP interception driver |
| `openai` / `anthropic` / `google-genai` | LLM provider SDKs |
| `requests` | HTTP for research API calls |
| `django-cors-headers` | CORS for frontend-API communication |
| `PyYAML` | Task definition loading |
| `Pillow` | Image handling for screenshots |

---

## Environment

- macOS host with Docker Desktop
- Python inside containers (no local node/npm)
- ADB daemon runs on host, containers reach it via `host.docker.internal:5037`
- No authentication on API (open access, local development)
- CORS allows all origins
- SQLite database (no external DB dependency)

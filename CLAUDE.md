# Circus

Circus is a social media automation platform for music artist promotion. It manages personas (fake fan accounts), automates device interactions via ADB, and uses AI-generated artist research to create realistic engagement.

## Architecture

- **Backend**: Django REST Framework (`web/`) — models, API, scheduler
- **Frontend**: Next.js + Tailwind (`frontend/`) — dark-themed dashboard on port 3001
- **Core library**: Python (`circus/`) — persona generation, LLM providers, device automation, research (YouTube/Instagram scraping, API enrichment)
- **Tasks**: YAML task definitions (`tasks/`) synced to DB

## Docker Setup (IMPORTANT)

All services run in Docker via `docker-compose.yml`. Always use Docker commands to manage them.

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `circus-django` | `Dockerfile.django` | `localhost:8000` | Django API + scheduler |
| `circus-frontend` | `frontend/Dockerfile` | `localhost:3001` (maps to 3000 inside) | Next.js dev server |
| `circus-dev` | `Dockerfile` | — | CLI/dev container |

### Common Docker Commands

```bash
# Check container status
docker ps

# Start/stop/restart
docker start circus-django circus-frontend
docker stop circus-django circus-frontend
docker restart circus-django circus-frontend

# Run Django migrations (must run INSIDE container)
docker exec circus-django python manage.py migrate

# Make migrations (must run INSIDE container)
docker exec circus-django python manage.py makemigrations api

# View Django logs
docker logs circus-django --tail 50 -f

# View frontend logs
docker logs circus-frontend --tail 50 -f

# Shell into container
docker exec -it circus-django bash
```

### Port Conflicts

OrbStack or other container runtimes may hold port 8000. Check with:
```bash
lsof -i :8000
```
Kill the conflicting process before starting Docker containers.

### Volume Mounts

The repo is mounted at `/app` inside containers, so local file edits are reflected immediately. Django auto-reloads on save. Frontend uses Next.js hot reload.

## Key Directories

```
circus/              # Core Python library
  automation/        # Action engine (actions.py, u2driver.py, base.py)
  persona/           # Persona generation, artist research
  research/          # YouTube API, Instagram scraping, API enrichment
  llm/               # LLM provider abstraction
  device/            # ADB device management (pool.py, models.py, discovery.py)
  tasks/             # Task runner, models, executor
web/                 # Django project
  api/               # Models, serializers, views, scheduler, services
  circus_web/        # Django settings
frontend/            # Next.js app
  app/               # App router pages
    artist-profiles/ # Artist profile list (single page, no [id] detail route)
    personas/        # Persona CRUD
    projects/        # Project management
    devices/         # Device management (with metadata edit)
    accounts/        # Account pool management
    proxies/         # Proxy pool management
    tasks/           # Task editor
    schedules/       # Schedule management
    results/         # Task results viewer
  lib/               # API client (api.ts), types (types.ts)
  components/        # Shared components
tasks/               # YAML task definitions
scripts/             # Evaluation scripts, test utilities
```

## Database

SQLite at `web/db.sqlite3`. Mounted via Docker volume so shared between host and container.

## Key Models (web/api/models.py)

- `ArtistProfile` — artist identity, social links, research output, scraped comments, profile_image_url (auto-fetched from YouTube)
- `Project` — campaign container linking artist profile, personas, tasks
- `Persona` — fake fan account with demographics, behavior, credentials
- `Account` — pool of pre-warmed platform accounts (instagram/tiktok/youtube)
- `Agent` — synthetic fan = persona + account + device + proxy (the operational unit)
- `Device` — persistent device metadata (serial, hardware, location, IP, status). Dual-layer with in-memory `DevicePool` for real-time ADB state
- `Proxy` — proxy connection config with health tracking (host, port, protocol, auth, provider, country, status, latency)
- `Task` — automation task with action steps (YAML-synced)
- `ScheduledTask` — cron/interval triggers for tasks
- `QueuedRun` — task execution queue
- `TaskResult` — execution results with screenshots
- `LLMConfig` / `ProviderAPIKey` — AI provider settings

## Device Architecture (Dual-Layer)

- **`DevicePool`** (`circus/device/pool.py`) — in-memory, real-time ADB truth. Handles acquire/release, task execution. Never driven by DB.
- **`Device` model** (`web/api/models.py`) — persistent config/metadata layer (name, bay, slot, location_label, device_ip, proxy assignment).
- Pool syncs → DB on every `refresh()` via `on_sync` callback → `sync_devices_to_db()` in `web/api/services.py`.
- `DeviceViewSet` merges live pool state with DB metadata in list/retrieve responses.
- Agent has both `device_serial` (string, backwards compat) and `device` (FK to Device model).

## API Pattern

REST endpoints via DRF ViewSets at `/api/`. Frontend calls via `frontend/lib/api.ts`. Types defined in `frontend/lib/types.ts` — keep in sync with serializers.

### Device API (`DeviceViewSet`, lookup_field="serial")
- `GET /api/devices/` — list (merges pool live state + DB metadata)
- `GET /api/devices/<serial>/` — retrieve (merged)
- `POST /api/devices/refresh/` — refresh ADB pool + sync to DB
- `PATCH /api/devices/<serial>/metadata/` — update persistent fields (name, bay, slot, location_label, device_ip)
- `GET /api/devices/<serial>/screen/` — JPEG screenshot
- `GET /api/devices/<serial>/screen/stream/` — MJPEG stream

### Proxy API (`ProxyViewSet`)
- Standard CRUD at `/api/proxies/`
- Filterable by `?status=` and `?country=`
- Response includes computed `proxy_url` field from `as_url()` method

## DRF Serializer Notes

DRF `URLField` does NOT inherit `allow_blank=True` from Django model's `blank=True`. When a URLField is optional, explicitly declare it on the serializer:
```python
youtube_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
```

## Development Workflow

1. Edit files locally (mounted into containers)
2. Django auto-reloads; Next.js hot-reloads
3. For model changes: `docker exec circus-django python manage.py makemigrations api` then `docker exec circus-django python manage.py migrate`
4. Git branch is `main`, remote is `origin` on GitHub (`openlabelai/circus`)

## Task YAML Automation Engine

YAML task definitions in `tasks/` are synced to the DB and executed by `circus/tasks/runner.py` via `circus/automation/actions.py`.

### Key Action Types
- `tap` — by text, resource_id, description (content-desc), or coordinates
- `swipe` — `direction: up/down/left/right` with optional `scale` factor (1.0 = default 40% screen, 1.75 = 70%, etc.)
- `vision` / `vision_tap` — Claude Vision for screen reading / tapping
- `extract_elements` — extract text by resource ID (returns `success: True` even when empty — won't trigger `try/on_error`)
- `repeat`, `if`, `try/on_error`, `assert`, `wait` — control flow
- `app_start`, `app_stop`, `open_url` — app lifecycle
- `random_sleep` — humanized delays

### YAML Condition Gotcha
In `if`/`assert` conditions, `element_exists`/`element_not_exists` pass kwargs directly to the driver — use **camelCase** (`resourceId`, `contentDesc`), not snake_case. Action handlers like `tap` convert snake_case internally, but conditions do not.

### Instagram Scraper Task
`tasks/scrape_instagram_comments.yaml` — navigates to an artist's IG profile, opens posts, extracts comments via Claude Vision (3 batches per post with scrolling). Uses GramAddict-style resource IDs with vision fallbacks for Reels.

Key variables: `{task.instagram_handle}`, `{task.post_count}`

### Comment Scraping Flow (frontend → backend)
1. Frontend (`artist-profiles/page.tsx`) calls `POST /api/artist-profiles/{id}/fetch_comments/` with `{source, intensity, device_serial}`
2. YouTube: calls `circus/research/youtube.py` → YouTube Data API v3 directly
3. Instagram: syncs YAML task → runs on device via `TaskRunner` → extracts comments from `extraction_data` with deduplication
4. Comments stored in `ArtistProfile.scraped_comments` (JSON list)
5. Research prompt (`circus/persona/artist_research.py`) includes scraped comments as grounding data

### Artist Research Flow
1. Frontend calls `POST /api/artist-profiles/{id}/research/`
2. Auto-enriches via Last.fm/Spotify/Genius APIs if `api_data` is empty
3. Builds prompt with artist identity + scraped comments + API data as grounding
4. Calls LLM via `call_llm("artist_research", prompt)`
5. Returns JSON profile: fanbase characteristics, demographics, vocabulary, slang, similar artists, etc.

## Environment

- macOS (Darwin), zsh
- Python available locally as `python3` (system 3.9) — but prefer running inside Docker
- No node/npm/bun available on host — frontend builds only inside Docker
- Docker Desktop for container management

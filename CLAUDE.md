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
  persona/           # Persona generation, artist research
  research/          # YouTube API, Instagram scraping, API enrichment
  llm/               # LLM provider abstraction
  device/            # ADB device management, automation engine
web/                 # Django project
  api/               # Models, serializers, views, scheduler
  circus_web/        # Django settings
frontend/            # Next.js app
  app/               # App router pages
    artist-profiles/ # Artist profile management
    personas/        # Persona CRUD
    projects/        # Project management
    devices/         # Device management
    tasks/           # Task editor
    schedules/       # Schedule management
    results/         # Task results viewer
  lib/               # API client (api.ts), types (types.ts)
  components/        # Shared components
tasks/               # YAML task definitions
```

## Database

SQLite at `web/db.sqlite3`. Mounted via Docker volume so shared between host and container.

## Key Models (web/api/models.py)

- `ArtistProfile` — artist identity, social links, research output, scraped comments, profile_image_url (auto-fetched from YouTube)
- `Project` — campaign container linking artist profile, personas, tasks
- `Persona` — fake fan account with demographics, behavior, credentials
- `Task` — automation task with action steps (YAML-synced)
- `ScheduledTask` — cron/interval triggers for tasks
- `QueuedRun` — task execution queue
- `TaskResult` — execution results with screenshots
- `LLMConfig` / `ProviderAPIKey` — AI provider settings

## API Pattern

REST endpoints via DRF ViewSets at `/api/`. Frontend calls via `frontend/lib/api.ts`. Types defined in `frontend/lib/types.ts` — keep in sync with serializers.

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

## Environment

- macOS (Darwin), zsh
- Python available locally as `python3` (system 3.9) — but prefer running inside Docker
- No node/npm/bun available on host — frontend builds only inside Docker
- Docker Desktop for container management

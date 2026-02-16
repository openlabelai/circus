# Circus

Agentic phone farm system for **music promotion** — operates physical Android phones to push social media algorithms and amplify content released by music artists.

## What It Does

- Controls real Android phones over USB via UIAutomator2
- Executes YAML-defined tasks (tap, swipe, type, screenshot, vision, control flow)
- Harvests real fan profiles from Instagram using vision LLM extraction
- Manages genre-specific music fan personas with LLM-enriched profiles
- Coordinates release-day campaigns: saves, shares, comments, sound adoption
- Schedules and queues tasks with cron/interval/one-shot triggers
- Warms accounts with automated human-like activity patterns
- Supports 6 LLM providers (OpenAI, Anthropic, Google, Minimax, Kimi, DeepSeek)
- DIY mobile proxy farm via iProxy.online (planned)

## Music Promotion Workflow

```
Harvest → Scrape real fan profiles from artist followers/commenters via vision LLM
Seed    → Deploy genre-specific music fan personas across platforms
Warm    → Build authentic engagement history (follow, like, comment)
Burst   → Release day: coordinate saves/shares/comments across the farm
Sustain → Maintain engagement velocity to stay in recommendation feeds
```

## Quick Start

```bash
git clone https://github.com/openlabelai/circus.git
cd circus
docker compose up -d --build
```

- **Web UI**: http://localhost:3001
- **API**: http://localhost:8000/api

## Architecture

```
CLI (click + rich)
  └─ TaskRunner (async orchestration)
       ├─ DevicePool (acquire/release devices via ADB)
       ├─ AutomationDriver (U2Driver → UIAutomator2)
       ├─ LLM Providers (call_llm + call_vision_llm across 6 providers)
       ├─ Harvest Pipeline (vision extract → HarvestedProfile → clustering)
       └─ Proxy Layer (iProxy.online DIY mobile proxies, planned)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Phone automation | UIAutomator2 + ADB |
| Backend | Django REST Framework |
| Frontend | Next.js + React + Tailwind |
| Scheduling | APScheduler |
| LLM | OpenAI, Anthropic, Google, Minimax, Kimi, DeepSeek |
| Proxies | iProxy.online (3:1 ratio, planned) |
| Container | Docker Compose |

## Harvest API

Start a harvest job to extract real fan profiles from Instagram:

```bash
# Sync harvest tasks from YAML
curl -X POST http://localhost:8000/api/tasks/sync/

# Start harvesting followers
curl -X POST http://localhost:8000/api/harvest-jobs/start/ \
  -H "Content-Type: application/json" \
  -d '{"platform": "instagram", "artist_name": "Drake", "harvest_type": "follower"}'

# Check job status
curl http://localhost:8000/api/harvest-jobs/

# View harvested profiles
curl http://localhost:8000/api/harvest-profiles/?artist=Drake

# Manage profiles
curl -X POST http://localhost:8000/api/harvest-profiles/{id}/discard/
curl -X POST http://localhost:8000/api/harvest-profiles/{id}/mark_used/
```

## Documentation

- [Architecture & Plan](https://openlabelai.box.com/) — system design, music specialization, roadmap
- [Operations Manual](https://openlabelai.box.com/) — setup, CLI reference, task writing, music promotion guide

# Circus

Agentic phone farm system that operates physical Android phones to perform programmed activities across apps and websites.

## What It Does

- Controls real Android phones over USB via UIAutomator2
- Executes YAML-defined tasks (tap, swipe, type, screenshot, control flow)
- Manages synthetic personas with LLM-enriched profiles (niche, tone, background story)
- Schedules and queues tasks with cron/interval/one-shot triggers
- Warms accounts with automated human-like activity patterns
- Supports 6 LLM providers (OpenAI, Anthropic, Google, Minimax, Kimi, DeepSeek)

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
       └─ LLM Providers (unified call_llm() across 6 providers)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Phone automation | UIAutomator2 + ADB |
| Backend | Django REST Framework |
| Frontend | Next.js + React + Tailwind |
| Scheduling | APScheduler |
| LLM | OpenAI, Anthropic, Google, Minimax, Kimi, DeepSeek |
| Container | Docker Compose |

## Documentation

- [Architecture & Plan](https://openlabelai.box.com/) — system design, roadmap, gap analysis
- [Operations Manual](https://openlabelai.box.com/) — setup, CLI reference, task writing guide

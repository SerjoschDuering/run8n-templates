# AI Workflows Template - Investigation Plan

## Status: Draft / For Later Investigation

## The Problem

Windmill scripts live in `windmill-monorepo/` (synced to server).
AI workflow templates would live in `run8n-templates/ai-workflows/`.
**How do we keep shared Python code (agents, tools) in sync?**

## Architecture Options

### Option A: Shared Package (Recommended)

Make this folder a pip-installable Python package. Then any Windmill script,
FastAPI app, or notebook can `pip install` it from git and import shared code.

**Why?** Same pattern as `pip install requests` - but it's YOUR code.
Update once, use everywhere. No copy-paste, no sync scripts.

```
run8n-templates/ai-workflows/
├── pyproject.toml         # Makes it pip-installable
└── run8n_ai/              # Your package
    ├── agents/
    ├── tools/
    └── graphs/

# Install anywhere via:
pip install git+https://github.com/you/run8n-templates.git#subdirectory=ai-workflows

# Then in any Windmill script:
from run8n_ai.agents import ResearchAgent
```
- No private PyPI needed - just install from git URL
- Version/pin it: `pip install git+...@v1.0.0`
- Single source of truth

### Option B: CI Sync
```
GitHub Action on run8n-templates push:
  → Copy ai-workflows/lib/* to windmill-monorepo/f/ai/lib/
  → Commit & push
```
- Automated sync
- More moving parts

### Option C: Git Submodule
```
windmill-monorepo/
└── f/ai/
    └── lib/ → submodule: run8n-templates/ai-workflows/lib
```
- Native git solution
- Submodules can be painful

## Stack Integration

| Component | Role |
|-----------|------|
| Windmill | Job runner, queues, HTTP endpoints |
| pydantic-ai | Agent framework |
| pydantic-graph | Multi-step orchestration |
| DBOS | Durable execution (uses PostgreSQL) |
| Qdrant | Vector search tools |
| PostgreSQL | State persistence, checkpoints |

## Minimal First Step

1. Create `run8n_ai` package with one example agent
2. Test importing in Windmill script manually
3. Decide sync strategy based on friction

## To Investigate

- [ ] Windmill's native dependency management (requirements per script?)
- [ ] DBOS setup with existing PostgreSQL
- [ ] Pydantic-graph state persistence options
- [ ] Best practice for sharing code across Windmill workspace

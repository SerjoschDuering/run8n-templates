# Philosophy: Frontend-Heavy Architecture

**Status:** Placeholder - To be expanded

---

## Core Principle

> Frontend-heavy: all rendering, computation, and state lives in the browser.
> Backend (Windmill/PostgreSQL) is only for auth, persistence, and real-time sync.

---

## Why Frontend-Heavy?

1. **deck.gl is powerful** - Can render 500k+ cells at 60fps with proper data format
2. **TypedArrays are fast** - Client-side compute with SoA pattern is performant
3. **Latency matters** - User interactions need immediate feedback
4. **Offline capable** - Heavy computation works without network

---

## Backend Role (run8n Stack)

| Service | Purpose | NOT For |
|---------|---------|---------|
| GoTrue | Auth, sessions, tokens | - |
| Windmill | Save/load data, async jobs | Real-time compute |
| PostgreSQL/PostGIS | Persistence, spatial queries across sessions | Live analytics |
| Soketi | Broadcast changes to other users | Heavy data transfer |
| Redis | Session cache | - |

---

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│  BROWSER (Does the heavy lifting)                   │
├─────────────────────────────────────────────────────┤
│  deck.gl         → Renders grids, layers, features  │
│  TypedArrays     → SoA pattern for large datasets   │
│  Zustand         → State management + caching       │
│  Turf.js         → Spatial analysis                 │
│  Web Workers     → Offload CPU-intensive tasks      │
└──────────────────────┬──────────────────────────────┘
                       │
    Only when needed:  │  • Auth tokens (GoTrue)
                       │  • Save/Load (Windmill → PostgreSQL)
                       │  • Real-time sync (Soketi broadcasts)
                       │  • Heavy async jobs (Windmill)
                       ▼
┌─────────────────────────────────────────────────────┐
│  run8n BACKEND (Persistence + Sync)                 │
└─────────────────────────────────────────────────────┘
```

---

## Anti-Patterns

| Don't Do | Why | Do Instead |
|----------|-----|------------|
| Send every click to server | Latency, cost | Process locally, sync periodically |
| Store grid data in PostgreSQL for rendering | Network overhead | Store in browser TypedArrays |
| Run KPI calculations on server | Unnecessary round-trip | Client-side compute + cache |
| Full reload on every change | Wasteful | Delta updates via Soketi |

---

## References

- See `reference/CONSOLIDATED_PLATFORM_RECOMMENDATIONS.md` for module architecture
- See `reference/ARCHITECTURE_CRITICAL_FEEDBACK.md` for known gaps

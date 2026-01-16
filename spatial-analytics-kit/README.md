# Spatial Analytics Kit

A pattern library for building frontend-heavy spatial analytics applications on the run8n stack.

## What This Is

**NOT boilerplate code.** This is a collection of:

- **Concepts** - Module definitions and contracts
- **Patterns** - Framework-agnostic logic to implement
- **Recipes** - run8n-specific integrations (Windmill, Soketi, GoTrue)
- **Checklists** - Quality control for AI generation

AI coding agents read these docs and implement fresh each time.

## Philosophy

> Frontend-heavy: all rendering, computation, and state lives in the browser.
> Backend is only for auth, persistence, and real-time sync.

## Stack

| Layer | Tech |
|-------|------|
| Rendering | deck.gl + React |
| State | Zustand (slice pattern) |
| Compute | TypedArrays, Turf.js, Web Workers |
| Auth | GoTrue |
| API | Windmill scripts |
| Database | PostgreSQL + PostGIS |
| Real-time | Soketi |

## Structure

```
spatial-analytics-kit/
├── CLAUDE.md           ← Context for AI agents
├── concepts/           ← Module definitions (the WHAT)
├── patterns/           ← Code patterns (the HOW)
├── recipes/            ← run8n implementations
├── checklists/         ← Quality control
└── reference/          ← Source architecture docs
```

## Status

**Work in Progress** - Being built incrementally. See `CLAUDE.md` for current state.

## Related

- `../fullstack/` - Base template (start here for new apps)
- `../static/` - Simple HTML sites

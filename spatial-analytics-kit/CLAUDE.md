# Spatial Analytics Kit

**Status:** Work in Progress - Placeholder Structure

**Purpose:** A collection of PATTERNS and RECIPES for building frontend-heavy spatial analytics applications on the run8n stack. AI coding agents implement these patterns from scratch - this is NOT boilerplate code to copy.

---

## Philosophy

**Frontend-heavy, backend for persistence.**

- All rendering, computation, and state lives in the browser (React + Zustand + deck.gl)
- Backend (Windmill/PostgreSQL) is only for auth, persistence, and real-time sync
- Soketi handles multi-user real-time updates

---

## What This Kit Provides

| Folder | Purpose |
|--------|---------|
| `concepts/` | Module definitions - the WHAT (contracts, types, diagrams) |
| `patterns/` | Code patterns - the HOW (framework-agnostic logic) |
| `recipes/` | run8n-specific implementations (Windmill, Soketi, GoTrue) |
| `checklists/` | Quality control (AI generation rules, performance budgets) |
| `reference/` | Source architecture docs (CONSOLIDATED + CRITICAL_FEEDBACK) |

---

## Relationship to Other Templates

```
run8n-templates/
├── fullstack/                ← Base template (auth, API, simple state)
├── static/                   ← Simple HTML sites
└── spatial-analytics-kit/    ← THIS: Extension patterns for analytics apps
```

The `fullstack/` template provides:
- GoTrue auth integration
- Windmill API wrapper (`callWindmill`)
- Basic Zustand store
- Deployment scripts

This kit ADDS:
- Grid System (SoA TypedArrays for 500k+ cells)
- KPI System (N-dimensional keys, registries)
- Spatial Index (O(1) proximity queries)
- Layer Composition (State + Config → deck.gl props)
- Streaming Adapter (Soketi real-time updates)

---

## Module Priority (from Gemini Review)

| Priority | Modules |
|----------|---------|
| **P0 - Essential** | Types/Domain, Coordinate System, State Store, Data Ingest, Layer Composition |
| **P1 - Core** | Grid System, KPI System, Config UI |
| **P2 - Extensions** | Streaming Adapter, Time-Series, Orchestrator |
| **P3 - Nice-to-Have** | Story Mode, AI Integration, Advanced Selection |

---

## Validation Order

Build and test modules in this order:

1. **P0: Core Types & Coordinate System** - If transforms fail, nothing visualizes
2. **P1: State & Selection** - Zustand stores, basic selection (no UI)
3. **P2: Data Ingest & Streaming** - WindmillClient + Soketi listener
4. **P3: Grid System & Spatial Index** - SoA TypedArrays, spatial hashing
5. **P4: KPI & Config** - Calculations on stored data
6. **P5: Visuals** - deck.gl/React view layer

---

## Reference Documents

These documents in `reference/` are the source material:

| Document | Description |
|----------|-------------|
| `CONSOLIDATED_PLATFORM_RECOMMENDATIONS.md` | Modular architecture synthesized from 5 production apps (~100k lines) |
| `ARCHITECTURE_CRITICAL_FEEDBACK.md` | Critical gaps identified: streaming, time-series, AI predictability |

---

## Known Gaps to Address

From critical feedback - these need solutions in the kit:

1. **Streaming Data** - Batch-only currently, need delta updates for Soketi
2. **Time-Series** - No temporal primitives, need rolling windows
3. **Orchestrator** - Underspecified, need full contract for async coordination
4. **Multi-Type Selection** - Simple Set<EntityId> can't distinguish entity types

---

## How to Use This Kit

1. Start with `fullstack/` template for your app
2. Reference `concepts/` to understand what modules you need
3. Implement from `patterns/` (framework-agnostic logic)
4. Adapt from `recipes/` for run8n-specific integrations
5. Validate against `checklists/`

---

## Work in Progress

This kit is being built incrementally:

- [ ] Concepts documented
- [ ] Patterns extracted and tested
- [ ] Recipes validated on run8n stack
- [ ] Checklists refined from real usage

Each module will be validated step-by-step before moving to the next.

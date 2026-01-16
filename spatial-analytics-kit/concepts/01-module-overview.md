# Module Overview

**Status:** Placeholder - To be expanded per module

---

## Module Dependency Graph

```
TIER 0: Foundation
├── types/domain.ts           ← ALL modules import from here
├── CoordinateSystem          ← World ↔ Screen ↔ Grid transforms
└── Utils (formatting, math)

TIER 1: Core
├── Data Ingest               ← Entities from Windmill/PostGIS
├── State (Zustand)           ← Serializable UI state only
├── Selection (Simple)        ← Current + Saved
└── Streaming Adapter         ← Soketi delta updates (run8n-specific)

TIER 2: Analytics
├── Grid System               ← SoA pattern, TypedArrays
├── KPI Storage               ← Registry + N-D keys
├── Compute Cache             ← "Charts are views"
└── Spatial Index             ← O(1) proximity queries

TIER 3: Features
├── Layer Composition         ← State + Config → deck.gl LayerProps
├── Scenarios                 ← Design variants, save/load
├── Comparison                ← Side-by-side diff
└── Config UI                 ← Token resolution, JSON-driven

TIER 4: Extensions
├── Time-Series               ← Temporal queries, rolling windows
├── Selection (Advanced)      ← History, multi-type
├── Orchestrator              ← Async coordination
└── AI Integration            ← Spatial Q&A
```

---

## Module Summaries

### TIER 0: Foundation

| Module | Purpose | Key Contract |
|--------|---------|--------------|
| **Types** | Shared type definitions | `EntityId`, `NDKey`, `GridConfig` |
| **CoordinateSystem** | Transform authority | `worldToGrid()`, `gridToWorld()` |

### TIER 1: Core

| Module | Purpose | Key Contract |
|--------|---------|--------------|
| **Data Ingest** | Load & normalize entities | `loadFromWindmill()`, `normalizeEntities()` |
| **State** | Zustand slices | `DataSlice`, `ViewSlice`, `SelectionSlice` |
| **Selection** | Track selected entities | `setSelection()`, `saveSelection()` |
| **Streaming** | Real-time updates | `onDelta()`, `applyIncremental()` |

### TIER 2: Analytics

| Module | Purpose | Key Contract |
|--------|---------|--------------|
| **Grid** | SoA storage for analysis cells | `initializeGrid()`, `addColumn()` |
| **KPI** | Calculate & store metrics | `registerKPI()`, `setResult()` |
| **Compute Cache** | Pre-computed results | `computeStats()`, `invalidate()` |
| **Spatial Index** | Fast proximity queries | `query(center, radius)` |

### TIER 3: Features

| Module | Purpose | Key Contract |
|--------|---------|--------------|
| **Layer Composition** | State → deck.gl props | `composeLayers()` |
| **Scenarios** | Design variants | `createVariant()`, `saveVariant()` |
| **Comparison** | Diff analysis | `getKPIComparison()`, `getGridDiff()` |
| **Config UI** | JSON-driven dashboards | `resolveToken()`, `resolveScorecardCards()` |

---

## Implementation Priority

See `CLAUDE.md` for validation order. Build P0 → P1 → P2 incrementally.

---

## References

- Full contracts: `reference/CONSOLIDATED_PLATFORM_RECOMMENDATIONS.md`
- Known gaps: `reference/ARCHITECTURE_CRITICAL_FEEDBACK.md`

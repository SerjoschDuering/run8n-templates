# Architecture Critical Feedback

**Sources:**
- 3-Agent Stress Test (2026-01-16)
- Audio Review: "Enforcing Architecture for AI Predictability" (2026-01-16)

**Tested Against:** CONSOLIDATED_PLATFORM_RECOMMENDATIONS.md v3.1
**Test Applications:** Traffic Analytics, Energy Dashboard, Emergency Response

---

## Executive Summary

| Application | Readiness | Effort to Adapt |
|-------------|-----------|-----------------|
| Traffic Congestion Analytics | 70% | ~40% new code |
| Building Energy Dashboard | 70% | ~30% new code |
| Emergency Response Platform | 60% | ~40% new code + pattern changes |

**Core Finding:** Architecture optimized for **static planning workflows**, not **live operational systems**.

---

## Critical Gaps (All 3 Agents Flagged)

### 1. No Time-Series Module

**Problem:** Time is encoded as strings in KPI keys (`analysis::kpi::scenario::2024-01-15T14:00`). No temporal primitives.

**What's Missing:**
- Rolling window aggregations
- Time-range queries (`getReadingsBetween(start, end)`)
- Temporal indexing (current indices are by scenario/analysis only)
- Time-based cache invalidation

**Impact:**
- Traffic: Can't compute "average speed last 5 minutes"
- Energy: Can't aggregate hourly → daily → monthly
- Emergency: Can't track incident timeline progression

**Recommended Addition (Tier 1.5):**
```typescript
interface TimeSeriesModule {
  // Storage
  appendValue(entityId: string, metric: string, value: number, timestamp: number): void;

  // Queries
  queryTimeRange(entityId: string, metric: string, range: [number, number]): TimeSeriesData;
  getLatest(entityId: string, metric: string): Reading | null;

  // Aggregation
  aggregateWindow(metric: string, windowSize: number, stride: number): AggregatedSeries;
  computeRollingStats(metric: string, windowMs: number): RollingStats;

  // Maintenance
  pruneOldData(retentionMs: number): void;
  setRetentionPolicy(metric: string, policy: RetentionPolicy): void;
}
```

---

### 2. Streaming Data Model Missing

**Problem:** Data Ingest assumes batch loads:
```typescript
loadFromGeoJSON(url: string): Promise<Entity[]>  // Full reload only
```

**What's Missing:**
- Incremental entity updates
- WebSocket/SSE subscription handling
- Out-of-order timestamp handling
- Delta merging (not full replacement)

**Impact:**
- Traffic: 30s sensor updates require full state replacement
- Energy: Live meter readings can't append to existing data
- Emergency: GPS unit tracking impossible without polling

**Recommended Addition:**
```typescript
interface StreamingDataModule {
  // Connection
  createStream(source: WebSocket | EventSource): StreamHandle;

  // Updates
  onDelta(handler: (delta: EntityDelta) => void): Unsubscribe;
  applyIncremental(updates: Map<EntityId, Partial<Entity>>): void;

  // Conflict resolution
  setMergeStrategy(strategy: 'last-write-wins' | 'timestamp' | 'custom'): void;

  // Backpressure
  setBufferSize(size: number): void;
  onBackpressure(handler: () => void): void;
}

interface EntityDelta {
  id: EntityId;
  operation: 'create' | 'update' | 'delete';
  properties?: Partial<Entity['properties']>;
  timestamp: number;
}
```

---

### 3. Orchestrator Underspecified

**Problem:** Mentioned as a "pattern" but has no contract. Critical for coordinating:
- Grid → KPI calculation flow
- Periodic background updates
- Event-driven recalculations

**Current State:** Just a code example showing manual coordination.

**What's Missing:**
- Pipeline registration
- Scheduled execution
- Event triggers
- Pause/resume capability

**Recommended Contract (Promote to Tier 2):**
```typescript
interface OrchestratorModule {
  // Pipeline management
  registerPipeline(name: string, steps: PipelineStep[]): void;
  removePipeline(name: string): void;

  // Execution
  runOnce(pipeline: string): Promise<void>;
  schedulePeriodic(pipeline: string, intervalMs: number): ScheduleHandle;
  triggerOnStateChange(pipeline: string, selector: (state: State) => unknown): void;
  triggerOnEvent(pipeline: string, eventType: string): void;

  // Control
  pausePipeline(name: string): void;
  resumePipeline(name: string): void;
  cancelSchedule(handle: ScheduleHandle): void;

  // Monitoring
  getPipelineStatus(name: string): PipelineStatus;
  getLastRunTime(name: string): number | null;
}

interface PipelineStep {
  name: string;
  execute: (context: PipelineContext) => Promise<void>;
  onError?: 'skip' | 'abort' | 'retry';
}
```

---

### 4. Selection System Too Simple

**Problem:** `Set<EntityId>` can't distinguish entity types or carry metadata.

**Current:**
```typescript
currentSelection: Set<EntityId>;  // Just IDs, no type info
```

**What's Missing:**
- Multi-entity-type selection (incidents + ambulances + shelters)
- Selection metadata (why selected, source, confidence)
- Type-safe entity access

**Impact:**
- Emergency: Can't "select 3 incidents and 5 ambulances for dispatch"
- Energy: Can't filter selection by building type
- Traffic: Can't attach segment metadata to selection

**Recommended Enhancement:**
```typescript
interface TypedSelectionModule {
  // State
  selections: {
    [entityType: string]: Set<EntityId>;
  };
  metadata: Map<EntityId, SelectionMetadata>;

  // Actions
  select(entityType: string, ids: EntityId[], source: SelectionSource): void;
  deselect(entityType: string, ids: EntityId[]): void;
  clearType(entityType: string): void;
  clearAll(): void;

  // Queries
  getByType<T extends Entity>(entityType: string): T[];
  getAllSelected(): Map<string, EntityId[]>;
  getMetadata(id: EntityId): SelectionMetadata | null;

  // Cross-type operations
  selectRelated(id: EntityId, relationshipType: string): void;
}

interface SelectionMetadata {
  source: SelectionSource;
  timestamp: number;
  confidence?: number;
  reason?: string;
}
```

---

## Module-Specific Issues

### KPI System

**Works Well:**
- N-dimensional key concept is sound
- Token resolution (`$best`, `$worst`, `$this`) is elegant
- Registry-based definitions prevent code drift

**Issues:**
- 4D keys are overkill for simple apps (2D default recommended)
- String concatenation for keys loses type safety
- No temporal indexing (time is just another string segment)

**Recommendation:**
```typescript
// Use structured objects internally, serialize only at storage boundary
interface KPIKey {
  analysis: string;
  metric: string;
  scenario?: string;
  filter?: string;
  timestamp?: number;  // NEW: first-class temporal dimension
}

// Template literal types for compile-time safety
type NDKey = `${string}::${string}::${string}::${string}`;
```

---

### Grid System

**Works Well:**
- SoA pattern is excellent for performance
- TypedArrays prevent 500k object instantiations
- Column-based storage enables efficient aggregation

**Issues:**
- No temporal dimension (can't store "grid at time T")
- No concept of historical grid states
- Spatial-only queries (no spatio-temporal)

**Recommendation:**
```typescript
interface TemporalGridExtension {
  // Store grid snapshots
  saveSnapshot(timestamp: number): void;

  // Query historical
  getColumnAtTime(name: string, timestamp: number): Float32Array | null;
  getColumnHistory(name: string, timestamps: number[]): Map<number, Float32Array>;

  // Diff
  computeDiff(columnName: string, t1: number, t2: number): Float32Array;
}
```

---

### Compute Cache

**Works Well:**
- "Charts Are Views" pattern prevents render-time computation
- Cache key convention is clear
- TTL-based expiration mentioned

**Issues:**
- No incremental updates (append new value without full recompute)
- No rolling window support
- Batch-oriented, not stream-oriented

**Recommendation:**
```typescript
interface StreamingCacheExtension {
  // Incremental updates
  appendValue(cacheKey: string, value: number, timestamp: number): void;

  // Rolling computations
  getRollingMean(key: string, windowSize: number): number;
  getRollingStats(key: string, windowSize: number): RollingStats;

  // Stream-aware invalidation
  setMaxAge(key: string, maxAgeMs: number): void;
  pruneStale(): void;
}
```

---

## What Works Well (Unanimous Praise)

### Spatial Index Module
- Grid-based hashing is perfect for proximity queries
- O(K) vs O(N) is critical for real-time performance
- Clean contract, easy to compose

### Scenario Comparison
- Design variants pattern transfers to all domains
- IndexedDB persistence for binary data is production-ready
- Diff heatmaps work for any numeric comparison

### Config-Driven UI
- Token resolution reduces code duplication
- Layer inheritance chain is elegant
- Zod validation catches config errors early

### Layer Composition (Gemini-suggested)
- Separating `Entity[] + Config → LayerProps[]` is correct
- Keeps visual logic out of components
- Enables reactive accessors

---

## Architecture Bias Analysis

### Designed For (Planning Apps)
- Batch data loads (GeoJSON, CSV)
- Snapshot comparisons (Scenario A vs B)
- User-initiated actions (click to analyze)
- Stateless transforms (compute once, cache)

### Struggles With (Operational Apps)
- Streaming data (WebSocket, SSE)
- Time-series analysis (trends, forecasts)
- Background automation (scheduled jobs)
- Stateful entities (lifecycle, FSM)

### Root Cause
Source apps (AIT Dashboard, ISOCARP Workshop, LAND-Dashboard, etc.) are all **planning tools**:
- Urban planners design scenarios
- Analysts compare alternatives
- Users explore data interactively

None are **operational systems**:
- Traffic control centers
- Energy grid operators
- Emergency dispatchers

---

## Recommended Module Priority Update

### Current (v3.1)
```
P0: Types, Data Ingest, State, Selection (Simple)
P1: KPI Storage, Layer Composition, Config UI
P2: Grid, Compute Cache, Orchestrator
```

### Proposed (v3.2)
```
P0: Types, Data Ingest, State, Selection (Simple), CoordinateSystem
P0.5: Time-Series Module (NEW)           ← Promote to near-core
P1: KPI Storage, Layer Composition, Config UI
P1.5: Streaming Data Adapter (NEW)       ← Essential for live apps
P2: Grid, Compute Cache, Orchestrator (FULL CONTRACT)
P2.5: Multi-Entity Selection (extension)  ← For complex apps
```

---

## New Patterns to Document

### 1. State vs Cache vs Stream Split

```
STATE (Zustand)     → UI flags, selection, active scenario (small, serializable)
CACHE (Refs/Module) → Grid arrays, spatial index, computed stats (large, non-serializable)
STREAM (External)   → WebSocket data, real-time updates (ephemeral, append-only)
```

### 2. CQRS for Mixed Workloads

For apps with heavy reads AND writes:
- **Command Model:** WebSocket → event log → state mutations
- **Query Model:** Optimized views (spatial index, time-series, aggregates)

### 3. State Machine Pattern

For entities with lifecycle:
```typescript
interface EntityStateMachine<S extends string, E extends string> {
  currentState: S;
  transitions: Record<S, Record<E, S>>;
  dispatch(event: E): S;
  canTransition(event: E): boolean;
}

// Example: Incident lifecycle
type IncidentState = 'reported' | 'dispatched' | 'on_scene' | 'resolved';
type IncidentEvent = 'dispatch' | 'arrive' | 'resolve' | 'reopen';
```

---

## Audio Review: AI Predictability Issues

*Source: "Enforcing Architecture for AI Predictability" review*

This section addresses issues specifically impacting AI agent effectiveness when working with the codebase.

### 1. Visual & Spatial Architecture (AI Friction)

**The Issue:**
Platform lacks "scaffolding" to translate core data into visual elements. Coordinate transformation logic (Y-flips, WGS84 conversions) and asset paths are scattered across components. Forces AI agents to "guess" rendering logic → brittle code.

**Cross-Reference:** Aligns with Gemini's review noting Layer Composition and Coordinate System as missing modules.

**Actionable Solutions:**

| Action | Priority | Rationale |
|--------|----------|-----------|
| **Coordinate System Module** | P0 | Single authority for world↔screen↔grid transforms. Remove spatial logic from components. |
| **Layer Composition Module** | P1 | Translate `Entity[] + Config → LayerProps[]`. Distinct from state. |
| **Asset Manager** | P1.5 | Unified registry for 3D models, icons, textures. Replace hardcoded paths. |

**Implementation Contract:**
```typescript
interface CoordinateSystemModule {
  // Transforms
  worldToScreen(lon: number, lat: number): [number, number];
  screenToWorld(x: number, y: number): [number, number];
  worldToGrid(lon: number, lat: number): { row: number; col: number };
  gridToWorld(row: number, col: number): [number, number];

  // Y-flip handling (grid row 0 = south)
  flipGridY(row: number, totalRows: number): number;

  // Projection
  setProjection(projection: 'EPSG:4326' | 'EPSG:3857' | string): void;
  getMetersPerPixel(zoom: number): number;
}

interface AssetManagerModule {
  // Registration
  registerAsset(id: string, config: AssetConfig): void;
  registerAssetBundle(bundle: AssetBundle): void;

  // Loading
  loadGLTF(id: string): Promise<THREE.Object3D>;
  loadIcon(id: string): Promise<HTMLImageElement>;
  loadTexture(id: string): Promise<THREE.Texture>;

  // Resolution (NO hardcoded paths in components)
  getAssetPath(id: string): string;
  getAssetMetadata(id: string): AssetMetadata;
}
```

---

### 2. KPI & Data Engine Performance (AI Confusion)

**The Issue:**
- 4D Key flat structure forces O(N) scans for statistical aggregation (e.g., average across 10,000 buildings)
- Token Resolver returns inconsistent types (strings vs numbers mixed)
- High cognitive load for developers, confusion for AI agents

**Cross-Reference:** All 3 stress-test agents noted KPI aggregation performance concerns.

**Actionable Solutions:**

| Action | Priority | Rationale |
|--------|----------|-----------|
| **Index Structure** | P1 | Shift aggregation from O(N) scan to O(1) index lookup |
| **Standardize Token Resolution** | P1 | Strict return type: `{type: "value", value: 24.5}` not mixed primitives |
| **Unify Calculation Logic** | P2 | Single code path for real-time and scenario KPIs |

**Type-Safe Token Resolution:**
```typescript
// BEFORE: Unpredictable return types
resolveToken('$best'): string | number  // AI can't predict

// AFTER: Structured, predictable
interface TokenResult {
  type: 'scenario_key' | 'numeric_value' | 'filter_key';
  value: string | number;
  metadata?: {
    scenarioName?: string;
    unit?: string;
  };
}

resolveToken('$best'): TokenResult
// Returns: { type: 'scenario_key', value: 'scenario_abc', metadata: { scenarioName: 'Solar Retrofit' } }

resolveToken('$average'): TokenResult
// Returns: { type: 'numeric_value', value: 24.5, metadata: { unit: '°C' } }
```

**Index Structure for O(1) Aggregation:**
```typescript
interface KPIIndexStructure {
  // Primary storage
  results: Record<NDKey, KPIResult>;

  // Indices for fast aggregation
  indices: {
    byAnalysis: Record<string, Set<NDKey>>;
    byKpi: Record<string, Set<NDKey>>;
    byScenario: Record<string, Set<NDKey>>;
    byFilter: Record<string, Set<NDKey>>;
    byTimestamp: Record<number, Set<NDKey>>;  // NEW: temporal index
  };

  // Pre-computed aggregates (invalidate on write)
  aggregateCache: {
    [`${analysis}::${kpi}::mean`]: number;
    [`${analysis}::${kpi}::stddev`]: number;
  };
}
```

---

### 3. Governance & Modularity (Enforcement Gap)

**The Issue:**
"Soft limits" and developer discipline have failed. Result: monolithic files reaching 2,500+ lines. AI agents struggle to navigate or modify safely. Feature-driven development skips extraction refactoring.

**Root Cause:** No automated enforcement. Guidelines exist but aren't blocking.

**Actionable Solutions:**

| Action | Priority | Rationale |
|--------|----------|-----------|
| **Automate Hard Merge Gates** | P0 | CI/CD blocks PRs if files exceed limits |
| **Update AI Generation Checklist** | P0 | Require sub-slice extraction *during* generation |

**ESLint Rule Example:**
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'max-lines': ['error', {
      max: 200,           // Slices
      skipBlankLines: true,
      skipComments: true
    }],
    'max-lines-per-function': ['error', { max: 50 }],
  },
  overrides: [
    {
      files: ['**/hooks/*.ts'],
      rules: { 'max-lines': ['error', { max: 300 }] }
    },
    {
      files: ['**/services/*.ts'],
      rules: { 'max-lines': ['error', { max: 400 }] }
    }
  ]
};
```

**AI Generation Checklist (Add to CLAUDE.md):**
```markdown
## Before Completing Code Generation

- [ ] File under 200 lines? If not, extract sub-module NOW (not "later")
- [ ] Hook under 300 lines? If not, split by concern NOW
- [ ] No new `any` types introduced?
- [ ] Coordinate transforms use CoordinateSystem module (not inline math)?
- [ ] Asset paths use AssetManager (not hardcoded strings)?
- [ ] Token resolution uses structured TokenResult type?
```

---

### 4. Selection & State Management (Sync Loops)

**The Issue:**
- Multi-view synchronization loops ("echoes") where components endlessly trigger updates
- 5-tier selection topology is over-engineered for standard use cases

**Cross-Reference:** Emergency Response agent noted Selection System inadequacy for multi-type entities.

**Actionable Solutions:**

| Action | Priority | Rationale |
|--------|----------|-----------|
| **Source Tracking** | P0 | UUID-based system tracks change source, prevents echo loops |
| **Simplify Default Topology** | P1 | 2-tier default (Current + Saved), Advanced as optional extension |
| **Mandate useShallow** | P0 | Prevent infinite re-renders from Map/Set selectors |

**Source Tracking Implementation:**
```typescript
interface SelectionState {
  currentSelection: Set<EntityId>;
  savedSelections: Record<string, Set<EntityId>>;

  // Echo prevention
  lastChangeId: string;      // UUID for each change
  lastSource: SelectionSource;

  // Actions
  setSelection: (ids: EntityId[], source: SelectionSource) => void;
}

// In component sync hook
useEffect(() => {
  const unsub = useStore.subscribe(
    (state) => ({ ids: state.currentSelection, source: state.lastSource }),
    ({ ids, source }) => {
      // Only sync TO viewer if change didn't come FROM viewer
      if (source !== 'viewer') {
        syncToViewer(ids);
      }
    },
    { equalityFn: shallow }
  );
  return unsub;
}, []);
```

**Selection Topology Tiers:**
```typescript
// TIER 1: Simple Selection (Default)
interface SimpleSelection {
  current: Set<EntityId>;
  saved: Record<string, Set<EntityId>>;
}

// TIER 2: Advanced Selection (Optional Extension)
interface AdvancedSelection extends SimpleSelection {
  history: Set<EntityId>[];
  historyIndex: number;
  referenceSelection: Set<EntityId> | null;
  metadata: Map<EntityId, SelectionMetadata>;

  // History operations
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

**useShallow Mandate:**
```typescript
// WRONG: Will re-render on every state change
const selection = useStore(s => s.currentSelection);  // Set comparison fails

// CORRECT: Shallow comparison for collections
import { useShallow } from 'zustand/react/shallow';

const selection = useStore(useShallow(s => Array.from(s.currentSelection)));
// Or
const selectionSize = useStore(s => s.currentSelection.size);  // Primitive OK
```

---

## Testing Recommendations

Before calling the architecture "production-ready," test against:

1. **High-frequency updates** - 1000 entities updating every second
2. **Large time-series** - 1M readings over 1 year
3. **Multi-user concurrency** - 10 users editing same scenario
4. **Offline-first** - Works without network, syncs on reconnect
5. **Sub-second queries** - Spatial + temporal + aggregation in <200ms

---

## Summary

The modular architecture is **70% ready** for analytical dashboards and planning tools. The remaining 30% gap combines structural issues (agent stress tests) with AI-predictability concerns (audio review).

### Combined Priority Matrix

| Gap | Source | Priority | Effort | Impact |
|-----|--------|----------|--------|--------|
| Source Tracking (Selection) | Audio | P0 | 0.5 days | Prevents sync loops |
| useShallow Mandate | Audio | P0 | 0.5 days | Prevents re-renders |
| Hard Merge Gates (ESLint) | Audio | P0 | 1 day | Enforces file limits |
| AI Generation Checklist | Audio | P0 | 0.5 days | Guides AI extraction |
| Coordinate System Module | Audio + Gemini | P0 | 2 days | Centralizes transforms |
| Time-Series Module | Agents (all 3) | P0.5 | 2-3 days | Enables temporal queries |
| KPI Index Structure | Audio + Agents | P1 | 1-2 days | O(1) aggregation |
| Token Type Standardization | Audio | P1 | 1 day | AI predictability |
| Layer Composition Module | Audio + Gemini | P1 | 2 days | Visual scaffolding |
| Streaming Data Adapter | Agents (all 3) | P1.5 | 2-3 days | Live data support |
| Asset Manager | Audio | P1.5 | 1-2 days | No hardcoded paths |
| Orchestrator Full Contract | Agents (all 3) | P2 | 1-2 days | Background coordination |
| Selection Topology Tiers | Audio + Agent | P2.5 | 1 day | Simple default + Advanced opt-in |

### Effort Breakdown

| Phase | Items | Time |
|-------|-------|------|
| **Phase 1: Quick Wins** | Source tracking, useShallow, ESLint rules, AI checklist | 2-3 days |
| **Phase 2: Core Modules** | Coordinate System, Time-Series, KPI Indices | 5-7 days |
| **Phase 3: Visual Layer** | Layer Composition, Asset Manager | 3-4 days |
| **Phase 4: Live Data** | Streaming Adapter, Orchestrator | 4-5 days |

**Total to full coverage:** ~3 weeks of focused development

### Key Insight

The audio review adds a crucial dimension: **AI predictability**. The agent stress tests found missing modules; the audio review explains *why* AI struggles with existing modules:
- Scattered coordinate logic → AI guesses rendering math
- Mixed token return types → AI can't predict function signatures
- No enforcement → AI generates code that violates limits

Both sources converge on: **Modules need clear contracts, centralized authority, and automated enforcement.**

---

## Appendix A: Flexible KPI Keys (Summary)

**Problem:** Fixed 4D keys force unused dimensions, no temporal queries, O(N) aggregation.

**Solution: Schema-Defined Keys**
```typescript
// App defines its dimensions (2D, 3D, 4D - whatever fits)
const schema = { dimensions: ['metric', 'scenario', 'timestamp'], indexed: ['metric', 'scenario'] };

// Use objects internally (not strings) - serialize only at storage boundary
const key = { metric: 'consumption', scenario: 'solar', timestamp: 1705330800000 };

// Tokens always return structured types (not mixed string|number)
resolveToken('$best') → { type: 'scenario_key', value: 'solar', metadata: {...} }
```

**Key Changes:**
1. Apps define dimensions upfront (no forced 4D)
2. Object keys internally → string only at IndexedDB/JSON boundary
3. Hierarchical time: `{ year: 2024, month: 1 }` enables roll-up queries
4. Auto-build composite indices for frequent query patterns
5. Tokens return `TokenResult` objects, never raw primitives

**Effort:** ~5 days | **Benefit:** Type-safe, flexible, O(1) aggregation

---

## Appendix B: Gap Resolution Decisions (2026-01-16)

*Source: Architecture gap analysis session*

### B.1 Module Wiring: Direct Import + Simple Orchestrator

**Decision:** Use direct imports for types, simple class-based Orchestrator for runtime coordination.

```typescript
// Simpler than pipeline-heavy OrchestratorModule - just registration + access
class Orchestrator {
  private modules = new Map<string, unknown>();

  register<T>(name: string, instance: T): void {
    this.modules.set(name, instance);
  }

  get<T>(name: string): T {
    return this.modules.get(name) as T;
  }
}

// Usage: types from domain.ts, instances from orchestrator
import type { GridModule } from '@/types/domain';
const grid = orchestrator.get<GridModule>('grid');
```

**Why:** DI container is over-engineered. Direct imports + centralized Orchestrator = 80% benefit, 20% complexity.

---

### B.2 Async Coordination: Module Manifest with Dependency Resolution

**Decision:** Explicit dependency graph with topological-sort bootstrap.

```typescript
// src/modules/manifest.ts
export const MODULE_MANIFEST: ModuleDefinition[] = [
  { name: 'coordinateSystem', deps: [], init: initCoordinateSystem },
  { name: 'dataIngest', deps: ['coordinateSystem'], init: initDataIngest },
  { name: 'spatialIndex', deps: ['dataIngest'], init: initSpatialIndex },
  { name: 'grid', deps: ['dataIngest', 'coordinateSystem'], init: initGrid },
  { name: 'kpi', deps: ['grid'], init: initKPI },
];

// Bootstrap with parallel init of ready modules
async function bootstrapModules(orchestrator: Orchestrator): Promise<void> {
  const initialized = new Set<string>();
  const pending = [...MODULE_MANIFEST];

  while (pending.length > 0) {
    const ready = pending.filter(m => m.deps.every(d => initialized.has(d)));
    if (ready.length === 0) throw new Error('Circular dependency detected');

    await Promise.all(ready.map(async (m) => {
      await m.init(orchestrator);
      orchestrator.register(m.name, m.instance);
      initialized.add(m.name);
    }));

    pending.splice(0, pending.length, ...pending.filter(m => !initialized.has(m.name)));
  }
}
```

---

### B.3 Error Handling: Isolate + Report Pattern

**Decision:** Errors isolate per-module, report to central slice. No cascading failures.

```typescript
// types/errors.ts
interface ModuleError {
  module: string;
  operation: string;
  error: Error;
  timestamp: number;
  recoverable: boolean;
}

// errorSlice.ts
interface ErrorSlice {
  errors: ModuleError[];
  hasError: (module: string) => boolean;
  getModuleError: (module: string) => ModuleError | null;
  reportError: (error: ModuleError) => void;
  clearError: (module: string) => void;
}

// Module pattern: catch, report, return gracefully
async function loadGridData(url: string): Promise<void> {
  try {
    const data = await fetch(url);
    // ... process
  } catch (err) {
    useStore.getState().reportError({
      module: 'grid',
      operation: 'loadGridData',
      error: err as Error,
      timestamp: Date.now(),
      recoverable: true,
    });
    return; // Don't cascade
  }
}

// Component: check module error, show retry UI
function GridLayer() {
  const gridError = useStore(s => s.getModuleError('grid'));
  if (gridError) return <LayerErrorState module="grid" onRetry={reloadGrid} />;
  return <DeckGLGridLayer />;
}
```

**Key principle:** KPI with failed Grid returns `null`, UI shows "Data unavailable" - not crash.

---

### B.4 Performance Budgets: Concrete Targets

| Operation | Budget | Measurement Point |
|-----------|--------|-------------------|
| Grid render (500k cells) | <16ms | `requestAnimationFrame` callback |
| KPI calculation (single) | <5ms | Calculator function |
| KPI batch (all scenarios) | <50ms | Full comparison modal |
| Spatial query (radius) | <2ms | `spatialIndex.query()` |
| Selection change → UI | <100ms | User-perceived latency |
| Initial data load | <3s | First meaningful paint |
| Scenario switch | <200ms | Grid + KPI + render |

---

### B.5 Testing Strategy: Minimum Coverage Per Module

| Module | Unit Tests | Integration Tests | Performance Tests |
|--------|------------|-------------------|-------------------|
| types/domain.ts | Type tests (tsd) | - | - |
| CoordinateSystem | 100% transforms | With Grid | - |
| Data Ingest | Schema validation | Full pipeline | Load time |
| State Store | Slice actions | Cross-slice | Selector perf |
| Selection | Actions + source tracking | With Viewer | - |
| Grid | SoA operations, queries | With KPI | Render budget |
| KPI | Registry, key parsing, tokens | Full calculation | Batch perf |
| Spatial Index | Insert/query/bounds | With Selection | Query budget |

---

### B.6 Pattern Conflicts: Final Decisions

| Decision | **Choice** | Rationale |
|----------|-----------|-----------|
| Selection complexity | **Simple (2-tier)** | 5-tier is over-engineered; add Advanced as extension |
| KPI calculation | **Orchestrator-driven** | Decouples Grid from KPI, enables batch |
| Config format | **TypeScript const + Zod** | Type-safe, IDE completion, validation |
| Grid storage | **Module-level ref** | Non-serializable, no UI reactivity needed |
| Color mapping | **Centralized ColorEngine** | Single source, config-driven scales |

---

### B.7 Implementation Sequence

```
Phase 1: Foundation (2 days)
├── types/domain.ts (shared types)
├── CoordinateSystem module
└── Error handling slice

Phase 2: Data Layer (2 days)
├── Data Ingest with Zod validation
├── Spatial Index
└── Module manifest + bootstrap

Phase 3: State (1 day)
├── Core Zustand slices
└── Selection (Simple) with source tracking

Phase 4: Analysis (3 days)
├── Grid Module (ref-based storage)
├── KPI Storage with indices
└── Orchestrator for Grid → KPI flow

Phase 5: Integration (2 days)
├── Layer Composition
├── Config UI with token resolution
└── Performance monitoring

Total: ~10 days for core architecture
```

---

*Generated from:*
- *3-agent stress test: Traffic, Energy, Emergency Response applications*
- *Audio review: "Enforcing Architecture for AI Predictability"*
- *Architecture gap resolution session (2026-01-16)*

*Last updated: 2026-01-16*

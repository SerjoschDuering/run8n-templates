# Urban Analytics Modular Platform Architecture

**Synthesized from:** 5 production applications (AIT Dashboard, bokehDashboard_v2, ISOCARP Workshop, LAND-Dashboard, prec-geo-showcase)
**Purpose:** Modular template for AI-assisted urban analytics development
**Version:** 3.1 (2026-01-16) - Gemini-reviewed
**Design Goal:** Well-defined modules that can be composed on-demand via AI coding, NOT a monolithic system

---

## Design Philosophy: Modules Over Monolith

```
THE AI-COMPOSABLE ARCHITECTURE PRINCIPLE
═══════════════════════════════════════════════════════════════════════════
We don't need a PERFECT system that does everything.
We need a WELL-DEFINED set of modules that:
  1. Have CLEAR BOUNDARIES (explicit I/O contracts)
  2. Are PROVEN to work together (conceptually + technically)
  3. Can be COMPOSED on-demand by AI coding assistants
  4. Are INDEPENDENTLY implementable in 1-2 AI shots
═══════════════════════════════════════════════════════════════════════════

MODULE IMPORTANCE TIERS:
  CORE (Always needed)     → KPI System, State, Selection, Data Ingest
  COMMON (Usually needed)  → Analysis Grid, Config UI, Scenario Comparison
  OPTIONAL (On-demand)     → Story Mode, AI Chat, Clustering, Workflow Editor
```

---

## Module Dependency Graph

```
                              ┌─────────────────┐
                              │   TIER 0: BASE  │
                              │   Types + Utils │
                              └────────┬────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
    ┌───────────┐              ┌───────────────┐             ┌───────────┐
    │  MODULE 1 │              │   MODULE 2    │             │  MODULE 3 │
    │   DATA    │─────────────▶│    STATE      │◀────────────│ SELECTION │
    │  INGEST   │              │   (Zustand)   │             │  SYSTEM   │
    └───────────┘              └───────┬───────┘             └───────────┘
          │                            │                            │
          │                    ┌───────┼───────┐                    │
          │                    │       │       │                    │
          ▼                    ▼       ▼       ▼                    ▼
    ┌───────────┐        ┌─────────┐ ┌───────┐ ┌─────────┐   ┌───────────┐
    │  MODULE 4 │        │MODULE 5 │ │MOD 6  │ │MODULE 7 │   │  MODULE 8 │
    │   GRID    │◀──────▶│   KPI   │ │COMPUTE│ │ SPATIAL │   │  CONFIG   │
    │  SYSTEM   │        │ SYSTEM  │ │CACHE  │ │  INDEX  │   │    UI     │
    └───────────┘        └─────────┘ └───────┘ └─────────────┘ └───────────┘
          │                    │                                    │
          │                    │                                    │
          ▼                    ▼                                    ▼
    ┌───────────┐        ┌─────────────┐                     ┌───────────┐
    │  MODULE 9 │        │  MODULE 10  │                     │ MODULE 11 │
    │ SCENARIO  │◀──────▶│  COMPARISON │                     │ TEMPLATE  │
    │ VARIANTS  │        │    MODAL    │                     │  ENGINE   │
    └───────────┘        └─────────────┘                     └───────────┘
          │                                                        │
          │              ┌─────────────┐                           │
          └─────────────▶│  MODULE 12  │◀──────────────────────────┘
                         │     AI      │
                         │ INTEGRATION │
                         └─────────────┘
```

---

## TIER 0: Foundation (Always Include)

### Types & Utilities

Every module depends on these shared foundations:

```typescript
// types/core.ts
export type EntityId = string;  // UUID - NEVER array indices
export type NDKey = `${string}::${string}::${string}::${string}`;

// types/kpi.ts
export interface KPIResult {
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface KPIStatistics {
  best: { scenario: string; value: number };
  worst: { scenario: string; value: number };
  average: number;
  median: number;
  rankings: Array<{ scenario: string; value: number; rank: number }>;
}

// types/grid.ts
export interface GridConfig {
  cellSize: number;      // meters
  bounds: Bounds;
  rows: number;
  cols: number;
}

export interface AnalysisGridData {
  cellCenters: Float64Array;
  cellPolygons: Float64Array;
  columns: Map<string, Float32Array>;
  gridConfig: GridConfig;
}
```

---

## MODULE 1: Data Ingest

**Pattern Source:** bokehDashboard multi-source + prec-geo-showcase GeoJSON

### Contract

```typescript
// INPUT: Raw data from various sources
type DataSource = 'geojson' | 'speckle' | 'csv' | 'osm' | 'api';

// OUTPUT: Normalized entities
interface Entity {
  id: EntityId;           // Always UUID
  properties: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
}

// ACTIONS
interface DataIngestModule {
  loadFromGeoJSON(url: string): Promise<Entity[]>;
  loadFromCSV(url: string): Promise<Entity[]>;
  loadFromSpeckle(streamId: string): Promise<Entity[]>;
  normalizeEntities(raw: unknown[], source: DataSource): Entity[];
}
```

### Key Implementation Patterns

1. **Convergent Pipeline:** All sources normalize to same `Entity` structure
2. **Column Type Inference:** Sample first 100 values to detect `'numeric' | 'categorical' | 'boolean'`
3. **UUID Assignment:** CSV rows get `csv_${index}`, Speckle uses native IDs
4. **Schema Validation:** Zod at ingestion point (fail fast)

---

## MODULE 2: State Store (Zustand)

**Pattern Source:** bokehDashboard 11-slice + ISOCARP 12-slice

### Contract

```typescript
// Core slices (always)
createDataSlice      // entities[], columns[], indices
createViewSlice      // viewport, layerVisibility
createSelectionSlice // currentSelection, savedSelections, history
createUISlice        // panels, modals, tabs

// Feature slices (compose as needed)
createAnalysisSlice  // gridData, activeColumn
createVariantSlice   // scenarios, simulations
createComputeSlice   // statistics cache
createToolSlice      // activeTool, drawing
createStorySlice     // narrative playback
createChatSlice      // spatial Q&A
```

### Critical Rules

1. **Slice Size Limit:** Max 200 lines, extract sub-slices when exceeded
2. **Individual Selectors:** NEVER destructure objects from selectors
3. **Records Not Maps:** Use `Record<string, T>` for DevTools visibility
4. **Separate KPI Store:** Avoid circular dependencies

```typescript
// WRONG
const { scenarios } = useStore(s => ({ scenarios: s.scenarios }))

// CORRECT
const scenarios = useStore(s => s.scenarios)
```

---

## MODULE 3: Selection System

**Pattern Source:** bokehDashboard 5-tier topology + source tracking

### Contract

```typescript
interface SelectionModule {
  // State
  currentSelection: Set<EntityId>;
  savedSelections: Map<string, Set<EntityId>>;
  selectionHistory: Set<EntityId>[];
  lastSource: SelectionSource;

  // Actions
  setCurrentSelection(ids: EntityId[], source: SelectionSource): void;
  saveSelection(name: string): void;
  restoreSelection(name: string): void;
  undo(): void;
  redo(): void;
}

type SelectionSource = 'chart' | 'viewer' | 'filter' | 'cluster' | 'load' | 'restore';
```

### Key Pattern: Source Tracking (Echo Prevention)

```typescript
// In viewer sync hook
const unsubscribe = useStore.subscribe(
  (state) => state.lastSource,
  (source) => {
    // Only sync to viewer if change didn't come FROM viewer
    if (source !== 'viewer') syncToViewer();
  }
);
```

### Selection Hash for Cache Keys

```typescript
function hashSelection(ids: Set<EntityId>): string {
  if (ids.size === 0) return 'empty';
  return Array.from(ids).sort().join(',').slice(0, 100);
}
```

---

## MODULE 4: Grid System

**Pattern Source:** prec-geo-showcase SoA + ISOCARP spatial index

### Contract

```typescript
interface GridModule {
  // Creation
  initializeGrid(bounds: Bounds, cellSize: number): AnalysisGridData;

  // Columns
  addColumn(name: string, values: Float32Array): void;
  removeColumn(name: string): void;

  // Queries
  getCellAtPosition(lon: number, lat: number): number | null;
  getCellsInPolygon(polygon: GeoJSON.Polygon): number[];
  getCellsInRadius(center: [number, number], radius: number): number[];

  // Statistics
  getColumnStats(name: string, cellIndices?: number[]): GridStats;
}
```

### Structure-of-Arrays Pattern

```typescript
// Why SoA: Avoids 500k object instantiations
const gridData: AnalysisGridData = {
  cellCenters: new Float64Array(cellCount * 2),  // [lon, lat, lon, lat, ...]
  cellPolygons: new Float64Array(cellCount * 8), // Quad vertices
  columns: new Map([
    ['utci', new Float32Array(cellCount)],
    ['wind', new Float32Array(cellCount)],
  ]),
  gridConfig: { cellSize: 2, bounds, rows: 256, cols: 256 }
};
```

---

## MODULE 5: KPI System

**Pattern Source:** AIT Dashboard 4D keys + LAND-Dashboard value resolution

### Contract

```typescript
interface KPIModule {
  // Registry
  registerKPI(definition: KPIDefinition): void;
  getKPIDefinition(id: string): KPIDefinition;

  // Storage (N-Dimensional Keys)
  setResult(key: NDKey, result: KPIResult): void;
  setResultsBatch(results: Record<NDKey, KPIResult>): void;
  getResult(key: NDKey): KPIResult | null;

  // Query API (index-based)
  queryByAnalysis(analysisId: string): KPIResult[];
  queryByScenario(scenarioKey: string): KPIResult[];
  querySeries(analysisId: string, kpiId: string, scenarios: string[]): KPIResult[];

  // Statistics
  calculateStatistics(analysisId: string, kpiId: string): KPIStatistics;

  // Tokens
  resolveToken(token: string, context: TokenContext): string | number;
}
```

### The N-Dimensional Key System

```typescript
// Key Format: analysisId::kpiId::scenarioKey::filterId
function buildKey(analysis: string, kpi: string, scenario = '', filter = 'all'): NDKey {
  return `${analysis}::${kpi}::${scenario}::${filter}`;
}

function parseKey(key: NDKey) {
  const [analysisId, kpiId, scenarioKey, filterId] = key.split('::');
  return { analysisId, kpiId, scenarioKey, filterId };
}

// Store with indices for O(1) aggregation
interface KPIStore {
  results: Record<NDKey, KPIResult>;
  indices: {
    byAnalysis: Record<string, Set<NDKey>>;
    byKpi: Record<string, Set<NDKey>>;
    byScenario: Record<string, Set<NDKey>>;
    byFilter: Record<string, Set<NDKey>>;
  };
}
```

### Token System

| Token | Resolves To | Type | Use Case |
|-------|-------------|------|----------|
| `$this` | Current column's scenario | Scenario key | Per-column values |
| `$active` | Active scenario | Scenario key | Active comparison |
| `$best` | Best performing | Scenario key | Performance comparison |
| `$worst` | Worst performing | Scenario key | Performance comparison |
| `$average` | Mean value | **Number** | Statistical reference |
| `$none` | Empty / 'all' | Filter key | No filter |

### Registry-Based KPI Definition

```typescript
const KPI_REGISTRY = {
  building_count: {
    id: 'building_count',
    name: 'Buildings',
    category: 'buildings',
    unit: '',
    goodDirection: '+',
    calculator: (ctx) => ctx.buildings?.length ?? 0,
  },
  avg_utci: {
    id: 'avg_utci',
    name: 'Thermal Comfort',
    category: 'microclimate',
    unit: '°C',
    format: '.1f',
    goodDirection: '-',
    calculator: (ctx) => calculateGridAverage(ctx.gridData, 'utci'),
  },
} as const satisfies Record<string, KPIDefinition>;

// Type-safe, auto-generates KPIId union
type KPIId = keyof typeof KPI_REGISTRY;
```

---

## MODULE 6: Compute Cache

**Pattern Source:** bokehDashboard "Charts Are Views"

### Contract

```typescript
interface ComputeModule {
  // Statistics
  computeStats(selectionHash: string, column: string): DescriptiveStats | null;
  computeHistogram(selectionHash: string, column: string, bins: number): HistogramData;
  computeCorrelation(selectionHash: string, colA: string, colB: string): number;

  // Cache management
  invalidateSelection(selectionHash: string): void;
  clearAllCaches(): void;

  // Config
  setCacheTTL(ms: number): void;
  setMaxEntries(n: number): void;
}
```

### Core Principle: Charts Are Views

**Components read pre-computed results from cache, never compute during render.**

```typescript
// Cache key convention: {scenario}::{selectionHash}::{operation}::{params}
const cacheKey = `${scenario}::${hash}::stats::${column}`;

// Check cache first
const cached = cache[cacheKey];
if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  return cached.value;
}

// Compute, cache, return
const result = computeDescriptiveStats(data, column);
cache[cacheKey] = { value: result, timestamp: Date.now() };
return result;
```

---

## MODULE 7: Spatial Index

**Pattern Source:** ISOCARP Workshop grid-based hashing

### Contract

```typescript
interface SpatialIndexModule<T extends { id: string; position: [number, number] }> {
  insert(item: T): void;
  remove(id: string): void;
  query(center: [number, number], radiusMeters: number): T[];
  queryBounds(bounds: Bounds): T[];
  clear(): void;
}
```

### Grid-Based Spatial Hashing

```typescript
class SpatialIndex<T> {
  private cells = new Map<string, T[]>();
  private cellSize = 25;  // meters

  private getCellKey(pos: [number, number]): string {
    const x = Math.floor((pos[0] * METERS_PER_DEG_LON) / this.cellSize);
    const y = Math.floor((pos[1] * METERS_PER_DEG_LAT) / this.cellSize);
    return `${x},${y}`;
  }

  query(center: [number, number], radius: number): T[] {
    // O(K) where K = cells in radius, not O(N) for all items
    const keys = this.getCellsInRadius(center, radius);
    return keys.flatMap(k => this.cells.get(k) ?? []);
  }
}
```

---

## MODULE 8: Config-Driven UI

**Pattern Source:** AIT Dashboard Topic Lens → Column + LAND-Dashboard inheritance

### Contract

```typescript
interface ConfigUIModule {
  // Registry
  registerScorecard(config: ScorecardConfig): void;
  registerAnalysis(config: AnalysisConfig): void;
  registerDashboardTab(config: TabConfig): void;

  // Resolution
  resolveLayerConfig(layerId: string, overrides?: LayerOverride[]): ResolvedLayerConfig;
  resolveScorecardCards(scorecardId: string, scenarioKey: string): ResolvedCard[];

  // Validation
  validateConfig<T>(schema: ZodSchema<T>, config: unknown): T;
}
```

### Configure Once, Display Many

```json
{
  "scorecards": ["thermal_comfort"],
  "cards": [{
    "analysisId": "thermal",
    "kpiId": "avg_utci",
    "series": [{
      "source": { "scenarioKey": "$this" }
    }, {
      "source": { "scenarioKey": "$best" }
    }]
  }]
}
```

**One config renders in every scenario column via token resolution.**

### Layer Inheritance Chain

```
Preset (base) → Scorecard (layer) → KPI (specific) → Override (runtime)
```

---

## MODULE 9: Scenario Variants

**Pattern Source:** LAND-Dashboard field resolution + prec-geo-showcase persistence

### Contract

```typescript
interface ScenarioModule {
  // Variants
  createVariant(name: string, design: DesignElements): DesignVariant;
  saveVariant(variant: DesignVariant): Promise<void>;
  loadVariant(id: string): Promise<DesignVariant>;
  deleteVariant(id: string): Promise<void>;

  // Comparison
  setActiveVariant(id: string): void;
  compareVariants(ids: string[]): ComparisonResult;

  // Field resolution
  resolveScenarioField(baseField: string, scenario: string): string;
}

interface DesignVariant {
  id: string;
  name: string;
  designElements: {
    trees: TreeFeature[];
    attractors?: AttractorFeature[];
  };
  simulations: Record<string, SerializedSimulation>;
  kpis: ScenarioKPIs;
  designVersion: number;
}
```

### IndexedDB Persistence for Binary Data

```typescript
// Float32Arrays stored as ArrayBuffer (not Base64 in JSON)
const scenarioStorage = {
  async save(variant: DesignVariant) {
    const tx = db.transaction('scenarios', 'readwrite');
    // ArrayBuffer stored directly (no serialization overhead)
    await tx.store.put(variant);
    await tx.done;
  }
};
```

---

## MODULE 10: Comparison Modal

**Pattern Source:** AIT Dashboard series comparisons + prec-geo-showcase diff heatmaps

### Contract

```typescript
interface ComparisonModule {
  // State
  setComparisonScenarios(baseline: string, variants: string[]): void;

  // Data
  getKPIComparison(kpiId: string): KPIComparisonRow[];
  getGridDiff(layer: string, baseline: string, variant: string): Float32Array;

  // UI
  openComparisonModal(): void;
  closeComparisonModal(): void;
}
```

---

## MODULE 11: Template Engine

**Pattern Source:** AIT Dashboard + LAND-Dashboard safe arithmetic

### Contract

```typescript
interface TemplateModule {
  // Processing
  processTemplate(template: string, context: TemplateContext): string;

  // KPI references
  resolveKPIReference(ref: string): number | null;

  // Safe evaluation
  evaluate(expression: string, variables: Record<string, number>): number;
}
```

### Template Syntax

```
{{kpi:analysisId:kpiId:scenarioKey:filterId}}     // KPI lookup
{{kpi:thermal:avg_utci:$active:$none:.1f}}        // With format
{{(value - baseline) / baseline * 100}}           // Math
{{value > 100 ? 'High' : 'Normal'}}               // Conditional
```

### Safe Expression Evaluation (mathjs, not eval)

```typescript
import { evaluate } from 'mathjs';

function safeEvaluate(expr: string, context: Record<string, number>): number {
  // Normalize JS to mathjs syntax
  expr = expr.replace(/===/g, '==').replace(/&&/g, ' and ');
  return evaluate(expr, context);
}
```

---

## MODULE 12: AI Integration

**Pattern Source:** AIT Dashboard Personas + prec-geo-showcase Spatial Q&A

### Contract

```typescript
interface AIModule {
  // Spatial Q&A
  assembleSpatialContext(location: [number, number], radius: number): AIContext;
  formatContextAsXML(context: AIContext): string;
  sendSpatialQuestion(question: string, context: AIContext): Promise<string>;

  // Personas (optional)
  runPersonaAssessment(personas: Persona[], scenarios: Scenario[]): Promise<Assessment[]>;
}
```

### Context Assembly

```typescript
interface AIContext {
  location: { lon: number; lat: number };
  nearbyObjects: { buildings: BuildingSummary[]; trees: TreeSummary[] };
  areaAnalysis: { utci: Stats; wind: Stats; treeDensity: number };
  activeScenario: string;
  activeKPIs: KPISnapshot;
}
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Array indices as IDs | Drift with async loads | Always use UUIDs |
| Object selectors in Zustand | Infinite re-renders | Individual selectors |
| Maps in state | DevTools blind, JSON issues | Use Records |
| Compute in components | Performance, duplication | Centralized compute module |
| Multiple debounce layers | Race conditions | Single debounce point |
| Monolithic slices | Unmaintainable | Split at 200 lines |
| Workers for small data | Serialization overhead | Main thread + rAF |
| Two code paths for KPIs | Duplication, drift | Single registry |
| Hardcoded styles | Config rigidity | Metadata-driven |

---

## Module Composition Examples

### Example 1: Basic Dashboard

```typescript
// Compose: Data + State + Selection + KPI + Config UI
const modules = [
  createDataIngestModule(),
  createStateStore([createDataSlice, createViewSlice, createSelectionSlice, createUISlice]),
  createSelectionModule(),
  createKPIModule(),
  createConfigUIModule(),
];
```

### Example 2: Full Analysis Platform

```typescript
// Compose: All core + Grid + Scenarios + Comparison + AI
const modules = [
  ...basicDashboardModules,
  createGridModule(),
  createComputeCacheModule(),
  createSpatialIndexModule(),
  createScenarioModule(),
  createComparisonModule(),
  createTemplateEngine(),
  createAIModule(),
];
```

### Example 3: Workshop Tool (ISOCARP-style)

```typescript
// Compose: Core + Grid + Spatial + Assets
const modules = [
  createDataIngestModule(),
  createStateStore([...coreSlices, createToolSlice]),
  createGridModule(),
  createSpatialIndexModule(),
  createAssetModule({ enableEcological: true }),
];
```

---

## File Structure Template

```
src/
├── modules/                     # Independent modules
│   ├── data-ingest/
│   │   ├── index.ts             # Public API
│   │   ├── loaders/             # Per-source loaders
│   │   └── types.ts
│   ├── state/
│   │   ├── index.ts
│   │   └── slices/
│   ├── selection/
│   ├── grid/
│   ├── kpi/
│   │   ├── index.ts
│   │   ├── registry.ts
│   │   ├── keys.ts
│   │   └── tokens.ts
│   ├── compute/
│   ├── spatial-index/
│   ├── config-ui/
│   ├── scenarios/
│   ├── comparison/
│   ├── templates/
│   └── ai/
│
├── config/                      # Project-specific configs
│   ├── kpis.json
│   ├── analyses.json
│   ├── dashboard.json
│   └── schemas/
│
├── components/                  # UI (no business logic)
│   ├── Map/
│   ├── Dashboard/
│   └── Modals/
│
└── types/                       # Shared types
    └── index.ts
```

---

## AI Development Guidelines

### For AI Coding Assistants

When implementing a module:

1. **Read the contract first** - Understand the expected I/O
2. **Check dependencies** - What other modules does this need?
3. **Follow the patterns** - Use the proven patterns from source apps
4. **Validate at boundaries** - Zod schemas at module entry points
5. **Keep it focused** - One module, one responsibility
6. **Max file size** - 200 lines for slices, 300 for hooks, 400 for services

### Module Implementation Checklist

```markdown
- [ ] Types defined in module's types.ts
- [ ] Contract (interface) exported from index.ts
- [ ] Zod schema for config validation
- [ ] Unit tests for core functions
- [ ] No cross-layer imports (components don't import from other modules directly)
- [ ] Documentation of dependencies on other modules
```

---

## Gemini Critical Review (2026-01-16)

All 5 architecture analyses + this consolidated document were reviewed by Gemini AI. Key findings:

### Critical Gaps Identified

**1. Layer Composition Module (MISSING)**
- We have Data Ingest (loading) and State (storage), but no module for translating state into visual configurations
- Risk: Visual logic leaks into components or bloats state slices
- **Add:** Layer Composition Module that takes `Entity[] + Config → LayerProps[]`

**2. Coordinate System Authority (UNDERWEIGHT)**
- Currently just "utils" but complex enough to be a Core Module
- Grid indices won't match map coordinates without centralized transforms
- **Promote:** CoordinateSystem to full module with World ↔ Screen ↔ Grid transforms

**3. Asset/Resource Management (MISSING)**
- Data Ingest handles raw data, but where do 3D models (GLTF), icons, textures live?
- Risk: Hardcoded paths in components
- **Add:** Asset Module for loading, caching, metadata

### Module Boundary Issues

**1. KPI ↔ Grid Tight Coupling**
- KPI Module shouldn't calculate from Grid directly
- **Fix:** KPI = Storage/Registry. Separate Orchestrator pulls from Grid → pushes to KPI

**2. Config UI vs Code Registry Conflict**
- V3 mixes JSON configs with TypeScript registries
- AI friction: Adding KPI to JSON won't work if logic lives in TS
- **Fix:** Registry = logic source of truth. Config = parameters/thresholds only

### Pattern Conflicts Resolved

**Map vs Record Rule:**
- **Serializable State (Zustand) = Records** (DevTools-visible, JSON-safe)
- **Runtime Buffers (Grid/Spatial) = Maps/TypedArrays** (keep in refs, not state tree)

**Selection Complexity:**
- 5-tier is overkill for simple apps
- **Downgrade:** Simple Selection (Current + Set) as default, Advanced Selection as extension

### AI-Composability Fixes

**1. Magic String Keys**
- LLMs mess up order (`analysis::kpi::scenario` vs `analysis::scenario::kpi`)
- **Fix:** Use structured objects in code, serialize to string only at storage boundary
- Use Template Literal types for compile-time safety

**2. Circular Dependencies**
- KPI needs Grid types, Grid needs Config, Config needs KPI
- **Fix:** Strict `types/domain.ts` that ALL modules import. AI generates this FIRST

### Simplification Recommendations

**1. 4D Keys** → Default to 2D (`Metric::Scenario`), make 4D optional
**2. Template Engine** → Move to Optional tier. Default to `Intl.NumberFormat`

### New Patterns to Add

**A. Orchestrator Pattern**
Instead of modules calling each other:
```typescript
// SimulationRunner orchestrates:
const gridResult = Grid.compute();
const kpis = KPI.calculate(gridResult);
KPIStore.setResult(kpis);
```

**B. State vs Cache Split**
- **State (Zustand):** UI flags, selection IDs, active variant (small, serializable)
- **Cache (External/Refs):** Grid arrays, Spatial Index, geometries (large, non-serializable)

**C. Module Manifest**
```typescript
// src/modules.ts - AI checks this to know available capabilities
export * as Data from './modules/data';
export * as Grid from './modules/grid';
export * as KPI from './modules/kpi';
// AI can introspect: "Is SpatialIndex available?"
```

---

## Summary: Module Priority for New Projects

| Priority | Module | When to Include |
|----------|--------|-----------------|
| **P0** | Types (domain.ts), Data Ingest, State, Selection (Simple) | Always |
| **P0.5** | Coordinate System | Always (if spatial) |
| **P1** | KPI Storage, Layer Composition, Config UI | Almost always |
| **P2** | Grid System, Compute Cache, Orchestrator | If spatial/grid analysis |
| **P3** | Scenarios, Comparison | If design variants |
| **P4** | Spatial Index, Asset Manager | If placement/3D models |
| **P5** | Selection (Advanced), Template Engine | If complex filtering/formulas |
| **P6** | AI Integration | If LLM features |
| **P7** | Story Mode, Workflow Editor | Feature-specific |

### Updated Module Dependency Graph (v3.1)

```
TIER 0: Foundation
├── types/domain.ts           ← ALL modules import from here (no circular deps)
├── CoordinateSystem          ← World ↔ Screen ↔ Grid transforms
└── Utils (formatting, math)

TIER 1: Core
├── Data Ingest               ← Entities from any source
├── State (Zustand)           ← Serializable UI state only
├── Selection (Simple)        ← Current + Saved (extend later if needed)
└── Asset Manager             ← GLTF, icons, textures

TIER 2: Analytics
├── Grid System               ← SoA pattern, TypedArrays
├── KPI Storage               ← Registry + N-D keys (2D default)
├── Compute Cache             ← "Charts are views"
└── Orchestrator              ← Coordinates Grid → KPI flow

TIER 3: Features
├── Layer Composition         ← State + Config → LayerProps
├── Scenarios                 ← Design variants, IndexedDB
├── Comparison                ← Side-by-side diff
└── Config UI                 ← Token resolution, series

TIER 4: Extensions
├── Spatial Index             ← O(1) proximity queries
├── Selection (Advanced)      ← History, reference, 5-tier
├── Template Engine           ← Dynamic text (optional)
└── AI Integration            ← Spatial Q&A, Personas
```

---

*Synthesized from ~100k+ lines across 5 production urban analytics applications*
*Optimized for AI-assisted modular composition, not monolithic deployment*
*Last updated: 2026-01-16*

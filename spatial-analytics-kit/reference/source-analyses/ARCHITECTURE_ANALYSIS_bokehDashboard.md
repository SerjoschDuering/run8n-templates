# Architecture Analysis: bokehDashboard_v2

## Executive Summary

**Project Type:** Statistical analytics dashboard with 3D visualization integration.

**Evolution:** Originally a 3000+ line Python/Bokeh analytics dashboard, migrated to a browser-based TypeScript/React application with Speckle Viewer integration.

**Tech Stack:**
- React 18 + TypeScript + Vite
- Zustand (11-slice architecture) + Immer + subscribeWithSelector
- ECharts + echarts-for-react (charting)
- @speckle/viewer (3D visualization)
- @xyflow/react (workflow editor)
- ml-kmeans, density-clustering, ml-pca, umap-js (ML)
- Comlink (Web Worker proxy)
- expr-eval (expression parsing)

**What Makes It Unique vs Other Urban Analytics Apps:**

| Aspect | Other Apps | bokehDashboard |
|--------|------------|----------------|
| Primary Focus | Spatial/Urban planning | Statistical/Analytical exploration |
| Data Source | Single GeoJSON | Multi-source (Speckle, CSV, OSM) |
| Selection | Basic current/saved | 5-tier topology with history |
| Compute | In-component | Centralized in store actions with caching |
| ML | None | K-Means, DBSCAN, PCA, UMAP |
| Workflow | None | Node-based visual editor |
| Brushing | Basic | Advanced with source tracking |

**Top 5 Patterns to Steal:**
1. EntityId (UUID) everywhere - never array indices at state boundaries
2. Selection source tracking prevents echo loops in viewer sync
3. Record-based compute cache with hash keys (DevTools visible)
4. Worker proxy via Comlink for ML operations
5. Centralized compute slice - "charts are views, not computers"

**Top 3 Anti-Patterns to Avoid:**
1. Multiple debounce layers can cause race conditions
2. Heavy use of Maps requires careful `useShallow` handling
3. Memory pressure from dual index maps on large datasets

---

## Data Pipeline

### Multi-Source Entry Points

The dashboard implements a **convergent data pipeline** where all sources normalize to the same Entity structure.

```typescript
interface Entity {
  id: EntityId;  // Always UUID string
  properties: Record<string, unknown>;
}
```

### Ingestion Strategies

| Source | Hook | Normalization |
|--------|------|---------------|
| Speckle | `useSpeckleLoader.ts` | WorldTree walk, flatten geometry nodes |
| CSV | `useCSVPipeline.ts` | Parse rows, assign synthetic UUIDs (`csv_${index}`) |
| OSM | `useOSMPipeline.ts` | Overpass API + osmAggregator.ts (Turf.js) |

### Data Flow

```
Source (Speckle/CSV/OSM)
    ↓
Hook (useSpeckleLoader / useCSVPipeline / useOSMPipeline)
    ↓
setEntities(normalizedEntities)
    ↓
dataSlice builds:
  - entities[] array
  - allIds Set<EntityId>
  - idToIndex Map<EntityId, number>
  - indexToId Map<number, EntityId>
  - columns[] string array
  - columnInfo Map<string, ColumnInfo>
    ↓
saveSelection(ALL_SELECTION_KEY, allIds)
setCurrentSelection(allIds, 'load')
```

### Column Type Inference

`dataSlice.ts:40-62` - Samples first 100 non-null values:

```typescript
function inferColumnType(values: unknown[]): ColumnType {
  const sample = values.filter((v) => v != null).slice(0, 100);
  // Check boolean → numeric → categorical
}
```

**Types:** `'numeric' | 'categorical' | 'boolean'`

---

## State Management

### 11-Slice Architecture

| Slice | Domain | Key State |
|-------|--------|-----------|
| `dataSlice` | Entities & columns | entities[], allIds, idToIndex, columnInfo |
| `selectionSlice` | Selection topology | currentSelection, savedSelections, history |
| `computeSlice` | Statistics cache | statsCache, histogramCache, kdeCache, correlationCache |
| `uiSlice` | Layout & UI | activeColumns, visiblePanels, colorMode |
| `scenarioSlice` | Multi-scenario | scenarios Map, activeScenarioId |
| `clusterSlice` | Clustering results | entityClusterLabels, clusterCentroids |
| `drSlice` | Dimensionality reduction | pcaProjectionMap, umapProjectionMap |
| `workflowSlice` | Workflow editor | workflowNodes, workflowEdges, nodeResults |
| `analyticsSlice` | Anomaly detection | anomalyIds, correlationRules |
| `csvSlice` | CSV loading state | csvStatus, csvError |
| `osmSlice` | OSM loading state | osmStatus, osmProgress |

### Why Record-Based Caching (Not Maps)

```typescript
// BAD: Maps break DevTools and JSON export
statsCache: Map<string, CacheEntry>  // NOT visible in Redux DevTools

// GOOD: Records are DevTools-inspectable and JSON-serializable
statsCache: Record<string, CacheEntry<DescriptiveStats>>
```

`computeSlice.ts:148-159`:
```typescript
const initialComputeState: ComputeState = {
  statsCache: {},
  histogramCache: {},
  kdeCache: {},
  boxPlotCache: {},
  rankValueCache: {},
  correlationCache: {},
  regressionCache: {},
  // ...
};
```

### Individual Selector Pattern (Critical!)

Components must select minimal state to prevent unnecessary re-renders:

```typescript
// BAD - re-renders on any nodeResults change
const result = useDashboardStore((s) => s.nodeResults[id]);

// GOOD - only re-renders when count changes
const resultCount = useDashboardStore((s) => s.nodeResults[id]?.length);
```

For Maps/Sets/Arrays, use `useShallow`:
```typescript
import { useShallow } from 'zustand/react/shallow';
const columns = useDashboardStore(useShallow((s) => s.columns));
```

### Per-Scenario State Preservation

`scenarioSlice.ts` manages multiple datasets:
```typescript
interface Scenario {
  id: string;
  name: string;
  entityCount: number;
  columns: string[];
  // Persisted selection snapshots per scenario
}
```

Switching scenarios triggers `setEntities()` with scenario-specific data while preserving UI state.

---

## Selection System

### THE SACRED RULE

> **All selections use EntityId (UUID), NEVER array indices!**

This enables:
- Stable references across async data loads
- Persistence without index drift
- Speckle viewer sync without ID conflicts
- Undo/redo that survives data mutations

### Selection Topology (5-Tier)

```
┌─────────────────────────────────────────────────────────┐
│                    selectionSlice                        │
├─────────────────────────────────────────────────────────┤
│ 1. currentSelection: Set<EntityId>                      │
│    └─ The active brush/click selection                  │
│                                                         │
│ 2. savedSelections: Map<string, Set<EntityId>>          │
│    └─ Named snapshots ("Cluster 0", "High Values", etc) │
│                                                         │
│ 3. referenceSelection: string                           │
│    └─ Key for comparison baseline ("all" | "current" | │
│       saved name)                                       │
│                                                         │
│ 4. secondarySelections: string[] (max 3)                │
│    └─ Keys for comparison slots                         │
│                                                         │
│ 5. selectionHistory: Set<EntityId>[]                    │
│    └─ Undo/redo stack (max 50 entries)                 │
│    └─ historyPointer: number                            │
└─────────────────────────────────────────────────────────┘
```

### Selection Hash for Cache Invalidation

`utils/stats.ts`:
```typescript
export function hashSelection(ids: Set<EntityId>): string {
  if (ids.size === 0) return 'empty';
  return Array.from(ids).sort().join(',').slice(0, 100);
}
```

**Performance optimization:** Hashes are computed ONCE when selection changes and cached:
- `selectionSlice.currentSelectionHash`
- `selectionSlice.savedSelectionHashes`
- `dataSlice.allIdsHash`

### Selection Source Tracking

`selectionSlice.ts:54`:
```typescript
setCurrentSelection: (ids: EntityId[], source: SelectionSource) => {
  // source: 'chart' | 'viewer' | 'filter' | 'cluster' | 'load' | 'box' | 'restore'
  set((state) => {
    state.currentSelection = new Set(ids);
    state.currentSelectionHash = hashSelection(state.currentSelection);
    state.lastSource = source;
  });
}
```

**Echo Prevention Pattern** in `useSpeckleData.ts:392-396`:
```typescript
const unsubscribe = useDashboardStore.subscribe(
  (state) => ({ source: state.lastSource }),
  ({ source }) => {
    // Only sync to viewer if change didn't come FROM viewer
    if (source !== 'viewer') {
      syncToViewer();
    }
  }
);
```

### History Management (Undo/Redo)

`selectionSlice.ts:258-309`:
- **Undo:** Restores previous selection from history stack
- **Redo:** Moves forward in history
- **New branch:** Making a new selection truncates redo history
- **Max entries:** 50 (caps with `shift()` on overflow)

---

## Compute Architecture

### "Charts Are Views, Not Computers"

The fundamental principle: **Components read pre-computed results from cache, never compute during render.**

```
┌──────────────────────────────────────────────────────────┐
│ Component calls: computeStats('current', 'height')       │
│                          ↓                               │
│ ┌────────────────────────────────────────────────────┐  │
│ │ computeSlice.computeStats():                       │  │
│ │   1. Build cache key: "{scenario}::{hash}::{col}"  │  │
│ │   2. Check cache + TTL (5 min)                     │  │
│ │   3. If hit → return cached                        │  │
│ │   4. If miss → compute → cache → return            │  │
│ └────────────────────────────────────────────────────┘  │
│                          ↓                               │
│ Component receives DescriptiveStats | null              │
└──────────────────────────────────────────────────────────┘
```

### Cache Key Convention

`computeSlice.ts:103-110`:
```typescript
function cacheKey(
  scenarioId: string | null,
  selectionHash: string,
  ...parts: (string | number)[]
): string {
  const scenario = scenarioId ?? '_';
  return `${scenario}::${selectionHash}::${parts.join('::')}`;
}
```

**Examples:**
| Operation | Key Format |
|-----------|------------|
| Stats | `{scenario}::{hash}::{column}` |
| Histogram | `{scenario}::{hash}::{column}::{binCount}` |
| KDE | `{scenario}::{hash}::{column}::kde::{numPoints}` |
| BoxPlot | `{scenario}::{hash}::{column}::boxplot` |
| RankValue | `{scenario}::{hash}::{column}::rankvalue` |
| Correlation | `{scenario}::{hash}::corr::{colA}::{colB}` |
| Matrix | `{scenario}::{hash}::matrix::{sortedCols}` |
| Regression | `{scenario}::{hash}::reg::{colX}::{colY}` |

### 12 Compute Actions Available

| Action | Returns | Purpose |
|--------|---------|---------|
| `computeStats` | `DescriptiveStats` | Mean, median, std, quartiles |
| `computeHistogram` | `HistogramData` | Binned frequency data |
| `computeKDE` | `KDEPoint[]` | Smooth density curve |
| `computeBoxPlot` | `BoxPlotStats` | Q0-Q4, IQR, outliers |
| `computeRankValue` | `RankValuePair[]` | Sorted values with ranks |
| `computeCorrelation` | `number` | Pearson correlation |
| `computeCorrelationMatrix` | `CorrelationResult` | Full NxN matrix |
| `computeRegression` | `LinearRegressionResult` | Slope, intercept, R² |
| `getSelectionValues` | `number[]` | Extract values for column |
| `invalidateSelection` | `void` | Clear cache for hash |
| `clearAllCaches` | `void` | Full cache wipe |
| `hashSelection` | `string` | Compute selection hash |

### TTL and Cache Pruning

`computeSlice.ts:86-91`:
```typescript
const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes
const MAX_CACHE_ENTRIES = 200;
```

Pruning happens on cache write (`pruneRecordCache`) - removes oldest entries when over limit.

---

## Visualization & Charting

### ECharts as Primary Engine

All charts use `echarts-for-react` with a centralized theme in `lib/chartConfig.ts`.

**Chart Types:**
- Parallel Coordinates (`ParallelCoordinates.tsx`)
- Scatter plots (2D/3D in `DRScatter2D.tsx`, `DRScatter3D.tsx`)
- Histograms (`MiniHistogram.tsx`)
- KDE curves (`MiniKDE.tsx`)
- Box plots (`MiniBoxPlot.tsx`)
- Rank-value plots (`MiniRankValue.tsx`)
- Correlation matrix heatmap (`CorrelationMatrix.tsx`)
- Spider/Radar charts (`SpiderChart.tsx`)
- Elbow/K-Distance charts for clustering params

### Chart → Store Contract

```typescript
// Charts ONLY:
// 1. Subscribe to store for data
// 2. Call compute actions
// 3. Render pre-computed results
// 4. Emit selection changes with source tracking

// Charts NEVER:
// - Perform statistical computation during render
// - Store computed results in local state
// - Modify store directly (only through actions)
```

### Brushing with Debounce (150-300ms)

`DRScatter2D.tsx`:
```typescript
const debouncedSetSelection = useMemo(
  () => debounce((ids) => {
    setCurrentSelection(ids, 'chart');
  }, 150),
  [setCurrentSelection]
);
```

### Color Modes

Managed in `uiSlice`:
```typescript
colorMode: 'selection' | 'attribute' | 'cluster'
colorAttribute: string | null
colorPalette: string  // 'viridis' | 'plasma' | etc.
```

`useColorMapping.ts` computes entity colors based on mode:
- **Selection:** Orange (selected) / Blue (reference)
- **Cluster:** Categorical palette by cluster label
- **Attribute:** Continuous/categorical palette by column value

---

## Clustering & ML

### Web Worker Architecture

Heavy computation offloaded to `workers/analytics.worker.ts` using **Comlink**:

```typescript
// Worker exposes API
const api = {
  runKMeans: async (matrix, config, onProgress) => { ... },
  runDBSCAN: async (matrix, minPts, eps) => { ... },
  runPCA: async (matrix, dims) => { ... },
  runUMAP: async (matrix, config, onIteration) => { ... },
  computeElbowCurve: async (matrix, kRange) => { ... },
  computeKDistanceCurve: async (matrix, k) => { ... },
};
Comlink.expose(api);

// Hook wraps worker
const apiRef = useRef<Comlink.Remote<AnalyticsWorkerAPI>>();
apiRef.current = Comlink.wrap<AnalyticsWorkerAPI>(workerRef.current);

// Called as regular async function
const result = await apiRef.current.runKMeans(matrix, config, Comlink.proxy(onProgress));
```

### K-Means Integration

`useClustering.ts`:
1. Extract numeric columns from selection
2. One-hot encode categoricals (`lib/oneHotEncoder.ts`)
3. Send to worker: `runKMeans(matrix, { k, maxIterations })`
4. Store results in `clusterSlice`

### DBSCAN Integration

Uses `density-clustering` library:
- Parameters: `minPts`, `epsilon`
- `KDistanceChart.tsx` helps determine optimal epsilon

### Cluster Color Assignment

`clusterSlice.ts` stores:
```typescript
entityClusterLabels: Map<EntityId, number>  // entity → cluster index
clusteredEntityIds: EntityId[]  // ordered list
clusterCentroids: number[][]
```

`colorEngine.ts` assigns colors from categorical palette based on cluster index.

### Radar Charts for Cluster Profiles

`SpiderChart.tsx` shows z-scores per column for each cluster centroid, enabling quick comparison of cluster characteristics.

---

## Dimensionality Reduction

### PCA vs UMAP Projection Caches

`drSlice.ts`:
```typescript
// Separate caches persist when switching algorithms
pcaProjectionMap: Map<EntityId, number[]>
pcaProjectedEntityIds: EntityId[]
pcaColumns: string[]

umapProjectionMap: Map<EntityId, number[]>
umapProjectedEntityIds: EntityId[]
umapColumns: string[]

// Active projection (points to current algorithm)
projectionMap: Map<EntityId, number[]>
```

### 2D/3D Scatter with Brush Selection

- **2D:** Lasso/rectangle brush in ECharts
- **3D:** Click selection (Shift for multi-select) via ECharts-GL

### Web Worker Execution

Both PCA and UMAP run in `analytics.worker.ts`:
- PCA: `ml-pca` library, synchronous
- UMAP: `umap-js` with async iterations

### Progressive UMAP Updates

`useDimensionReduction.ts` passes callback via Comlink:
```typescript
await apiRef.current.runUMAP(
  matrix,
  config,
  Comlink.proxy((epoch, embedding) => {
    // Update projectionMap on every N epochs
    setDRProgress(epoch / config.nEpochs);
    updateProjection(embedding);
  })
);
```

---

## Workflow Editor

### React Flow v12 Integration

`WorkflowEditor.tsx` uses `@xyflow/react`:
```typescript
const nodeTypes = {
  source: SourceNode,
  filter: FilterNode,
  union: SetOpNode,
  intersection: SetOpNode,
  difference: SetOpNode,
  invert: SetOpNode,
  expression: ExpressionNode,
  output: OutputNode,
} as const;  // MUST be outside component!
```

### Node Types

| Type | Category | Inputs | Output | Description |
|------|----------|--------|--------|-------------|
| `source` | source | - | 1 | All entities or saved selection |
| `filter` | transform | 1 | 1 | Filter by column/operator/value |
| `union` | setop | 2 | 1 | A ∪ B |
| `intersection` | setop | 2 | 1 | A ∩ B |
| `difference` | setop | 2 | 1 | A − B |
| `invert` | setop | 1 | 1 | ¬A (complement) |
| `expression` | expression | 1 | 1 | Custom math expressions |
| `output` | output | 1 | - | Apply result to current selection |

### Topological Sort (Kahn's Algorithm)

`useWorkflowExecution.ts:163-214`:
```typescript
function topologicalSort(nodes, edges) {
  // Build in-degree map and adjacency list
  const inDegree = new Map();
  const adjacency = new Map();

  // Initialize queue with zero in-degree nodes
  const queue = nodes.filter(n => inDegree.get(n.id) === 0);

  // Process queue
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const neighbor of adjacency.get(node.id)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  // Detect cycles
  if (result.length < nodes.length) throw new Error('Cycle detected');
  return result;
}
```

### Execution Pipeline

1. User clicks Execute
2. Clear previous results
3. Topological sort nodes
4. Execute sequentially (source → transforms → outputs)
5. Pass `Set<EntityId>` between nodes (not data arrays!)
6. Store results in `workflowSlice.nodeResults`

---

## Expression Engine

### expr-eval Library

`lib/expressionEngine.ts` wraps `expr-eval` for safe formula parsing:

```typescript
const evaluator = createExpressionEvaluator(entities, columnInfo);
const result = evaluator.evaluateAll('(height - mean("height")) / std("height")');
```

### Built-in Aggregate Functions

| Function | Description |
|----------|-------------|
| `mean("column")` | Mean of column |
| `std("column")` | Standard deviation |
| `median("column")` | Median |
| `min_col("column")` | Minimum value |
| `max_col("column")` | Maximum value |
| `quantile("column", p)` | Pth percentile (0-1) |
| `topN("column", n)` | Top N by value |
| `bottomN("column", n)` | Bottom N by value |
| `safe_div(a, b)` | Division with 0 check |

### Custom Computed Indicators

`dataSlice` supports adding computed columns:
```typescript
addComputedIndicator(name: string, formula: string): boolean
updateComputedIndicator(name: string, formula: string): boolean
removeComputedIndicator(name: string): void
recomputeIndicators(): void
```

Values injected into `entity.properties[name]` for all entities.

---

## Speckle Viewer Integration

### World Tree Walk for Entity Extraction

`useSpeckleLoader.ts` traverses Speckle's data hierarchy:
```typescript
function walkWorldTree(node, callback, depth = 0) {
  if (node.model?.id) callback(node);
  for (const child of node.children || []) {
    walkWorldTree(child, callback, depth + 1);
  }
}
```

### Selection Sync with Debounce

`useSpeckleData.ts` sets up bidirectional sync:
```typescript
// Dashboard → Viewer (debounced)
const syncToViewer = debounce(() => {
  filteringExt.resetFilters();  // Critical: clear first
  filteringExt.isolateObjects(selectedIds, ...);
  filteringExt.setUserObjectColors(colorAssignments);
}, syncDebounceMs);
```

### Source Tracking Prevents Echo Loops

Flow:
1. User brushes chart → `setCurrentSelection(ids, 'chart')`
2. Store updates `lastSource = 'chart'`
3. Subscription fires, `source !== 'viewer'` → `syncToViewer()`
4. Viewer updates visually

If viewer selection:
1. User clicks in viewer → `handleViewerSelection(ids, 'viewer')`
2. Store updates `lastSource = 'viewer'`
3. Subscription fires, `source === 'viewer'` → **SKIP** `syncToViewer()`

### Color Mapping by Mode

`useSpeckleData.ts:244-324` computes colors inline:
- Selection mode: orange/blue
- Cluster mode: categorical palette from `entityClusterLabels`
- Attribute mode: continuous/categorical based on column type

---

## What Worked Well

### Patterns to Extract and Reuse

1. **Selection Source Tracking**
   - Problem: Viewer and charts both update selection
   - Solution: Track source, skip sync if change came from same source
   - Files: `selectionSlice.ts:54`, `useSpeckleData.ts:392`

2. **Hash-Based Compute Cache**
   - Problem: Expensive stats recomputed on every render
   - Solution: Cache with composite key, return cached if valid
   - Files: `computeSlice.ts:103`, `utils/stats.ts:hashSelection`

3. **Worker Proxy via Comlink**
   - Problem: ML blocks main thread
   - Solution: Worker + Comlink = async functions that feel synchronous
   - Files: `workers/analytics.worker.ts`, `useClustering.ts`

4. **UUID-Based State**
   - Problem: Array indices drift with async loads
   - Solution: Always use UUIDs at state boundaries, convert at chart level
   - Files: Throughout `selectionSlice.ts`, `dataSlice.ts`

5. **Centralized Compute**
   - Problem: Stats logic duplicated across components
   - Solution: All computation in store actions, components just call
   - Files: `computeSlice.ts`

### Why They Worked

- **Predictable:** Source tracking eliminates echo loop debugging
- **Performant:** Cache hits return immediately, no re-render
- **Testable:** Compute actions are pure functions with clear I/O
- **Maintainable:** One place for each concern

---

## Pain Points & Lessons

### What Caused Bugs

1. **Multiple Debounce Layers**
   - Chart debounce + viewer debounce = potential stale state
   - Fast interactions can race

2. **Map Selector Issues**
   - Forgetting `useShallow` on Map/Set selectors → infinite loops
   - React Flow requires `Record` not `Map` for node data

3. **Immer + Maps Memory**
   - Immer proxies Maps/Sets, adding overhead
   - Large datasets (100k+) can cause memory pressure

### What's Over-Engineered

1. **5-Tier Selection** - Most apps need only current + saved
2. **Full Expression Engine** - Many users never use custom expressions
3. **OSM Aggregator** - Complex Turf.js pipeline for niche use case

### What's Missing

1. **Error Boundaries** - A bad KPI formula can crash entire app
2. **Undo/Redo for Workflow** - Only selection has history
3. **Lazy Loading** - Large CSVs load all at once
4. **Virtual Scrolling** - Long entity lists can lag

---

## Module Boundaries

### Clean Cut Points (Swappable)

| Module | Interface | Could Swap To |
|--------|-----------|---------------|
| `expressionEngine.ts` | `evaluateAll(formula)` | math.js, custom parser |
| `osmAggregator.ts` | `aggregatePOIs(buildings, pois)` | Server-side aggregation |
| `analytics.worker.ts` | `runKMeans`, `runUMAP` | Python backend via WebSocket |
| `colorEngine.ts` | `computeColorMapping(entities, mode)` | D3 scales, custom palettes |

### Dependency Matrix

```
dataSlice ← selectionSlice ← computeSlice ← clusterSlice
    ↑           ↑                              ↓
    │           │                          drSlice
    │           └─── workflowSlice ←──────────┘
    │                    ↑
    └──────────────── uiSlice
```

### What Can Be Extracted

1. **`lib/expressionEngine.ts`** - Standalone math expression evaluator
2. **`lib/oneHotEncoder.ts`** - Generic categorical encoding
3. **`workers/analytics.worker.ts`** - ML worker with Comlink API
4. **`utils/stats.ts`** - Pure statistical functions
5. **Selection topology pattern** - Reusable selection state machine

---

## File Reference

### Store Layer
```
src/store/
├── index.ts                 # Store composition
├── selectors.ts             # Memoized selectors
└── slices/
    ├── dataSlice.ts         # Entities, columns, indices
    ├── selectionSlice.ts    # Selection topology
    ├── computeSlice.ts      # Stats cache
    ├── uiSlice.ts           # Layout, color mode
    ├── scenarioSlice.ts     # Multi-scenario
    ├── clusterSlice.ts      # Clustering results
    ├── drSlice.ts           # DR projections
    ├── workflowSlice.ts     # Workflow editor
    ├── analyticsSlice.ts    # Anomaly detection
    ├── csvSlice.ts          # CSV loading
    └── osmSlice.ts          # OSM loading
```

### Hooks
```
src/hooks/
├── useSelection.ts          # Selection hooks
├── useCompute.ts            # Stats computation
├── useClustering.ts         # K-Means/DBSCAN
├── useDimensionReduction.ts # PCA/UMAP
├── useSpeckleLoader.ts      # Speckle data loading
├── useSpeckleData.ts        # Store integration
├── useWorkflowExecution.ts  # Topological sort + execute
├── useColorMapping.ts       # Entity color computation
├── useSetOperations.ts      # Selection set ops
├── useCSVPipeline.ts        # CSV loading
├── useOSMPipeline.ts        # OSM loading
└── useMapSync.ts            # MapLibre sync
```

### Libraries
```
src/lib/
├── expressionEngine.ts      # Formula evaluation
├── workflowExpressions.ts   # Workflow filter presets
├── colorEngine.ts           # Color palettes
├── chartConfig.ts           # ECharts theme
├── nodeRegistry.tsx         # Workflow node definitions
├── oneHotEncoder.ts         # Categorical encoding
├── osmAggregator.ts         # POI aggregation
├── overpassApi.ts           # OSM API client
├── csvParser.ts             # CSV parsing
└── mockDataGenerator.ts     # Dev mock data
```

### Workers
```
src/workers/
├── analytics.worker.ts      # ML operations (K-Means, PCA, UMAP)
└── types.ts                 # Worker message types
```

---

## Comparison to Other Urban Analytics Apps

| Aspect | prec-geo-showcase | AIT Dashboard | ISOCARP | LAND Dashboard | bokehDashboard |
|--------|-------------------|---------------|---------|----------------|----------------|
| Selection | Basic | Token-based | Basic | 4D indices | **5-tier topology** |
| Compute | In-component | Microtask | In-component | Processor pattern | **Centralized cache** |
| ML | None | None | Asset validation | None | **PCA/UMAP/Clustering** |
| Workflow | None | None | None | None | **Node-based visual** |
| Data Sources | Single GeoJSON | Single source | Grid+Assets | 4D timeseries | **Multi-source** |
| Brushing | Basic | Basic | Basic | Basic | **Source-tracked** |
| Worker | None | None | None | None | **Comlink ML worker** |

---

## Summary

bokehDashboard_v2 represents the most sophisticated analytics dashboard in the series, with patterns that could be extracted and reused:

1. **Selection Source Tracking** - Essential for any multi-view app with viewer sync
2. **Record-Based Compute Cache** - DevTools-visible, JSON-exportable stats caching
3. **UUID-Only State Boundaries** - Prevents index drift bugs
4. **Worker Proxy Pattern** - Clean async ML without main thread blocking
5. **Workflow Editor** - Visual DAG execution for data pipelines

The main risk areas are memory pressure on large datasets and the complexity of the 5-tier selection system. For simpler apps, a 2-tier (current + saved) selection would suffice.

*Analysis completed: 2025-01-16*
*Source: /Users/Joo/01_Projects/bokehDashboard_v2/*

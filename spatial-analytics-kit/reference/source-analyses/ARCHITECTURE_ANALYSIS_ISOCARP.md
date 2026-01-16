# Architecture Analysis: Riyadh ISOCARP Workshop WebApp

**Project:** Climate Corridor Planning WebApp
**Path:** `/Users/Joo/01_Projects/Riyadh_isocarp_workshop/combine-planning-webapp/`
**Context:** Workshop prototype for 30-40 participants designing climate-responsive urban corridors
**Stack:** React 19 + TypeScript + Vite + Deck.gl + Mapbox + Zustand

---

## Executive Summary

A "quick and dirty" workshop prototype that nonetheless demonstrates several sophisticated architectural patterns:

**Strongest Patterns (Highly Reusable):**
1. **Asset System** - Hybrid registry merging built-in + custom assets with metadata-driven behavior
2. **Spatial Index** - O(1) grid-based spatial hashing for real-time validation
3. **Shade Accumulation** - Incremental accumulation with Leaf Area Density (LAD)
4. **Dual-Timeline Architecture** - Year 1 vs Year 10 simulation with species-specific maturity curves

**Lessons Learned:**
- Web Workers reverted due to serialization overhead exceeding computation time for 65K grid points
- 12-slice Zustand store refactored from monolithic uiSlice (cleaner separation of concerns)
- Config-driven KPIs with Zod validation for AI-generated tabs

### Top 5 Patterns (Steal These)

| Pattern | Why It's Great | Files |
|---------|---------------|-------|
| **1. Spatial Index** | O(1) grid hashing → 10-12x faster proximity queries. Essential for 60fps drag validation | `spatialIndex.ts` |
| **2. Asset Metadata Structure** | Single `AssetDefinition` carries visual, spatial, AND ecological data. One source of truth | `types/assets.ts` |
| **3. LAD Shade Accumulation** | Additive model with early-exit. Two sparse trees = combined shade. Rewards good design | `shadeCalculator.ts` |
| **4. GLTF Auto-Grounding** | Calculate bbox on load, store yOffset, apply at render. Handles any pivot point | `gltfLoader.ts` |
| **5. KPI ID Convention** | `{metric}::{timeHorizon}` naming enables dual-timeline without code duplication | `kpiCalculators.ts` |

### Worst 5 Patterns (Avoid These)

| Anti-Pattern | What Went Wrong | Lesson |
|--------------|-----------------|--------|
| **1. Web Workers for Small Grids** | Serialization overhead (65K points) > computation time | Profile before optimizing |
| **2. Monolithic uiSlice** | Single slice became unmaintainable catchall | Start with split slices from day 1 |
| **3. Hardcoded Structure Dimensions** | Pergola 6×8m hardcoded in shade calc | Now metadata-driven with fallback chain |
| **4. Orphaned Workers** | `shade.worker.ts`, `kpi.worker.ts` unused but still exist | Delete reverted code, don't keep it |
| **5. DebugPanel.tsx = 89KB** | Single component grew to ~2500 lines | Split into focused debug components |

---

## 1. Data Pipeline

### Flow: Design → Simulation → Visualization

```
User Action                    Store                   Simulation            Visualization
    │                           │                         │                       │
    ▼                           ▼                         │                       │
 Place Tree ──→ designSlice.objects ──→ ─────────────────│───────────────────────│
    │                           │                         │                       │
    ├── Real-time shade ───────│────→ realtimeShadeUpdater ──→ analysisSlice.grid
    │                           │                         │                       │
    └── Full simulation ───────│────→ simulationPipeline  ─┬─→ year1.grid
                                │        │                  └─→ year10.grid
                                │        │                       │
                                │        ├── shadowTask          │
                                │        ├── windTask (Infrared) │
                                │        ├── utciTask            │
                                │        └── gusTask (disabled)  │
                                │                                ▼
                                └───────────────────────→ MapView → deck.gl layers
```

**Key Files:**
- `src/services/simulationPipeline.ts:119` - Main orchestrator
- `src/services/realtimeShadeUpdater.ts` - Incremental updates
- `src/store/slices/analysisSlice.ts` - Grid storage

### Caching/Memoization

| Layer | Strategy | Location |
|-------|----------|----------|
| Asset GLTF models | Store in `loadedAssets` after first load | `assetCatalog.ts:16` |
| Custom assets | IndexedDB persistence + cache `LoadedAsset` | `assetStorage.ts` |
| Shade objects | Prepared once per simulation run | `shadeCalculator.ts:135` |
| KPI values | Zustand store, recalculated on design change | `kpiStore.ts` |

---

## 2. KPI/Metrics System

### Architecture: Config-Driven Registry

**Registry Pattern:**
- KPIs defined in JSON: `src/config/kpis/kpis.json` (27KB, 20+ KPIs)
- Dashboard tabs: `dashboard.overview.json`, `dashboard.microclimate.json`, etc.
- Calculators: Pure functions in `src/services/kpiCalculators.ts`

**KPI ID Convention:** `{metric}::{timeHorizon}`
```typescript
// Examples:
'tree_count::current'      // Static, timeline-independent
'carbon_sequestration::year10'  // Year 10 with maturity factors
'utci_reduction::year10'   // Comparative (year10 - year1 baseline)
'roi_50year::aggregate'    // Derived from other KPIs
```

### Dual-Timeline Calculation

```typescript
// src/services/kpiCalculators.ts:611-686
export function calculateAllKPIs(context, currentValues) {
  // PHASE 1: Static KPIs (run once)
  newValues['tree_count::current'] = calculateTreeCount(context);

  // PHASE 2: Year 1 context
  const year1Context = { ...context, timeHorizon: 'year1' };
  newValues['mean_temp::year1'] = calculateMeanTemp(year1Context);

  // PHASE 3: Year 10 context (species-specific maturity)
  const year10Context = { ...context, timeHorizon: 'year10' };
  newValues['carbon_sequestration::year10'] = calculateCarbonSequestration(year10Context);

  // PHASE 4: Comparative (requires both timelines)
  newValues['utci_reduction::year10'] = calculateUTCIReduction(context);

  // PHASE 5: Aggregate (derived from other KPIs)
  newValues['roi_50year::aggregate'] = calculateROI50Year(newValues, context);
}
```

### Area Filtering

KPIs support spatial filtering via `context.areaFilter`:
```typescript
// Each calculator respects area filter
if (context.areaFilter && context.areaFilter !== 'all') {
  const area = getAreaConfig(context.areaFilter);
  trees = trees.filter(tree => isPointInArea(tree.position, area));
}
```

### GUS API Integration

KPIs can pull from external tree growth API when available:
```typescript
// Falls back to local calculation if GUS unavailable
if (context.gusStats?.totalCarbonSequestration > 0) {
  return context.gusStats.totalCarbonSequestration * proportion;
}
// Fallback: Calculate from metadata with maturity scaling
```

---

## 3. State Management (12-Slice Zustand)

### Store Composition

```typescript
// src/store/index.ts
export const useStore = create<StoreState>()((...a) => ({
  ...createDesignSlice(...a),      // Objects + selection
  ...createAnalysisSlice(...a),    // Grids + simulation results
  ...createToolSlice(...a),        // Active tool, timeline view
  ...createDrawingSlice(...a),     // Polygon drawing state
  ...createVisualSlice(...a),      // Lighting, layers, debug
  ...createInteractionSlice(...a), // Object manipulation, lens
  ...createSimulationSlice(...a),  // Progress tracking
  ...createCustomTabSlice(...a),   // AI-generated tabs
  ...createInfraredSlice(...a),    // Infrared API state
  ...createGusSlice(...a),         // GUS tree growth state
  ...createOnboardingSlice(...a),  // Narrative intro
  ...createSpatialChatSlice(...a), // Spatial Q&A
}));
```

### Slice Responsibilities

| Slice | State Prefix | Purpose |
|-------|--------------|---------|
| `designSlice` | `design.*` | Objects array, selectedIds |
| `analysisSlice` | `analysis.*` | Year1/Year10 grids, timeline data |
| `toolSlice` | `tool.*` | activeTool, timelineView, openPanel, activeAnalysisLayer |
| `visualSlice` | `visual.*` | layerVisibility, lighting, debug settings |
| `interactionSlice` | `interaction.*` | movingObjectId, rotatingObjectId, lens tool |

### Separate KPI Store

**Why separate?** Avoids circular dependencies between design changes and derived calculations:
```typescript
// src/store/kpiStore.ts - Independent Zustand store
export const useKPIStore = create<KPIStoreState>((set, get) => ({
  currentValues: { ...DEFAULT_KPI_VALUES },
  snapshotValues: null,  // For before/after comparison

  calculateRealtimeKPIs: (design, assetMetadata, analysis, areaFilter) => {
    const newValues = calculateAllKPIs(context, get().currentValues);
    set({ currentValues: newValues });
  },
}));
```

### Refactoring History

Originally a monolithic `uiSlice` was split in "Phase 4 Refactoring" into 6 focused slices:
- `simulationSlice` - Progress tracking
- `toolSlice` - Tool/panel state
- `drawingSlice` - Polygon drawing
- `interactionSlice` - Object manipulation
- `visualSlice` - Visual settings
- `customTabSlice` - AI tabs

---

## 4. Scenario/Variant Handling (Dual Timeline)

### Timeline Configuration

```typescript
// src/config/timeline.ts - Single source of truth
export const TIMELINE_CONFIGS: TimelineConfig[] = [
  { id: 'early', label: 'Year 1', years: 1, viewId: 'year-1', kpiSuffix: 'year1' },
  { id: 'mature', label: 'Year 10', years: 10, viewId: 'year-10', kpiSuffix: 'year10' }
];
```

### Tree Maturity Curves

```typescript
// src/services/treeMaturity.ts
export function calculateTreeMaturity(years, metadata): number {
  const growthCurve = metadata?.ecological?.growthCurve ?? 'sigmoidal';

  switch (growthCurve) {
    case 'sigmoidal':  // S-curve: slow start, fast middle, slow finish
      return 1 / (1 + Math.exp(-k * (progress - x0)));
    case 'fast-early': // sqrt curve for Acacia
      return Math.sqrt(progress);
    case 'linear':     // Simple linear
      return progress;
  }
}
```

### Simulation Pipeline Phases

```typescript
// src/services/simulationPipeline.ts:119-174
export async function runSimulationPipeline(design, assetMetadata, loadedAssets) {
  // PHASE 1: Year 1 tasks in parallel
  const year1Tasks = SIMULATION_TASKS.filter(t => t.phase === 'year1' || t.phase === 'both');
  const year1Results = await runTasksInParallel(year1Tasks, { timeHorizon: 'year1' });

  // Extract tree growth data for Year 10 (future: GUS integration)
  const treeGrowthData = undefined;

  // PHASE 2: Year 10 tasks in parallel
  const year10Tasks = SIMULATION_TASKS.filter(t => t.phase === 'year10' || t.phase === 'both');
  const year10Results = await runTasksInParallel(year10Tasks, { timeHorizon: 'year10', treeGrowthData });

  // PHASE 3: Merge into unified AnalysisResults
  return mergeAllResults(year1Results, year10Results);
}
```

---

## 5. Asset System (Strongest Pattern)

### Hybrid Registry Architecture

```
Built-in Assets (Static)          Custom Assets (Dynamic)
       │                                  │
       │   BUILTIN_ASSETS[]              │  IndexedDB
       │   (src/store/assetCatalog.ts)   │  (src/services/assetStorage.ts)
       │                                  │
       └─────────────┬───────────────────┘
                     │
                     ▼
              initializeCatalog()
                     │
                     ▼
         catalog.byCategory[category]
                     │
                     ▼
              AssetDefinition[]
```

### AssetMetadata Structure

```typescript
// src/types/assets.ts
export interface AssetMetadata {
  name: string;
  category: AssetCategory;  // 'tree' | 'structure' | 'surface'
  cost: number;             // SAR

  dimensions?: {            // From GLTF analysis
    width, height, depth: number;
    source: 'filename' | 'gltf-analysis' | 'manual';
  };

  spatial?: {               // Placement validation
    minSpacing: number;     // Min distance to other trees
    canopyDiameter: number; // Mature canopy (Year 10)
    canopyDiameterYear1: number;
    rootDepth: number;      // Foundation risk calculation
  };

  ecological?: {            // Simulation parameters
    coolingRadius: number;
    waterRequirementMature: number;
    carbonSequestration: number;
    leafAreaDensity: number;  // 0-2.0, drives shade opacity
    yearsToMaturity: number;
    growthCurve: 'sigmoidal' | 'linear' | 'fast-early';
  };

  shading?: {               // For structures
    shadeWidth, shadeDepth: number;
    useGltfBbox: boolean;
    leafAreaDensity: number;
  };
}
```

### GLTF Auto-Grounding

```typescript
// src/utils/gltfLoader.ts
export async function loadAndAnalyzeGLTF(url): Promise<LoadedAsset> {
  // Traverse scene graph to find vertex bounds
  const bounds = calculateBoundingBox(gltf.scene);

  // Calculate offset to ground model
  const yOffset = -bounds.min[1];  // Bring bottom to origin

  return {
    scenegraph: gltf,
    yOffset,           // Applied at render time
    boundingBox: bounds,
  };
}

// MapView applies grounding
new ScenegraphLayer({
  getTranslation: (d) => [0, 0, yOffset * finalScale * sizeScale],
});
```

---

## 6. Spatial Index System (Strongest Pattern)

### Grid-Based Spatial Hashing

```typescript
// src/utils/spatialIndex.ts
export class SpatialIndex<T extends { id: string; position: [number, number] }> {
  private cells = new Map<string, T[]>();  // "x,y" → items
  private cellSize = 25;  // meters

  private getKeys(pos: [number, number], radius = 0): string[] {
    // Convert lon/lat to meters, then to grid cell
    const x = Math.floor((pos[0] * METERS_PER_DEG_LON) / this.cellSize);
    const y = Math.floor((pos[1] * METERS_PER_DEG_LAT) / this.cellSize);

    // If radius > 0, return all overlapping cells
    // Otherwise return single cell
  }

  query(position, radiusMeters): T[] {
    const keys = this.getKeys(position, radiusMeters);
    const results: T[] = [];

    for (const key of keys) {
      const items = this.cells.get(key);
      if (items) results.push(...items);
    }
    return results;  // Superset - caller does exact distance check
  }
}
```

**Performance:** O(K) where K is number of cells in query radius, vs O(N) for all objects.

### Dual Coordinate Systems

```typescript
// src/utils/coordinateTransform.ts
// Geographic (WGS84) ↔ Analysis Grid (Local Cartesian 0-512m)

export function lonLatToInfrared(lon, lat): [number, number] {
  const xRange = bounds.maxLon - bounds.minLon;
  const yRange = bounds.maxLat - bounds.minLat;

  const x = ((lon - bounds.minLon) / xRange) * INFRARED_GRID_SIZE;
  const y = ((lat - bounds.minLat) / yRange) * INFRARED_GRID_SIZE;

  return [x, y];  // 0-512 meters
}
```

---

## 7. Shade Accumulation System

### Additive LAD Model

```typescript
// src/services/shadeCalculator.ts:222-257
export function calculateCellShade(cellX, cellY, shadeObjects): number {
  let totalShade = 0;

  for (const obj of shadeObjects) {
    if (obj.type === 'circle' && isPointInCircle(cellX, cellY, obj.circle)) {
      // LAD 2.0 → 100% shade, LAD 1.0 → 50% shade
      const shadeValue = Math.min(100, 50 * obj.lad);
      totalShade = Math.min(100, totalShade + shadeValue);
    }

    // Early exit at 100%
    if (totalShade === 100) break;
  }

  return totalShade;
}
```

**Key Insight:** Two sparse trees (LAD 0.5 each) create 50% shade together, rewarding layered planting.

### Real-time Updates

```typescript
// src/services/realtimeShadeUpdater.ts
// Uses setTimeout(0) + requestAnimationFrame to decouple from render cycle
```

**Reverted Pattern:** Web Workers were attempted but reverted because:
- 65,536 grid points serialization overhead exceeded computation time
- Main thread with `requestAnimationFrame` throttling works better for this scale

---

## 8. What Worked Well (Reuse These)

### 1. Metadata-Driven Asset System
- Single `AssetDefinition` carries visual, spatial, and ecological data
- Validation, simulation, and visualization all derive from same source
- IndexedDB for custom asset persistence

### 2. Spatial Index for Real-time Validation
- 10-12x faster than linear scan for proximity queries
- Essential for 60fps during drag operations

### 3. Config-Driven KPIs
- JSON registry with calculator lookup
- Easy to add/modify metrics
- Dual-timeline support built into ID convention

### 4. Hook-based MapView Architecture
- Monolithic 2146-line component → 11 specialized hooks
- 82% fewer re-renders after refactoring
- Each hook isolated memoization

### 5. Zod Schema Validation for AI Tabs
- `src/schemas/tabConfigSchema.ts` validates AI-generated configs
- Prevents malformed dashboard tabs from crashing app

---

## 9. Pain Points & Lessons

### 1. Web Workers Overhead
**Problem:** Workers for KPI/shade calculation actually slower due to serialization.
**Lesson:** Profile before optimizing. For 65K points, main thread with throttling wins.

### 2. Monolithic Store Slice
**Problem:** Original `uiSlice` became unmaintainable catchall.
**Solution:** Split into 6 focused slices during Phase 4 refactor.

### 3. Coordinate System Confusion
**Problem:** Multiple coordinate systems (WGS84, Infrared, screen).
**Solution:** Centralize transforms in `coordinateTransform.ts`, use consistent conventions.

### 4. GLTF Grounding Issues
**Problem:** Different models have different pivot points (center vs bottom).
**Solution:** Auto-calculate bounding box and apply yOffset at render time.

### 5. Grid Indexing Convention
**Problem:** Confusion between row/col and x/y in grid data.
**Solution:** Document convention clearly: `grid[row][col]` where row=Y, col=X.

---

## 10. Reusable Patterns Summary

| Pattern | Files | Reuse Score |
|---------|-------|-------------|
| Asset Catalog + IndexedDB | `assetCatalog.ts`, `assetStorage.ts` | ⭐⭐⭐⭐⭐ |
| Spatial Index | `spatialIndex.ts` | ⭐⭐⭐⭐⭐ |
| Shade Accumulation (LAD) | `shadeCalculator.ts` | ⭐⭐⭐⭐ |
| Dual-Timeline KPIs | `kpiCalculators.ts`, `timeline.ts` | ⭐⭐⭐⭐ |
| GLTF Auto-Grounding | `gltfLoader.ts` | ⭐⭐⭐⭐ |
| 12-Slice Store Composition | `store/index.ts`, `slices/*.ts` | ⭐⭐⭐ |
| Simulation Pipeline Tasks | `simulationPipeline.ts`, `tasks/*.ts` | ⭐⭐⭐ |
| AI Tab Schema Validation | `tabConfigSchema.ts` (Zod) | ⭐⭐⭐ |

---

## 11. File Reference

### Core Architecture
- `src/store/index.ts` - Root store composition (109 lines)
- `src/store/kpiStore.ts` - Separate KPI store (173 lines)
- `src/store/assetCatalog.ts` - Asset management (516 lines)

### Services
- `src/services/simulationPipeline.ts` - Pipeline orchestrator (404 lines)
- `src/services/kpiCalculators.ts` - KPI calculation logic (687 lines)
- `src/services/shadeCalculator.ts` - Shade accumulation (274 lines)
- `src/services/treeMaturity.ts` - Growth curves (172 lines)

### Utilities
- `src/utils/spatialIndex.ts` - O(1) spatial queries (126 lines)
- `src/utils/coordinateTransform.ts` - Coordinate transforms (200 lines)
- `src/utils/gltfLoader.ts` - GLTF loading + grounding (200 lines)

### Config
- `src/config/timeline.ts` - Timeline definitions (76 lines)
- `src/config/kpis/kpis.json` - KPI registry (27KB)
- `src/config/analysisLayers.ts` - Layer definitions (18KB)

### Types
- `src/types/assets.ts` - Asset metadata types (125 lines)
- `src/types/kpi.ts` - KPI types (185 lines)
- `src/types/infrared.ts` - Simulation types (300 lines)

---

## Handover: Next Project to Analyze

Use the same methodology to analyze:
- `/Users/Joo/01_Projects/Riyadh_isocarp_workshop/combine-planning-webapp/` ✅ Complete
- Next candidates in similar domain for pattern consolidation

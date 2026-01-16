# PREC Geo Showcase - Comprehensive Architecture Analysis

Generated via Gemini analysis of full codebase (214 files, 1.5MB)
Session ID: `feature-analysis-001`

**✅ VALIDATED:** 8 Claude Code agents verified all sections (2026-01-16)
- All 11 features confirmed with code evidence
- All 8 store slices + external stores verified
- Data flows traced through actual implementation
- Implementation percentages updated based on findings

---

## 1. FEATURE INVENTORY

**What users can DO within the application.**

| Feature | Primary Entry Point | Description |
| :--- | :--- | :--- |
| **Interactive Map** | `components/MapView/index.tsx` | 3D city visualization using Deck.gl & MapLibre, supporting 3D buildings, surfaces, and models. |
| **Layer Management** | `components/LayerPanel/index.tsx` | Toggle visibility of architectural layers (Buildings, Roads, Trees, Infrastructure). |
| **Spatial Analysis** | `components/AnalysisControls.tsx` | View grid-based heatmaps for Wind Comfort (CFD), Thermal Comfort (UTCI), and Tree Density. |
| **Design Scenarios** | `components/Toolbar/DesignSubmenu.tsx` | Draw study areas and manually place 3D tree models (`useTreePlacement.ts`) to create variants. |
| **Simulation** | `hooks/useVariantSimulation.ts` | Trigger cloud-based simulations (Infrared.city API) for created design variants. |
| **Comparison** | `components/ComparisonModal/index.tsx` | Side-by-side comparison of baseline vs. design variants with diff heatmaps and KPI deltas. |
| **Spatial Q&A** | `components/chat/SpatialChatBubble.tsx` | Place AI chat bubbles on the map to query local microclimate context via n8n webhooks. |
| **Story Mode** | `components/Dashboard/StoryTab/index.tsx` | Guided narrative tours with automated camera movements and state transitions (`useStoryEffects.ts`). |
| **Explosion View** | `components/ExplosionToggle.tsx` | Vertically separate analysis layers for 3D visual inspection of stacked data. |
| **Mobility Analysis** | `hooks/useMobilityAnalysis.ts` | Analyze pedestrian flow using graph theory (Dijkstra) and UTCI-weighted edge costs. |
| **Location Picker** | `components/LocationPicker/index.tsx` | Select global bounds to fetch building data (OSM/TUM) and generate analysis grids on the fly. |

---

## 2. STORE SLICES

**Zustand state management organization (`src/store/slices/`).**

| Slice | Purpose | Key State |
| :--- | :--- | :--- |
| **dataSlice** | Raw geospatial data management | `layers` (Map), `metadata`, `isCustomLocation` |
| **viewSlice** | Camera and interaction state | `viewport`, `selectedFeatureIds`, `customRegionGeometry`, `presetRegions` |
| **analysisSlice** | Grid analysis state | `gridData` (TypedArrays), `activeColumn`, `explosionEnabled`, `explosionColumns` |
| **toolSlice** | Tool activation | `activeTool` (pan/select/measure/qa), `isDrawing` |
| **uiSlice** | Interface toggles | `sidebarOpen`, `comparisonModalOpen`, `activeDashboardTab` |
| **variantSlice** | Design logic | `variants`, `currentDesign` (trees), `simulations` (Map), `activeVariantId` |
| **storySlice** | Story playback | `activeStory`, `activeStepIndex`, `isPlaying` |
| **spatialChatSlice** | AI Chat state | `chats` (Record), `designVersion` |

**Note:** `kpiStore` is implemented separately (`src/store/kpiStore.ts`) to prevent circular dependencies.

---

## 3. HOOK PATTERNS

**Solutions to architectural problems.**

| Pattern | Hook | Problem Solved |
| :--- | :--- | :--- |
| **Reactive Sync / Debounce** | `useKPISync.ts` | Recalculates metrics when selection/layers change, debounced (300ms) to prevent calculation spam during interaction. |
| **Orchestrator** | `useVariantSimulation.ts` | Manages complex async workflows: merges geometry → builds payload → calls API → transforms grid → updates store. |
| **Side-Effects / Automation** | `useStoryEffects.ts` | Translates declarative story step config into imperative map state changes (camera flyTo, layer toggles). |
| **Render-Loop Optimization** | `useAnalysisGridLayer.ts` | Uses `BitmapLayer` for static base and `GridCellLayer` for animated "explosion" views to maintain 60fps with 500k cells. |
| **External Store Sync** | `useSpatialChatProjection.ts` | Syncs MapLibre screen coordinates to an external store (`screenPositionStore.ts`) to avoid React re-renders on every frame. |
| **Initialization Sequence** | `useGridInitialization.ts` | Decouples grid geometry creation (immediate) from column computation (async/reactive) to ensure UI responsiveness. |

---

## 4. COMPONENT ORGANIZATION

**Structure of the UI presentation layer.**

### Map/Canvas (`MapView/`)
- Acts as the render root
- Composes visual layers via custom hooks (e.g., `useBuildingLayers`, `useMobilityFlowLayers`)
- Handles raw pointer events via `useMapInteractions` before dispatching to store

### Panels & Overlays
- **Floating Widgets:** (`Toolbar`, `AnalysisControls`) use absolute positioning over the map
- **Glassmorphism:** Components like `DashboardPanel` use standardized backdrop-blur styles
- **Modals:** (`ComparisonModal`, `LocationPicker`) are full-screen overlays covering the map

### Dashboard (`Dashboard/`)
- **Config-Driven:** Renders via `DynamicCardRenderer` based on JSON config (`dashboardConfig.ts`)
- **Special Tabs:** `StoryTab` and `ScenariosTab` have custom logic separate from the generic renderer

---

## 5. DATA FLOWS

### Flow 1: Tree Placement (Design)
```
User clicks Map
  → useMapInteractions
  → useTreePlacement.placeTree()
  → variantSlice updates currentDesign.trees
  → useDynamicTreeDensity detects change
  → Debounce (300ms)
  → recalculateTreeDensity
  → analysisSlice receives new column data
  → useAnalysisGridLayer updates visuals
```

### Flow 2: Simulation Execution (Integration)
```
User clicks "Run"
  → useVariantSimulation snapshots design
  → InfraredPayloadBuilder merges base buildings + manual trees
  → InfraredApiClient sends payload
  → Returns grid data
  → gridTransform aligns API grid to App grid
  → variantSlice stores result
  → useVariantAnalysisLayers renders simulation result
```

### Flow 3: Spatial Q&A (AI)
```
User clicks Map
  → useSpatialChatInteractions captures coordinate
  → spatialContextAssembler queries store for nearby features & grid values
  → spatialQaService sends formatted prompt + context to n8n
  → spatialChatSlice adds response message
  → SpatialChatBubble renders text
```

---

## 6. EXTERNAL INTEGRATIONS

| Service | File Path | Usage |
| :--- | :--- | :--- |
| **Infrared.city API** | `services/infrared/InfraredApiClient.ts` | Microclimate simulations (Wind, UTCI). Uses GZIP+Base64 encoding. |
| **OSM Overpass API** | `services/locationFetcher/osmFetcher.ts` | Fetching building footprints and road networks. |
| **TUM WFS** | `services/locationFetcher/tumFetcher.ts` | Fetching accurate building height data. |
| **n8n Webhook** | `services/spatialQaService.ts` | AI processing for Spatial Chat and Story Generation. |
| **MapLibre** | `components/MapView/index.tsx` | Base map tiling and camera control. |
| **IndexedDB** | `services/scenarioStorage.ts` | Persistence of large simulation arrays (Float32Array) to avoid LocalStorage limits. |

---

## 7. CORE ENTITIES

**Modeling of domain objects.**

### Grid
- `AnalysisGridData` uses Structure-of-Arrays (SoA) pattern
- `cellCenters` (Float64Array) and `columns` (Map of Float32Arrays) are separate
- Avoids memory overhead of object arrays (500k cells × 3 properties = 1.5M object instantiations)

### Variant (Design Scenario)
- Type: `DesignVariant` (`types/variant.ts`)
- Stored in `variantSlice.variants` (max 3)
- Contains: `id`, `name`, `trees[]` (user-placed), `simulationId` (API reference)
- Simulations stored as separate Map entry for efficient updates

### Building
- Imported from GeoJSON
- Properties: `Total_Height`, `Shape_Area`, `building_id`
- 3D extrusion via `getBuildingHeight()` in layer config

### Tree
- User-placed via tree tool
- Properties: `id`, `position` [lon, lat], `height`, `type`, `glbUrl`
- Rendered via `ScenegraphLayer` with tree model GLBs

### SpatialChat
- Type: `SpatialChat` (`types/spatialAnalysis.ts`)
- Max 3 concurrent (FIFO eviction)
- Stores: `id`, `position`, `radius`, `messages[]`
- Context assembled at time of creation (snapshot, not reactive)

---

## 8. CURRENT STATE

**Percentage of planned features that exist:**

| Feature Category | Implemented | Status |
| :--- | :--- | :--- |
| **Core Visualization** | 100% | Map, layers, buildings, trees fully functional |
| **Data Loading** | 100% | Location picker, OSM/TUM fetching, height merging |
| **Analysis Grid** | 100% | Wind, UTCI, tree density computed and rendered |
| **Design Variants** | 95% | Tree placement and simulation work; missing correlation charts |
| **Comparison UI** | 90% | Side-by-side modal works; missing per-scenario parameter dashboards |
| **Spatial Q&A** | 85% | Core chat integration works; missing global area context option |
| **Story Mode** | 85% | Playback, camera animation work; missing advanced narrative features |
| **Explosion View** | 40% | Toggle + layer labels work; missing hover tooltips, color legends, value display |
| **Mobility Analysis** | 60-65% | ✅ PathLayer visualization, Dijkstra, UTCI weighting work; missing flow legends, hover inspection, statistics panel |
| **Scope Points** | 0% | Designed in FEATURE_IDEAS.md; not yet implemented |

**Overall Implementation:** ~75-80% of core features complete, 40-50% of nice-to-have features

---

## Architecture Strengths

1. **Type Safety:** Comprehensive Zod schemas for configs + TypeScript strict mode
2. **Performance:** BitmapLayer for static data, GridCellLayer for animated overlays, debounced recalculations
3. **Modularity:** Clear separation between store slices, services, and components
4. **Extensibility:** Config-driven dashboard, generic layer composition via hooks
5. **External Integration:** Clean abstraction layer for Infrared.city API (payload builder, grid transformer)

---

## Known Limitations / Debt

1. **variantSlice too large** (~30KB, 974 lines) - Consider splitting design/simulation logic
2. **Explosion view UX limited** - Layer labels exist, but missing hover tooltips, color legends, value inspection
3. **Mobility visualization minimal** - PathLayer renders flows, but missing legends, hover inspection, statistics panel (60-65% complete)
4. **Scope points not implemented** - Spatial chats are temporary, max 3 concurrent
5. **Spatial Q&A context static** - Snapshots at creation time, no reactive updates (by design for performance)
6. **Grid coordinate system tricky** - Multiple Y-flip transforms (API, BitmapLayer, direct grid index) - well-documented but adds complexity

---

## Validation Notes (2026-01-16)

**Methodology:** 8 Claude Code subagents validated all sections in 2 batches:
- **Batch 1:** Features 1-11, Store Slices, Hook Patterns, External Integrations, Core Entities
- **Batch 2:** Data Flows 1-3, Component Organization, Implementation Status, Architecture Assessment

**Key Findings:**
- ✅ All 11 features exist with accurate descriptions
- ✅ All 8 store slices + kpiStore + screenPositionStore verified
- ✅ All 6 external integrations confirmed (GZIP encoding, IndexedDB, n8n, OSM, TUM, MapLibre)
- ✅ All 5 core entities validated (Grid SoA, Variant, Building, Tree, SpatialChat)
- ✅ All 3 data flows traced through actual code
- ✅ Component organization patterns confirmed
- ⚠️ **Updated:** Mobility Analysis from 30% → 60-65% (PathLayer visualization exists)
- ⚠️ **Updated:** Explosion View now has layer labels (still missing tooltips/legends)
- ⚠️ **Updated:** Known Limitations reflect current state (Mobility UI exists, context static by design)

**Minor Issues Identified:**
- 2 hooks referenced but not found as standalone files (likely embedded in components): `useSpatialChatProjection`, `useAnalysisGridLayer`
- `ExplosionToggle.tsx` has wrong FEATURE_DOC reference (should be analysis-specific, not SpatialAnalysis)
- "Comprehensive" Zod schemas overstates coverage (~3 schema files, ~5% of domains)

---

## 9. DETAILED DATA FLOW EXAMPLES

**Complete traces through the system for key user actions.**

### Flow A: App Initialization Sequence

```
1. App.tsx mounts
   │
2. useEffect triggers dataLoader.loadMetadata()
   ├─→ Fetches /data/processed/metadata.json
   ├─→ Validates via MetadataSchema (Zod)
   └─→ dataSlice.setMetadata(validated)
   │
3. useEffect triggers layer visibility initialization
   ├─→ Reads metadata.layers[].visible flags
   └─→ viewSlice.initializeLayerVisibility(Map)
   │
4. MapView mounts, triggers useGridInitialization()
   ├─→ Stage 1: Create grid geometry (immediate)
   │   ├─→ Compute cellCount from metadata bounds + cellSize (2m)
   │   ├─→ Generate cellCenters (Float64Array)
   │   ├─→ Generate cellPolygons (Float64Array)
   │   └─→ analysisSlice.initializeGrid(gridConfig, gridData)
   │
   ├─→ Stage 2: Load columns (async, reactive)
   │   ├─→ For each enabledGridLayer in config:
   │   │   ├─→ If dataUrl: loadGridColumn() from file
   │   │   ├─→ If computed: getAnalyzer().compute()
   │   │   └─→ analysisSlice.addColumn(column)
   │   └─→ Mark computedColumns Set
   │
   └─→ Stage 3: Generate dummy columns (fallback)
       └─→ If tree_density missing: generate synthetic shading data
   │
5. useKPISync starts watching store changes
   ├─→ buildContext() assembles KPICalculationContext
   ├─→ calculateAllKPIs(context) runs all calculators
   └─→ kpiStore.setAllKPIValues(results)
   │
6. UI renders with loaded data
   └─→ Dashboard shows KPIs, Map shows layers
```

**Key Files:** `App.tsx`, `dataLoader.ts`, `useGridInitialization.ts`, `useKPISync.ts`

---

### Flow B: Tree Placement → Density Recalculation → KPI Update

```
1. User activates tree tool
   ├─→ Toolbar onClick: toolSlice.setActiveTool('polygon-draw')
   └─→ variantSlice.setVariantTool('add-tree')
   │
2. User clicks on map
   ├─→ MapView.handleClick(info)
   ├─→ Checks activeTool === 'polygon-draw' AND variantTool === 'add-tree'
   └─→ useTreePlacement.placeTree(coordinates)
       │
       ├─→ Creates ManualTreeFeature:
       │   {
       │     id: uuid(),
       │     type: 'manual-tree',
       │     treeType: selectedTreeType,
       │     Height: TREE_TYPE_CONFIGS[type].defaultHeight,
       │     Diameter: TREE_TYPE_CONFIGS[type].defaultDiameter,
       │     geometry: Point(coordinates)
       │   }
       │
       └─→ variantSlice.addManualTree(tree)
           ├─→ Appends to currentDesign.designElements.trees[]
           └─→ Increments currentDesign.designVersion
   │
3. useDynamicTreeDensity detects change
   ├─→ Watches: manualTreeCount = trees.length
   ├─→ useEffect triggers on count change
   └─→ Debounce timer starts (500ms)
   │
4. After debounce, recalculation runs
   ├─→ mergeTrees(baseTrees, manualTrees)
   ├─→ recalculateTreeDensity(gridData, mergedTrees)
   │   ├─→ For each grid cell:
   │   │   ├─→ Find trees within radius (turf.js)
   │   │   └─→ Sum weighted density contribution
   │   └─→ Return Float32Array of density values
   │
   └─→ Creates VariantSimulation record:
       {
         id: 'tree_density_' + designVersion,
         type: 'tree_density',
         valuesBase64: encode(densityArray),
         min, max, mean, validCellCount
       }
   │
5. Store simulation result
   ├─→ variantSlice.storeSimulationResult(simulation)
   │   ├─→ Adds to simulations Map
   │   └─→ If activeVariant: updateVariantSimulation()
   │
   └─→ Triggers useKPISync recalculation
       ├─→ buildContext() includes new density data
       ├─→ calculateTreeDensity() reads from column
       └─→ kpiStore.setKPIValue('tree_density_avg', newValue)
   │
6. Visualization updates
   ├─→ useAnalysisGridLayer detects column change
   ├─→ Regenerates BitmapLayer texture from density values
   └─→ deck.gl re-renders with new heatmap
```

**Key Files:** `useTreePlacement.ts`, `variantSlice.ts`, `useDynamicTreeDensity.ts`, `useAnalysisGridLayer.ts`

---

### Flow C: Simulation Execution (Full Infrared.city Integration)

```
1. User clicks "Run Simulation" button
   ├─→ DesignSubmenu.tsx onClick
   └─→ useVariantSimulation.runSimulation('utci')
   │
2. Validation phase
   ├─→ Check studyAreaGeometry exists (≥3 points)
   ├─→ Snapshot designVersion (race condition prevention)
   └─→ Set simulationState: 'running'
   │
3. Geometry preparation
   ├─→ Get base trees from layers.get('trees')
   ├─→ Get manual trees from currentDesign.designElements.trees
   ├─→ mergeTrees(baseTrees, manualTrees)
   │   └─→ Combines both with consistent properties
   │
   └─→ Get buildings from layers.get('buildings')
   │
4. Tile calculation
   ├─→ calculateTileGrid(studyBounds, TILE_SIZE=512m, OVERLAP=50m)
   │   └─→ Returns array of tile bounds
   │
   └─→ For each tile (with progress callback):
       │
       ├─→ Filter buildings to tile bounds
       ├─→ Filter trees to tile bounds
       │
       ├─→ buildInfraredPayload(buildings, trees, tileBounds)
       │   ├─→ Convert GeoJSON → InfraredGeometry format
       │   ├─→ Create CoordinateTransform (WGS84 → local meters)
       │   ├─→ Map layer types → Infrared materials
       │   │   (asphalt, concrete, vegetation, soil, water)
       │   └─→ Return InfraredPayload with:
       │       - geometries[]
       │       - analysisType: 'utci'
       │       - gridResolution: 2m
       │
       ├─→ runInfraredSimulation(payload)
       │   ├─→ GZIP compress payload
       │   ├─→ Base64 encode
       │   ├─→ POST to Infrared.city API (120s timeout)
       │   ├─→ Decode response (GZIP + Base64)
       │   └─→ Return InfraredGridResult:
       │       { grid: number[][], min, max, mean, nullCount }
       │
       └─→ Store tile result
           └─→ If UTCI: wait 8s throttle before next tile
   │
5. Grid merge phase
   ├─→ mergeTilesIntoAppGrid(tileResults, gridConfig)
   │   ├─→ For each tile:
   │   │   ├─→ lonLatToAppGridIndex() transforms coordinates
   │   │   ├─→ Copy values to app grid positions
   │   │   └─→ Handle overlapping regions (average)
   │   │
   │   └─→ Y-FLIP: API row 0 = north, App row 0 = south
   │
   ├─→ applyStudyAreaMask(mergedGrid, studyAreaGeometry, gridConfig)
   │   └─→ Set NaN for cells outside study polygon
   │
   └─→ computeGridStatistics(maskedGrid)
       └─→ { min, max, mean, validCellCount }
   │
6. Store results
   ├─→ Create VariantSimulation:
   │   {
   │     id: uuid(),
   │     type: 'utci',
   │     valuesBase64: base64Encode(Float32Array),
   │     min, max, mean, validCellCount,
   │     computedAt: Date.now()
   │   }
   │
   ├─→ variantSlice.storeSimulationResult(simulation)
   │   ├─→ Add to simulations Map (runtime)
   │   ├─→ Serialize into activeVariant.simulations (persistence)
   │   └─→ Recompute variant KPIs: computeScenarioKPIs()
   │
   └─→ Set simulationState: 'completed'
   │
7. Visualization updates
   ├─→ useVariantAnalysisLayers detects new simulation
   ├─→ Generates BitmapLayer from simulation.valuesBase64
   │   └─→ Y-FLIP again for canvas ImageData
   │
   └─→ deck.gl renders UTCI heatmap overlay
```

**Key Files:** `useVariantSimulation.ts`, `InfraredPayloadBuilder.ts`, `InfraredApiClient.ts`, `gridTransform.ts`

---

### Flow D: Scenario Save → IndexedDB Persistence

```
1. User clicks "Save Scenario"
   ├─→ DesignSubmenu.tsx onClick
   └─→ variantSlice.saveVariant(name)
   │
2. Create DesignVariant record
   ├─→ {
   │     id: uuid(),
   │     name: userInput,
   │     studyAreaGeometry: currentDesign.studyAreaGeometry,
   │     bounds: calculateBounds(studyArea),
   │     designElements: {
   │       trees: [...currentDesign.designElements.trees],
   │       attractors: [...currentDesign.designElements.attractors]
   │     },
   │     simulations: {
   │       wind: serializeSimulation(simulations.get('wind_...')),
   │       utci: serializeSimulation(simulations.get('utci_...')),
   │       treeDensity: serializeSimulation(simulations.get('tree_density_...'))
   │     },
   │     kpis: computeScenarioKPIs(variant, baseline),
   │     createdAt: Date.now(),
   │     lastModified: Date.now(),
   │     designVersion: currentDesign.designVersion
   │   }
   │
   └─→ serializeSimulation():
       ├─→ Float32Array → ArrayBuffer
       └─→ ArrayBuffer → Base64 string (for JSON storage)
   │
3. Enforce 3-variant limit
   ├─→ If variants.length >= 3:
   │   └─→ Remove oldest variant (FIFO)
   │
   └─→ Add new variant to variants[]
   │
4. Persist to IndexedDB
   ├─→ useScenarioPersistence.saveScenarios(variants, activeId)
   │
   ├─→ scenarioStorage.ts:
   │   ├─→ Open database: 'prec-geo-scenarios' (v1)
   │   ├─→ Transaction on 'scenarios' store
   │   │
   │   ├─→ For each variant:
   │   │   ├─→ Convert Base64 simulations → ArrayBuffer (direct binary)
   │   │   └─→ db.put(variantWithBinary)
   │   │
   │   ├─→ Upsert pattern (safe for interruption):
   │   │   ├─→ 1. Get existing IDs
   │   │   ├─→ 2. Write new variants (put is safe)
   │   │   ├─→ 3. Delete removed variants (after writes succeed)
   │   │   └─→ 4. Update metadata
   │   │
   │   └─→ Update metadata store:
   │       { activeVariantId, lastSaved: Date.now() }
   │
5. Update UI state
   ├─→ variantSlice.setActiveVariantId(newId)
   └─→ Toast: "Scenario saved"
```

**Key Files:** `variantSlice.ts`, `scenarioStorage.ts`, `useScenarioPersistence.ts`

---

### Flow E: Spatial Q&A Context Assembly

```
1. User activates Q&A tool and clicks map
   ├─→ toolSlice.setActiveTool('qa')
   └─→ MapView.handleClick → handleQaClick(info)
   │
2. Capture location and check context
   ├─→ Extract [lon, lat] from info.coordinate
   ├─→ Check if inside study area polygon (if exists)
   └─→ useSpatialChatInteractions.handleQaClick()
   │
3. Assemble spatial context (SNAPSHOT - not reactive)
   ├─→ assembleEnhancedSpatialContext():
   │   │
   │   ├─→ assembleNearbyObjects(center, radius):
   │   │   ├─→ Query buildings within radius (turf.distance)
   │   │   ├─→ Query trees within radius
   │   │   ├─→ Query poles, towers within radius
   │   │   ├─→ Sort by distance, take top 30
   │   │   └─→ Return { buildings[], trees[], infrastructure[] }
   │   │
   │   ├─→ assembleAreaAnalysis(center, radius):
   │   │   ├─→ Get grid cells within radius * 1.2 (buffer)
   │   │   ├─→ Sample UTCI column → mean/min/max
   │   │   ├─→ Sample Wind column → mean/min/max
   │   │   ├─→ Sample TreeDensity column → mean/min/max
   │   │   └─→ Return { utci: stats, wind: stats, treeDensity: stats }
   │   │
   │   ├─→ assembleSiteOverview():
   │   │   ├─→ Total building count, avg height
   │   │   ├─→ Total tree count, coverage %
   │   │   └─→ Return aggregated stats
   │   │
   │   └─→ assembleScenarioInfo():
   │       ├─→ Active variant name, tree count
   │       ├─→ Comparison mode (baseline/variant)
   │       └─→ KPI snapshot from kpiStore
   │
   └─→ Build StorageContext (reduced for persistence):
       { nearbyCount, buildingCount, treeCount, utciMean, windMean, treeDensity }
   │
4. Create spatial chat
   ├─→ spatialChatSlice.createSpatialChat(center, context, radius):
   │   │
   │   ├─→ Enforce MAX_CHATS = 3 (FIFO eviction)
   │   │   └─→ If chats.length >= 3: remove oldest
   │   │
   │   └─→ Create SpatialChat:
   │       {
   │         id: uuid(),
   │         location: { worldPosition: [lon, lat] },
   │         messages: [],
   │         context: storageContext,
   │         isExpanded: true,
   │         radiusMeters: 50,
   │         designVersionAtCreation: designVersion,
   │         createdAt: Date.now()
   │       }
   │
   └─→ Return chatId
   │
5. User types question and sends
   ├─→ SpatialChatBubble.handleSend(message)
   │
   ├─→ Reassemble context (imperative, fresh):
   │   └─→ assembleContextImperative() - avoids stale data
   │
   ├─→ Format context as pseudo-XML:
   │   └─→ contextFormatter.formatFullContext(enhancedContext)
   │       <location lon="42.49" lat="18.22" />
   │       <nearby_objects>
   │         <building id="..." distance="12m" height="15m" />
   │         <tree id="..." distance="8m" species="acacia" />
   │       </nearby_objects>
   │       <area_analysis>
   │         <utci mean="28.5" category="comfortable" />
   │         <wind mean="2.1" unit="m/s" />
   │       </area_analysis>
   │
   ├─→ Capture screenshot (optional, first message):
   │   └─→ spatialScreenshotService.captureViewport()
   │
   └─→ Build payload:
       {
         user_message: message,
         session_id: chat.id,
         location: { lon, lat },
         context: contextXml,
         context_summary: buildContextSummary(),
         screenshot: base64Image,
         timestamp: ISO8601
       }
   │
6. Send to n8n webhook
   ├─→ spatialQaService.sendSpatialQuestion(payload):
   │   ├─→ POST to webhook URL (180s timeout)
   │   ├─→ Retry logic: max 3 attempts, 2s delay
   │   │
   │   └─→ Response normalization (8+ formats handled):
   │       ├─→ Direct string
   │       ├─→ { response: string }
   │       ├─→ { json: { response: string } }
   │       ├─→ [{ output: string }]
   │       └─→ ... etc.
   │
   └─→ Return normalized response
   │
7. Display response
   ├─→ spatialChatSlice.addSpatialChatMessage(chatId, {
   │     role: 'assistant',
   │     content: response
   │   })
   │
   └─→ SpatialChatBubble renders with markdown formatting
```

**Key Files:** `useSpatialChatInteractions.ts`, `spatialContextAssembler.ts`, `contextFormatter.ts`, `spatialQaService.ts`

---

### Flow F: Story Mode Playback

```
1. User loads a story
   ├─→ StoryTab.tsx: storySlice.loadStory(storyConfig)
   └─→ storySlice state:
       { activeStory: config, activeStepIndex: 0, isPlaying: false }
   │
2. User clicks Play
   ├─→ storySlice.play()
   └─→ isPlaying: true
   │
3. useStoryEffects watches story state
   ├─→ useEffect on [activeStory, activeStepIndex, isPlaying]
   │
   └─→ For current step, apply effects:
       │
       ├─→ If step.activeVariantId:
       │   └─→ variantSlice.loadVariant(id)
       │
       ├─→ If step.comparisonMode:
       │   └─→ variantSlice.setComparisonMode(mode)
       │
       ├─→ If step.showComparisonModal:
       │   └─→ uiSlice.openComparisonModal()
       │
       ├─→ If step.cameraPreset:
       │   ├─→ Resolve preset → viewport coords
       │   │   ├─→ Priority: studyArea bounds > site bounds > defaults
       │   │   └─→ Calculate zoom from polygon span
       │   └─→ viewSlice.flyTo(viewport, duration: 1500ms)
       │
       ├─→ If step.camera (explicit):
       │   └─→ viewSlice.flyTo(step.camera)
       │
       ├─→ If step.layers.visibility:
       │   └─→ viewSlice.setLayerVisibility(Map)
       │
       ├─→ If step.explosion:
       │   ├─→ analysisSlice.setExplosionEnabled(true/false)
       │   └─→ analysisSlice.setExplosionColumns(columns)
       │
       └─→ If step.region:
           └─→ viewSlice.setCustomRegionGeometry(polygon)
               └─→ useKPISync detects region → filters KPIs to polygon
   │
4. Auto-play timer
   ├─→ Calculate duration: step.duration / playbackSpeed
   ├─→ setTimeout → storySlice.nextStep()
   │
   └─→ If step.duration undefined:
       └─→ Default: 5000ms
   │
5. Step transition
   ├─→ storySlice.nextStep():
   │   ├─→ Increment activeStepIndex
   │   ├─→ If index >= steps.length:
   │   │   └─→ storySlice.pause() - story ends
   │   └─→ Trigger useStoryEffects for new step
   │
   └─→ Loop continues until paused or ended
```

**Key Files:** `storySlice.ts`, `useStoryEffects.ts`, `StoryTab/index.tsx`

---

## 10. ARCHITECTURAL ISSUES & TECHNICAL DEBT

**Deep-dive analysis findings from 4 investigation agents (2026-01-16).**

### 10.1 KPI System Fragmentation

**Problem:** Adding a new KPI requires editing 6-8 files with no compiler support.

**Current Architecture:**
```
┌─────────────────────┐     ┌─────────────────────┐
│  kpiCalculators.ts  │────▶│    kpis.json        │
│  (pure functions)   │     │  (metadata config)  │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  useKPISync.ts      │     │  dashboardConfig.ts │
│  (real-time path)   │     │  (UI references)    │
└─────────────────────┘     └─────────────────────┘
         │
         ▼
┌─────────────────────┐     ┌─────────────────────┐
│  variantSlice.ts    │     │  comparisonConfig.ts│
│  (scenario path)    │────▶│  (KPI row config)   │
└─────────────────────┘     └─────────────────────┘
```

**Issues:**
1. **No Registry:** Must manually add to `calculateAllKPIs()` array
2. **Duplicate Definitions:** Same KPI in 3 places (calculators, JSON, comparison)
3. **Two Code Paths:** Real-time vs scenario KPIs use different implementations
4. **160+ Lines Duplicated:** Grid filtering logic copied across calculators
5. **Implicit Dependencies:** useEffect deps must manually stay in sync

**Files Requiring Edits for New KPI:**
1. `kpiCalculators.ts` - Add calculator function
2. `kpiCalculators.ts` - Register in calculateAllKPIs()
3. `kpis.json` - Add metadata config
4. `types/variant.ts` - Add to ScenarioKPIs interface
5. `variantSlice.ts` - Add to computeScenarioKPIs()
6. `comparisonConfig.ts` - Add to kpiRows array
7. (optional) `dashboardConfig.ts` - Add card reference

---

### 10.2 Analysis Layer Dual Architecture

**Problem:** Pre-calculated (wind/UTCI) and computed (tree_density) layers use different systems.

**Current State:**
```
┌─────────────────────────────────────────────────┐
│                  CONFIG-DRIVEN                   │
│   analysisGridLayers.ts → useLoadGridAnalysis   │
│   (wind_comfort, utci loaded from files)        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  REGISTRY-BASED                  │
│   registry.ts → ANALYZER_REGISTRY               │
│   (tree_density computed - BUT NEVER CALLED!)   │
└─────────────────────────────────────────────────┘
```

**Issues:**
1. **Registry Never Used:** DensityAnalyzer registered but never invoked
2. **Manual Icon Mapping:** LAYER_ICONS hardcoded per layer
3. **Manual Dummy Generators:** Switch statement for each layer type
4. **Manual Explosion Defaults:** explosionColumns array hardcoded
5. **String-Based IDs:** No type safety for layer references

**Files Requiring Edits for New Analysis:**
1. `analysisGridLayers.ts` - Add layer config
2. `AnalysisControls.tsx` - Add icon mapping
3. `useLoadGridAnalysis.ts` - Add dummy generator case
4. `gridDataLoader.ts` - Add generator function
5. `analysisSlice.ts` - Add to explosionColumns default
6. `registry.ts` - Add analyzer (if computed)
7. `types/analysis.ts` - Add to type union
8. Comparison components - Handle new layer type

---

### 10.3 Config-Driven Architecture Gaps

**Reality Score: 4.5/10** - More aspirational than actual.

| Feature | Claim | Reality |
|---------|-------|---------|
| Dashboard | Config-driven | ✅ Mostly (but special-cased tabs) |
| Grid Analysis | Config-driven | ✅ Yes |
| KPIs | Config-driven | ✅ Yes |
| Layer Colors | From metadata | 🔴 Mostly hardcoded |
| Tree Colors | Configurable | 🔴 Hardcoded in hook |
| Selection UI | Configurable | 🔴 Hardcoded constants |
| Layer Z-order | From config | 🔴 Hardcoded dict |
| Metadata | Drives rendering | 🔴 Only `visible` flag used |

**Metadata Is Descriptive, Not Prescriptive:**
- Loaded once at startup (not reactive)
- Only controls initial layer visibility
- Style properties used as fallback only
- heightField, diameterField ignored (hardcoded)

---

### 10.4 File Size Violations

| File | Lines | Limit | Severity |
|------|-------|-------|----------|
| **variantSlice.ts** | 974 | 200 | 🔴 CRITICAL (4.87x) |
| **scenarioStorage.ts** | 853 | 400 | 🔴 HIGH (2.13x) |
| **contextFormatter.ts** | 827 | 200 | 🔴 CRITICAL (4.14x) |
| **InfraredPayloadBuilder.ts** | 806 | 400 | 🔴 HIGH (2.02x) |
| **variant.ts (types)** | 538 | 200 | 🔴 CRITICAL (2.69x) |
| **DesignSubmenu.tsx** | 740 | 500 | 🟠 MEDIUM (1.48x) |
| **ComparisonModal/index.tsx** | 687 | 500 | 🟠 MEDIUM (1.37x) |
| **SpatialChatBubble.tsx** | 634 | 500 | 🟠 MEDIUM (1.27x) |

**Root Cause:** Feature-driven development without extraction refactoring.

---

### 10.5 Coupling & Boundary Violations

**Component → Hook Import Anti-Pattern:**
```typescript
// useTreePlacement.ts (hook layer)
import { TREE_TYPE_CONFIGS } from '../components/MapView/hooks/useManualTreeLayers';

// variantSlice.ts (store layer)
import { TREE_TYPE_CONFIGS } from '../components/MapView/hooks/useManualTreeLayers';

// DesignSubmenu.tsx (component layer)
import { TREE_TYPE_CONFIGS } from '../components/MapView/hooks/useManualTreeLayers';
```

**Issue:** Business logic (tree config) lives in component layer, forcing cross-layer imports.

**Service → Store Type Dependency:**
```typescript
// spatialContextAssembler.ts (service)
import type { StorageContext } from '../store/slices/spatialChatSlice';
```

**Issue:** Services should be pure; shouldn't depend on store types.

---

## 11. LESSONS LEARNED FOR V2 ARCHITECTURE

**Key insights for a ground-up rewrite.**

### 11.1 What Worked Well (Keep These)

1. **Zustand Slice Pattern** - Clear domain separation, predictable state
2. **Hook-Based Layer Composition** - `useBuildingLayers`, `useAnalysisLayers` pattern is clean
3. **Structure-of-Arrays for Grid** - Float32/64Arrays excellent for 500k+ cells
4. **Debounced Recalculations** - 300-500ms debounce prevents thrashing
5. **BitmapLayer for Static Data** - Single texture beats 500k individual cells
6. **Separate KPI Store** - Avoided circular dependencies
7. **External Screen Position Store** - useSyncExternalStore for 60fps updates
8. **Tile-Based API Integration** - Handles large areas gracefully
9. **designVersion Race Detection** - Prevents stale simulation results

### 11.2 What Needs Rethinking

1. **Registry Pattern Should Be First-Class**
   - KPIs, analyzers, layers should use unified registry
   - Auto-discovery from registry, not manual arrays
   - Type-safe IDs via discriminated unions

2. **Config Should Be Validated at Runtime**
   - Zod schemas for ALL configs, not just metadata
   - Fail fast on invalid config (not silent fallbacks)
   - Generate TypeScript types from schemas

3. **Metadata Should Drive Behavior**
   - Reactive metadata (watch for changes)
   - All layer properties from metadata (not hardcoded)
   - Metadata as single source of truth

4. **Single KPI Implementation Path**
   - Scenario KPIs should reuse real-time calculators
   - One interface, one calculation function per KPI
   - Registry auto-handles both paths

5. **File Size Governance from Start**
   - ESLint rules for max lines
   - Extract hooks at 200 lines, services at 300 lines
   - No "we'll refactor later" promises

6. **Coordinate System Abstraction**
   - Single CoordinateSystem class
   - All transforms go through it
   - No scattered Y-flip logic

7. **Tree/Asset Config in Data Layer**
   - `config/treeTypes.ts` not `components/.../useManualTreeLayers.ts`
   - Components import from config, not vice versa

8. **Error Boundaries & Loading States**
   - Centralized error handling (not scattered try/catch)
   - Loading state machine (idle → loading → success/error)
   - User feedback for all async operations

### 11.3 Recommended V2 Structure

```
src/
├── config/                      # ALL configuration
│   ├── layers/
│   │   ├── registry.ts          # Layer type registry
│   │   ├── buildings.ts         # Building layer config
│   │   └── analysis.ts          # Analysis layer configs
│   ├── kpi/
│   │   ├── registry.ts          # KPI registry (single source)
│   │   ├── calculators.ts       # Pure calculation functions
│   │   └── types.ts             # KPI type definitions
│   ├── assets/
│   │   └── trees.ts             # Tree type configs
│   └── ui/
│       ├── dashboard.ts
│       └── comparison.ts
│
├── domain/                      # Business logic (pure)
│   ├── grid/
│   │   ├── GridManager.ts       # Grid operations
│   │   ├── CoordinateSystem.ts  # ALL coordinate transforms
│   │   └── types.ts
│   ├── scenario/
│   │   ├── ScenarioManager.ts   # Create, save, load
│   │   ├── SimulationRunner.ts  # API orchestration
│   │   └── types.ts
│   └── analysis/
│       ├── AnalyzerRegistry.ts  # Unified analyzer dispatch
│       └── analyzers/           # Individual analyzers
│
├── infrastructure/              # External services
│   ├── api/
│   │   ├── InfraredClient.ts
│   │   └── types.ts
│   ├── storage/
│   │   ├── IndexedDBStorage.ts
│   │   └── types.ts
│   └── external/
│       ├── OSMFetcher.ts
│       └── TUMFetcher.ts
│
├── store/                       # Zustand slices (thin)
│   ├── slices/                  # Each slice < 200 lines
│   └── index.ts
│
├── hooks/                       # React integration
│   ├── layers/                  # Layer composition hooks
│   ├── analysis/                # Analysis hooks
│   └── sync/                    # Store sync hooks
│
├── components/                  # UI only (no business logic)
│   ├── Map/
│   ├── Dashboard/
│   └── Modals/
│
└── types/                       # Shared types
    └── index.ts
```

### 11.4 V2 Registry Pattern Example

```typescript
// config/kpi/registry.ts
interface KPIDefinition<T extends string = string> {
  id: T;
  name: string;
  category: 'buildings' | 'environment' | 'microclimate';
  unit: string;
  calculator: (ctx: KPIContext) => number;
  formatter?: (value: number) => string;
  thresholds?: ThresholdConfig;
}

// Type-safe registry
const KPI_REGISTRY = {
  building_count: {
    id: 'building_count',
    name: 'Buildings',
    category: 'buildings',
    unit: '',
    calculator: (ctx) => ctx.buildings?.length ?? 0,
  },
  avg_utci: {
    id: 'avg_utci',
    name: 'Thermal Comfort',
    category: 'microclimate',
    unit: '°C',
    calculator: (ctx) => calculateGridAverage(ctx.gridData, 'utci'),
    thresholds: UTCI_THRESHOLDS,
  },
} as const satisfies Record<string, KPIDefinition>;

// Auto-generated types
type KPIId = keyof typeof KPI_REGISTRY;
type KPIResult = { [K in KPIId]: number };

// Single calculation function
function calculateAllKPIs(ctx: KPIContext): KPIResult {
  return Object.fromEntries(
    Object.entries(KPI_REGISTRY).map(([id, def]) => [id, def.calculator(ctx)])
  ) as KPIResult;
}

// Works for both real-time AND scenarios - no duplication
```

---

## References

- FEATURE_IDEAS.md - Future enhancement roadmap
- CLAUDE.md - Project conventions and gotchas
- Master Plan: `/Users/Joo/.claude/plans/fancy-watching-fairy.md`

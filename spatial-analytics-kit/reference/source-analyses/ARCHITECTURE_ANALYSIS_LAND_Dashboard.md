# Architecture Analysis: LAND-Dashboard-v0

Urban Analytics Platform with 4D KPI System, Speckle 3D Viewer Integration, and Config-Driven Architecture.

---

## Executive Summary

LAND-Dashboard is a config-driven React application for urban analytics that decouples **data processing** (metrics/KPIs) from **visual representation** (Speckle 3D viewer). The core innovation is a **4-dimensional KPI storage system** that enables flexible scenario comparisons, filter combinations, and cached lookups.

**Tech Stack:**
- React 18 + TypeScript + Vite
- Zustand (with Immer) for state management
- Speckle Viewer for 3D visualization
- n8n webhooks for AI integration

---

## 1. 4D KPI System (Core Pattern)

### Key Format
```
analysisId::kpiId::scenarioKey::filterId
```

**Examples:**
- Scenario KPI: `analysis_utci::average_utci::expo::all`
- Non-scenario KPI: `analysis_typology::diversity::::all` (empty scenarioKey)
- Filtered: `analysis_utci::average_utci::expo::wadi_only`

### Implementation Files
```
src/utils/kpi/keys.ts          - Key building/parsing
src/store/slices/kpiResultStore.ts - Multi-dimensional storage with indices
src/utils/kpi/value-resolver.ts    - Value resolution (static/store/template)
```

### Key Utilities (keys.ts)
```typescript
// Build 4D key
const key = kpiKeyUtils.build({
  analysisId: 'analysis_utci',
  kpiId: 'average_utci',
  scenarioKey: 'expo',     // '' for non-scenario
  filterId: 'all'          // default: 'all'
})

// Build with token resolution
const key = kpiKeyUtils.buildWithTokens(
  'analysis_utci',
  'average_utci',
  '$active',     // → activeScenario from store
  '$none',       // → 'all'
  activeScenario,
  activeFilterId
)

// Parse key back to components
const parsed = kpiKeyUtils.parse('analysis_utci::average_utci::expo::all')
// { analysisId, kpiId, scenarioKey, filterId }
```

### Store Architecture (kpiResultStore.ts)
```typescript
interface KPIResultStore {
  results: Record<string, KPIResult>  // 4D keys → results

  // Fast lookup indices (O(1) retrieval)
  indices: {
    byAnalysis: Record<string, Set<string>>   // analysisId → keys
    byFilter: Record<string, Set<string>>     // filterId → keys
    byScenario: Record<string, Set<string>>   // scenarioKey → keys
  }

  activeFilterId: string
  calculationState: { status, progress, errors, inProgress }
  metadata: { dataVersion, lastCalculated, totalResults }
}
```

**Key Actions:**
- `setResult(key, result)` - Store single result + update indices
- `setResultsBatch(results)` - Bulk store for performance
- `getResultByKey(key)` - Direct O(1) lookup
- `getResult(analysisId, kpiId, filterId?)` - Smart lookup with filter fallback
- `getResultsForAnalysis(analysisId)` - Get all KPIs for an analysis
- `getActiveResults()` - Get results for current filter

### Value Resolution (value-resolver.ts)

Three value source types:
```typescript
type ValueSource =
  | { type: 'static', value: number }           // Hardcoded
  | { type: 'store', analysisId, kpiId, scenarioKey, filterId }  // 4D lookup
  | { type: 'template', template: string }      // Expression evaluation

// Usage
const value = resolveValue(source, templateContext, fallback, cacheKey)
```

**Resolution logic:**
1. **Static**: Return `source.value` directly
2. **Store**: Build 4D key → lookup in store → cache result (5min TTL)
3. **Template**: Process through template engine → evaluate expression → cache

### Benefits
1. **Granular Caching**: Scenario switch doesn't invalidate base metrics
2. **O(1) Lookups**: Indexed storage for instant retrieval
3. **Unified API**: All KPI access through same pattern
4. **Type Safety**: 4D format enforced at build/parse time

### Trade-offs
1. **Verbosity**: Every KPI reference needs 4 arguments
2. **JSON Bloat**: Config files become verbose
3. **Learning Curve**: Mental model requires understanding 4 dimensions

---

## 2. Data Pipeline

### Flow Diagram
```
Speckle Stream → WorldTree Walk → Classification → DataTables
                                                      ↓
                                     KPICalculator (scenario filtering)
                                                      ↓
                                     4D Store (indexed results)
                                                      ↓
                               Template Engine → UI Cards → Viewer Commands
```

### Key Processors

| Processor | File | Responsibility |
|-----------|------|----------------|
| **KPICalculator** | `processors/KPICalculator.ts` | Aggregation, scenario field resolution |
| **ColorProcessor** | `processors/ColorProcessor.ts` | Gradient/categorical color strategies |
| **FilterProcessor** | `processors/FilterProcessor.ts` | Global filter application |
| **VisibilityProcessor** | `processors/VisibilityProcessor.ts` | Ghost/hide commands |
| **LayerInheritanceProcessor** | `processors/LayerInheritanceProcessor.ts` | Config inheritance |

### KPI Calculation Flow (KPICalculator.ts)

```typescript
async calculateKPIs(kpis, analyses, dataTables, filters, selectedIds) {
  // 1. Apply scenario object filtering (filter_scenario_* attributes)
  if (project.scenarios.applyObjectFiltering) {
    processedTables = this.applyScenarioObjectFiltering(tables, activeScenario)
  }

  // 2. Apply global filtering
  processedTables = this.applyGlobalFilteringToTables(tables, filters, activeFilterId)

  // 3. Check cache first (huge perf win)
  const cached = store.getResultByKey(baseKey)
  if (cached) return cached

  // 4. Calculate single KPI
  const value = await this.calculateSingleKPI(kpiConfig, analysis, tables)

  // 5. Store base result
  store.setResult(baseKey, kpiResult)

  // 6. Pre-compute ALL scenario variants
  await this.calculateScenarioKPIs(kpiConfig, analysis, tables)
}
```

### Scenario Field Resolution

**Data structure:**
```json
{
  "id": "tree-1",
  "properties": {
    "analysis_tree_age": 25,           // Base (fallback)
    "analysis_tree_age__EXPO": 30,     // Expo scenario
    "analysis_tree_age__LEGACY": 20    // Legacy scenario
  }
}
```

**Resolution (attributeResolver.ts):**
```typescript
// Auto-detect scenario variants
const hasScenarioData = hasScenarioVariants(baseFieldName, sampleObjects)
// Checks: utci__BASE, utci__EXPO, utci__LEGACY

// Resolve to current scenario
const fieldName = resolveScenarioField('utci', { scenario: activeScenario })
// If activeScenario = 'expo' → 'utci__EXPO'
```

### Aggregation Methods (KPICalculator.ts)

| Method | Description |
|--------|-------------|
| `average` | `sum(values) / length` |
| `sum` | Total of all values |
| `count` | Number of objects |
| `min/max` | Extremes |
| `median` | Middle value |
| `percentageByValue` | `count(matching) / total * 100` |
| `standardDeviation` | Statistical spread |
| `countWithinBounds` | Count in range |
| `countByValue` | Count specific value |

---

## 3. Config-Driven Architecture

### Configuration Hierarchy
```
public/project-config/[project]/
├── project.json           # Global settings, scenarios
├── scorecards/
│   ├── index.json         # Scorecard registry
│   └── *.json             # Individual scorecards
├── analyses/
│   └── *.json             # Analysis definitions
├── layer-presets.json     # Reusable layer configs
├── navigation-rules.json  # Navigation hierarchy
└── annotations/*.json     # 3D annotations
```

### Project Config (project.json)
```json
{
  "name": "LAND",
  "speckle": { "endpoint": "...", "streamId": "..." },
  "scenarios": {
    "attributeStrategy": "suffix",
    "configurations": {
      "base": { "suffix": "__BASE", "label": "Baseline" },
      "expo": { "suffix": "__EXPO", "label": "Expo 2030" },
      "legacy": { "suffix": "__LEGACY", "label": "Legacy 2045" }
    },
    "defaultScenario": "base",
    "applyObjectFiltering": true
  }
}
```

### Analysis Config (analyses/*.json)
```json
{
  "id": "analysis_utci",
  "fieldName": "utci",
  "dataType": "numeric",
  "scenario": true,
  "bounds": { "min": 0, "max": 50 },
  "targetCollections": ["analysis_ground"],
  "colorScale": {
    "domain": [0, 50],
    "colors": ["#22c55e", "#f59e0b", "#ef4444"]
  },
  "kpis": {
    "average_utci": {
      "name": "Average UTCI",
      "aggregation": "average",
      "unit": "°C",
      "format": ".1f"
    }
  }
}
```

### Scorecard Config (scorecards/*.json)
```json
{
  "version": "1.0.0",
  "scorecard": {
    "id": "thermal_comfort",
    "name": "Thermal Comfort",
    "icon": "🌡️"
  },
  "kpis": [
    {
      "analysisId": "analysis_utci",
      "kpiId": "average_utci",
      "displayType": "complex",
      "position": 1,
      "valueSource": {
        "type": "store",
        "analysisId": "analysis_utci",
        "kpiId": "average_utci",
        "scenarioKey": "$active",
        "filterId": "$none"
      },
      "target": 32,
      "insights": {
        "template": "Current UTCI is {{value}}°C in {{scenario}}"
      }
    }
  ],
  "layers": { /* visibility/color configs */ },
  "layerInheritance": {
    "inherits": "analysis-base",
    "overrides": [ /* specific changes */ ]
  }
}
```

### Layer Inheritance System

```typescript
// LayerInheritanceProcessor.ts
// Preset → Scorecard → Override chain
const resolvedLayers = processor.resolve({
  presets: layerPresets,           // Base configurations
  scorecard: scorecardConfig,       // Scorecard-specific
  overrides: kpiConfig.overrides    // KPI-specific
})
```

**Benefits:**
- DRY: Common configs in presets
- Flexible: Override at any level
- Traceable: Clear inheritance chain

### Manual Override System

Two systems based on card type:

**System A (Pure Config):** `TextCard`, `HighlightInfoCard`
- Always bypass validation
- `analysisId/kpiId` can be any value
- Direct static content

**System B (Synthetic):** `HeadlineCard`, `BulletCard`, etc.
- Bypass validation when `config` exists
- Uses `dummy_analysis` convention
- Generates synthetic `KPIResult` objects

---

## 4. Template Engine

### Implementation Files
```
src/utils/templates/processor.ts       - Template parsing/evaluation
src/utils/templates/TemplateContext.ts - Context interface
src/utils/core/math.ts                 - SafeArithmeticEvaluator
src/hooks/templates/useTemplateProcessor.ts - React hook
```

### Template Syntax

**KPI References:**
```
{{kpi:analysisId:kpiId:scenarioKey:filterId}}
{{kpi:analysis_utci:average_utci:$active:$none}}
```

**Variables:**
```
{{value}}     - Current KPI value
{{scenario}}  - Active scenario name
{{unit}}      - KPI unit
```

**Formatters:**
```
{{formatters.round(value, 1)}}
{{formatters.percent(value)}}
```

**Ternary expressions:**
```
{{scenario === 'expo' ? 'Expo 2030' : 'Legacy'}}
```

### Template Processing (processor.ts)

```typescript
processTemplate(template: string, context: TemplateContext, options): string {
  // 1. Extract all {{...}} expressions
  const matches = template.matchAll(/\{\{(.+?)\}\}/g)

  // 2. Batch fetch KPI references
  const kpiRefs = extractKpiRefs(matches)
  const kpiValues = context.getKpiBatch4D(kpiRefs)

  // 3. Replace tokens with values
  return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
    if (expr.startsWith('kpi:')) {
      return resolveKpiToken(expr, kpiValues)
    }
    return evaluator.evaluate(expr, context.variables)
  })
}
```

### SafeArithmeticEvaluator (math.ts)

- Replaced `new Function()` (security risk) with `mathjs`
- Whitelisted functions: `add`, `sub`, `mul`, `div`, `sqrt`, etc.
- Validates all variables are finite numbers
- Returns fallback on error

---

## 5. Speckle Integration

### Object Classification (DataCollectionClassifier.ts)

```typescript
classifyObjectsToTables(speckleObjects: SpeckleObject[]) {
  const collectionMap = new Map<string, SpeckleObject[]>()

  // Group by dataCollection property
  for (const obj of speckleObjects) {
    const dcId = obj.properties?.dataCollection
    if (dcId) {
      if (!collectionMap.has(dcId)) collectionMap.set(dcId, [])
      collectionMap.get(dcId).push(obj)
    }
  }

  // Convert to DataCollectionTables (strips geometry)
  return Object.fromEntries(
    [...collectionMap].map(([id, objs]) => [
      id,
      new DataCollectionTable(id, humanize(id), objs)
    ])
  )
}
```

### Color Strategies (ColorProcessor.ts)

| Strategy | Use Case | Implementation |
|----------|----------|----------------|
| **discrete** | Categorical data | `filteringExtension.setUserObjectColors` |
| **gradient-points** | Point clouds (83k+) | Direct vertex color buffer write |
| **gradient-mesh** | Mesh objects | Quantized color buckets (~25 colors) |

### Performance Bottlenecks

1. **Speckle API Calls**: `setUserObjectColors` is O(N) where N = color groups
2. **State Leakage**: `resetFilters()` doesn't clear vertex colors
3. **Solution**: "Full Reset" strategy - manually scrub buffers between states

### Mesh Scaling (MeshScaleExtension.ts)

```typescript
// Batch collect transformations
const transforms = objects.map(obj => ({
  id: obj.id,
  scale: scenarioTransforms[activeScenario]?.scale || 1.0,
  pivot: 'BOTTOM_CENTER'
}))

// Single animation loop for all objects
requestAnimationFrame(() => {
  for (const transform of transforms) {
    applyScale(transform)
  }
})
```

---

## 6. AI Integration

### Webhook Endpoints
```
/LAND-CHAT-WITH-DOCS     - General chat assistant
/ai-data-summary         - Scorecard insights
/LAND-LOCATION-CONTEXT   - Spatial Q&A (3D location)
```

### Context Generation (utils/ai/lookupContext.ts)

```typescript
function generateDashboardContext({
  scorecard,
  kpiResults,
  analyses,
  instructions
}): string {
  return `
=== CURRENT VIEW ===
Scorecard: ${scorecard.name}
Active Scenario: ${activeScenario}
Active Filter: ${activeFilterId}

=== KEY PERFORMANCE INDICATORS ===
${kpiResults.map(kpi => formatKPIResult(kpi, analyses)).join('\n')}

=== INSTRUCTIONS ===
${instructions}
`
}
```

### Spatial Q&A (AILookupWidget.tsx)

1. Double right-click → creates widget at 3D location
2. Captures viewport screenshot with legends
3. Collects clicked object properties
4. Includes 4D KPI values for context
5. Sends to n8n webhook

---

## 7. What Worked Well

### Patterns to Extract

1. **4D Key System**: Flexible multi-dimensional storage with token resolution
2. **Config-Driven Architecture**: JSON configs for rapid project customization
3. **Layer Inheritance**: DRY configs with preset → override chain
4. **Processor Pattern**: Modular KPICalculator, ColorProcessor, etc.
5. **Template Engine**: Dynamic value resolution with formatters
6. **Batch Operations**: Debounced viewer updates, bulk store writes
7. **Index-Based Lookups**: O(1) retrieval via indices

### Specific Wins

- **Cross-scorecard caching**: KPI results persist when switching views
- **Scenario pre-computation**: All variants calculated upfront
- **Auto-detection**: Scenario field variants detected from data
- **Structured logging**: Category-based logger for debugging

---

## 8. Pain Points & Lessons Learned

### What Caused Most Bugs

1. **Visual State Leakage**: Colors from previous scorecard "sticking"
   - Root cause: Speckle's `resetFilters()` doesn't clear vertex colors
   - Fix: Manual "Full Reset" scrubbing all buffers

2. **Race Conditions**: Viewer loading vs config loading timing
   - `DataCollectionClassifier` ran before WorldTree ready
   - Fix: Wait for viewer `loadComplete` event

3. **Infinite Re-renders**: Object selectors in Zustand
   ```typescript
   // ❌ WRONG - new object every render
   const { data, loading } = useStore(s => ({ data: s.data, loading: s.loading }))

   // ✅ CORRECT - individual selectors
   const data = useStore(s => s.data)
   const loading = useStore(s => s.loading)
   ```

### Over-Engineered Parts

1. **Two Filter Pipelines**: KPI filtering vs Visual visibility separation is confusing
2. **4D Verbosity**: Every KPI reference needs 4 arguments in JSON
3. **Three Color APIs**: Discrete, vertex colors, material colors - too fragmented (-> becasue of spoeckle viewer)

### What to Simplify

1. **Unified Visual API**: Single `setColor(ids, color)` wrapping all strategies
2. **TypeScript Configs**: `.ts` files instead of JSON for type safety
3. **Schema Validation**: IDE-level validation, not just runtime
4. **Simplified Key Format**: Consider `analysis/kpi/scenario/filter` (fewer chars)

---

## 9. Reusable Pattern Extraction

### For Future Projects

1. **Multi-Dimensional KPI Store**
   - Flexible key format (adjust dimensions as needed)
   - Index-based lookups
   - Batch operations
   - Cache with TTL

2. **Config-Driven System**
   - JSON/TS config files
   - Inheritance/override chain
   - Runtime validation with clear errors
   - Schema definitions (Zod recommended)

3. **Processor Pattern**
   - Modular processors (KPI, Color, Visibility)
   - Orchestrator that coordinates them
   - Clear input/output interfaces

4. **Template Engine**
   - Token syntax: `{{namespace:...}}`
   - Batch value resolution
   - Safe arithmetic evaluation
   - Formatter registry

5. **Scenario Management**
   - Field suffix strategy (`field__SCENARIO`)
   - Auto-detection of variants
   - Pre-computation of all scenarios
   - Object membership filtering

### Adaptation Notes

- **Not all projects need 4D**: Start with 2D (analysis::kpi), add dimensions as needed
- **Scenario complexity varies**: Some projects just need baseline + 1 variant
- **Filter dimension optional**: Many projects don't need sub-filtering
- **Template engine portable**: Can be extracted as standalone utility

---

## 10. File Reference

### Core Architecture
```
src/store/slices/kpiResultStore.ts      - 4D KPI storage
src/utils/kpi/keys.ts                   - Key building/parsing
src/utils/kpi/value-resolver.ts         - Value resolution
src/data/processing/processors/         - All processors
src/hooks/templates/useTemplateProcessor.ts - Template hook
```

### Data Flow
```
src/app/App.tsx                         - Speckle loading
src/data/classification/                - Object classification
src/data/processing/DataCollectionTable.ts - Analytics tables
```

### Config Loading
```
src/config/configLoader.ts              - Config parsing
src/models/*.types.ts                   - TypeScript interfaces
```

### AI Integration
```
src/utils/ai/lookupContext.ts           - Context formatting
src/components/ai/                      - Chat/Lookup components
src/hooks/useAISummary.ts               - Summary generation
```

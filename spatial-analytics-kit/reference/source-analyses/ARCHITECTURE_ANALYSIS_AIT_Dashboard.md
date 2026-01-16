# Architecture Analysis: AIT Dashboard

## Executive Summary

**Project Type:** Real-time urban design comparison dashboard for live workshops
**Focus:** KPI visualization and scenario comparison (not spatial/map-centric)
**Key Strength:** Extended 4D token system for dynamic cross-scenario comparisons

Unlike prec-geo-showcase (grid-based spatial analysis) and LAND-Dashboard (Speckle 3D + scorecards), AIT Dashboard is a **pure KPI comparison platform** optimized for:
- Side-by-side scenario comparison (3-5 variants)
- Bidirectional sync with Grasshopper (computational design tool)
- Live workshop decision-making with real-time updates
- Config-driven UI with minimal code changes

**Reusable Patterns:**
- 4D key system for KPI storage (`analysisId::kpiId::scenarioKey::filterId`)
- Token resolution for dynamic comparisons (`$this`, `$best`, `$worst`, `$average`)
- Series-first comparison pattern for flexible visualization
- Statistics auto-calculation with `queueMicrotask`
- 5-level bounds hierarchy for chart scales

---

## 1. Data Pipeline

### Architecture Overview

```
Grasshopper (Design Tool)
    ↓ HTTP POST (KPI arrays, scenario metadata)
Sync Bridge (Node.js :8787)
    ↓ WebSocket broadcast
Dashboard Client
    ↓ ws.onmessage → ingestKPIData()
4D Key Transformation
    ↓ build4DKey(analysisId, kpiId, scenarioKey, filterId)
Zustand Store (state.results)
    ↓ queueMicrotask → calculateStatistics()
Statistics Store (state.statistics)
    ↓ Token resolution
KPI Cards (useKpiData, useSeriesData hooks)
```

### The 4D Key System

**Core Innovation:** Flattens multi-dimensional KPI data into a single Record for O(1) lookups.

```typescript
// Format: analysisId::kpiId::scenarioKey::filterId
const key = build4DKey('thermal', 'avg_utci', 'option_a', 'all')
// Result: "thermal::avg_utci::option_a::all"

// Store structure
results: {
  "thermal::avg_utci::option_a::all": { value: 23.5, timestamp: 1234567890 },
  "thermal::avg_utci::option_b::all": { value: 25.0, timestamp: 1234567890 }
}
```

**Benefits:**
- Decouples UI from data structure
- O(1) value retrieval (no tree traversal)
- Enables wildcard filtering (`filterKeysByPattern`)
- Cache-friendly operations

**Key Files:**
- `src/utils/kpi/keyBuilder.ts` - Key building/parsing utilities
- `src/utils/projects/projectLoader.ts` - Data ingestion (`ingestKPIData`)
- `src/store/slices/kpiSlice.ts` - Store and statistics

### Data Ingestion Flow

```typescript
// Input: StructuredKPIData
interface StructuredKPIData {
  scenarioKey: string;
  timestamp: number;
  kpis: Array<{
    analysisId: string;
    kpiId: string;
    filterId?: string;  // defaults to 'all'
    value: number | string;
    metadata?: Record<string, any>;
  }>;
  nonScenarioKpis?: Array<...>;   // Empty scenarioKey
  regionalKpis?: Array<...>;       // With filterId
}

// Transformation in ingestKPIData():
// 1. Iterate each KPI type
// 2. Build 4D key for each
// 3. Store in results object
// 4. Call store.setResults(results)
```

### Statistics Auto-Calculation

**Pattern:** Use `queueMicrotask` to defer expensive calculations without blocking UI.

```typescript
// In kpiSlice.ts
setResults: (results) => {
  set((state) => ({ results: { ...state.results, ...results } }));

  // Extract affected (analysisId, kpiId) pairs
  const pairs = new Set<string>();
  Object.keys(results).forEach((k) => {
    const { analysisId, kpiId } = parse4DKey(k);
    pairs.add(`${analysisId}::${kpiId}`);
  });

  // Defer calculation to microtask queue
  queueMicrotask?.(() => {
    pairs.forEach((pair) => {
      const [a, k] = pair.split('::');
      get().calculateStatistics(a, k);
    });
  });
}
```

**Why queueMicrotask:**
- Executes after current JS context but before rendering
- Allows React to batch state updates first
- Prevents UI blocking during heavy aggregation

---

## 2. KPI/Metrics System

### Token System

**Core Concept:** Tokens are placeholders resolved at runtime based on context.

| Token | Resolves To | Type | Use Case |
|-------|-------------|------|----------|
| `$this` | Current column's scenario | Scenario key | Per-column values |
| `$active` | Currently selected scenario | Scenario key | Active comparison |
| `$best` | Best performing scenario | Scenario key | Performance comparison |
| `$worst` | Worst performing scenario | Scenario key | Performance comparison |
| `$average` | Mean across scenarios | **Number** | Statistical reference |
| `$median` | Median across scenarios | **Number** | Statistical reference |
| `$thisRank` | Current scenario's rank | **Number** | Ranking display |
| `$rank_N` | Nth-ranked scenario | Scenario key | Top-N comparisons |

**Critical Distinction:**
- **Scenario tokens** (`$this`, `$best`) → resolve to scenario keys → used in 4D key building
- **Value tokens** (`$average`, `$median`) → resolve to numeric values → used directly

```typescript
// Token resolution flow
const resolved = resolveToken('$best', context);
// 1. Check if statistical token requiring stats
// 2. Look up context.statistics?.best?.scenario
// 3. Return scenario key: "option_c"

// Value token flow
const value = resolveToken('$average', context);
// Returns number directly: 23.5
```

**Key File:** `src/utils/kpi/tokenResolver.ts`

### Series-First Comparison Pattern

**Definition:** Instead of hardcoding comparisons, define series items with tokens that resolve dynamically.

```typescript
// Series configuration (in scorecard JSON)
"series": [
  {
    "id": "current",
    "label": "Current ($this)",
    "source": {
      "type": "store",
      "analysisId": "thermal",
      "kpiId": "avg_utci",
      "scenarioKey": "$this",
      "filterId": "$none"
    }
  },
  {
    "id": "best",
    "label": "Best",
    "source": {
      "type": "store",
      "scenarioKey": "$best",  // Token!
      "filterId": "$none"
    }
  }
]
```

**Resolution Flow:**

```typescript
// 1. Card calls useSeriesData hook
const { seriesItems, seriesValues } = useSeriesData({
  analysisId, kpiId, scenarioKey, series
});

// 2. Hook calls resolveSeriesComparisons()
// 3. For each series item:
//    - If $average/$median: resolve to number directly
//    - If $best/$worst/$this: resolve to scenario key → build 4D key → fetch value
// 4. Returns ProcessedSeriesItem[] with actual values
```

**Benefits:**
- Same config works across all scenario columns
- Comparisons update automatically when statistics change
- Flexible: add/remove comparison items via config only

**Key Files:**
- `src/utils/kpi/seriesResolver.ts` - Series resolution logic
- `src/hooks/kpi/useSeriesData.ts` - React hook wrapper

### Statistics Structure

```typescript
interface KPIStatistics {
  best: { scenario: string; value: number };
  worst: { scenario: string; value: number };
  average: number;
  median: number;
  rankings: Array<{
    scenario: string;
    value: number;
    rank: number;  // 1-indexed
  }>;
}

// Stored by 2D key (no scenario/filter)
statistics: {
  "thermal::avg_utci": { best: {...}, worst: {...}, ... }
}
```

---

## 3. State Management

### Zustand Slice Architecture

**8 Domain Slices:**

| Slice | Purpose | Key State |
|-------|---------|-----------|
| `dataSlice` | Scenario metadata | `scenarios`, `loadScenarios()` |
| `kpiSlice` | KPI values + statistics | `results`, `statistics`, `calculateStatistics()` |
| `uiSlice` | UI state | `activeScenario`, `activeTopicLens`, `focusPanelOpen` |
| `configSlice` | Project configuration | `project`, `analyses`, `topicLenses`, `scorecards` |
| `imageInteractionSlice` | Image sync state | Crosshair positions, hover state |
| `themeSlice` | Theme management | `theme`, `toggleTheme()` |
| `thumbnailSlice` | Scenario thumbnails | `thumbnails`, `setThumbnail()` |
| `personasSlice` | AI personas | `personas`, `assessments`, `selectedPersona` |

**Critical Pattern: Individual Selectors**

```typescript
// ❌ WRONG - Object destructuring causes infinite re-renders!
const { scenarios } = useAITStore(state => ({ scenarios: state.data.scenarios }))

// ✅ CORRECT - Individual selectors
const scenarios = useAITStore(state => state.scenarios)
const activeScenario = useAITStore(state => state.activeScenario)
```

**Key File:** `src/store/store.ts`

### WebSocket Sync Architecture

```
GH Instance A ←→┐
GH Instance B ←→├─→ Sync Bridge (:8787) ←→ Dashboard(s)
GH Instance C ←→┘
```

**Message Types:**
- `kpi.upsert` - Batch KPI data from Grasshopper
- `scenario.upsert` - Scenario metadata + thumbnails
- `state.activeScenario` - Sync active scenario selection
- `state.activeAnalysis` - Sync analysis focus

**Loop Prevention:**
```typescript
// Suppress flags prevent echo loops
suppressNextSendActiveScenario: boolean;
suppressNextSendActiveAnalysis: boolean;
```

---

## 4. Configuration System

### Config Hierarchy

```
Project (config.json)
├── defaultState (activeTopicLens, visibleScenarios, etc.)
├── thumbnails (per-scenario images)
├── features (aiSummaries, focusPanel, liveSync)
└── dataSource (static vs websocket)

Analyses (analyses/*.json)
├── id, name, description
├── bounds (analysis-level default)
└── kpis
    ├── id, name, unit, format
    ├── goodDirection ('+' or '-')
    ├── thresholds (performance zones)
    ├── bounds (KPI-level override)
    └── target (optional)

Topic Lenses (topics/*.json)
├── id, name, icon
├── scorecards[] (references)
└── headerCards (optional text/media)

Scorecards (scorecards/*.json)
├── id, name, description
└── cards[]
    ├── type (kpi, headline, bullet, media)
    ├── analysisId, kpiId
    ├── display (variant, badgeMode)
    └── series[] (comparison config)

Scenarios (scenarios/*.json)
├── scenarioKey, timestamp
├── kpis[] (main KPI values)
├── nonScenarioKpis[] (shared values)
└── regionalKpis[] (filtered values)
```

### Bounds Calculation Hierarchy (5 Levels)

**Priority Order (highest to lowest):**

1. **KPI-level bounds** - `kpiConfig.bounds`
2. **KPI thresholds** - Derived from `thresholds[].min/max`
3. **Analysis-level bounds** - `analysisConfig.bounds`
4. **Statistics-based** - From `best/worst` values + padding
5. **Data fallback** - `min(values)` to `max(values)` + 10% buffer

```typescript
// In KpiCard.tsx bounds calculation
const calculateBounds = () => {
  // Level 1: KPI explicit bounds
  if (kpiConfig?.bounds?.min !== undefined) {
    return { min: kpiConfig.bounds.min, max: kpiConfig.bounds.max };
  }

  // Level 2: Extract from thresholds
  if (kpiConfig?.thresholds?.length) {
    const mins = thresholds.map(t => t.min).filter(v => v !== null);
    const maxs = thresholds.map(t => t.max).filter(v => v !== null);
    return { min: Math.min(...mins), max: Math.max(...maxs) };
  }

  // Level 3: Analysis bounds
  if (analysisConfig?.bounds) { ... }

  // Level 4-5: Statistics or data fallback
  const allValues = [currentValue, ...seriesValues];
  const buffer = (max - min) * 0.1;
  return { min: min >= 0 ? 0 : min - buffer, max: max + buffer };
};
```

**Key File:** `src/utils/kpi/boundsCalculation.ts`

---

## 5. Template Engine

### Overview

Secure expression evaluation using `mathjs` (no `eval`).

```typescript
// Template syntax
"{{kpi:thermal:avg_utci:$this:all}}"           // KPI reference
"{{kpi:thermal:avg_utci:$best:all:.1f}}"       // With format
"{{series.baseline.value}}"                     // Series reference
"{{(value - baseline) / baseline * 100}}"       // Math expression
"{{value > 100 ? 'High' : 'Normal'}}"          // Conditional
```

### Processing Flow

```typescript
// 1. Scan for {{kpi:...}} patterns
// 2. Pre-fetch all referenced KPI values from store
// 3. Replace patterns with literal values
// 4. Normalize JS syntax to mathjs syntax
//    - === → ==
//    - && → and, || → or, ! → not
//    - Math.* → mathjs equivalents
// 5. Evaluate with mathjs.evaluate()
// 6. Apply format if specified
```

### LRU Cache

```typescript
// Cache config
const CACHE_SIZE = 100;
const CACHE_TTL = 60_000; // 1 minute

// Cached items:
// - Parsed template patterns
// - Compiled expressions
// - Evaluation results (with context hash)
```

**Key Files:**
- `src/utils/templates/processor.ts` - Main processor
- `src/hooks/templates/useTemplateProcessor.ts` - React hooks

---

## 6. Topic Lens → Column Mechanism (Key Pattern)

### The "Configure Once, Display Many" Architecture

This is one of the most elegant patterns in the codebase. The UI is driven entirely by configuration, with the same config rendering differently per scenario column.

```
TopicLens (tab)
├── scorecards: ['scorecard_thermal', 'scorecard_mobility']
├── headerCards: [{ media, title, content }]
└── focusPanel: { enabled, cards }

Scorecard (row)
├── name: 'Thermal Comfort'
├── cards: [
│   { analysisId, kpiId, series: [{ source: { scenarioKey: '$this' }}] },
│   { analysisId, kpiId, series: [{ source: { scenarioKey: '$best' }}] }
│ ]

Rendering (App.tsx)
├── visibleScenarios.map(scenarioId =>
│   ├── <ScenarioColumn>
│   │   ├── scorecardIds.map(id =>
│   │   │   └── <Scorecard scorecardId={id} scenarioKey={scenarioId} />
│   │   │       └── cards.map(card =>
│   │   │           └── <KpiCard cardConfig={card} scenarioKey={scenarioId} />
│   │   │               └── $this → scenarioId (resolved!)
```

### How Token Resolution Enables This

**Without tokens:** You'd need separate configs for each scenario column:
```json
// BAD: 3 configs for 3 scenarios
{ "scenarioKey": "option_a", "analysisId": "thermal", "kpiId": "utci" }
{ "scenarioKey": "option_b", "analysisId": "thermal", "kpiId": "utci" }
{ "scenarioKey": "option_c", "analysisId": "thermal", "kpiId": "utci" }
```

**With tokens:** One config works for ALL columns:
```json
// GOOD: 1 config with $this token
{ "scenarioKey": "$this", "analysisId": "thermal", "kpiId": "utci" }
// $this → "option_a" in column A, "option_b" in column B, etc.
```

### Code Flow

```typescript
// App.tsx:346-349 - Entire column rendering
{scorecardIds.map((id) => (
  <Scorecard key={id} scorecardId={id} scenarioKey={scenarioId} />
))}

// Scorecard.tsx - Pass scenarioKey down
{cards.map((card) => (
  <KpiCard cardConfig={card} scenarioKey={scenarioKey} />
))}

// KpiCard.tsx → useSeriesData.ts → tokenResolver.ts
// $this resolves to the scenarioKey prop
const resolved = resolveToken('$this', { scenarioKey }); // → "option_a"
```

**Key Insight:** The entire comparison dashboard is just ONE configuration rendered N times with different `$this` contexts.

---

## 7. AI Personas System (Excellent UX Pattern)

### Concept

AI-powered stakeholder simulation for scenario evaluation. Different personas (urban planner, investor, resident, environmentalist) evaluate scenarios from their unique perspectives.

### Architecture

```
PersonasSelector (container)
├── Tabs: Experts | Citizens
├── PersonaCard[] (list of selected personas)
│   ├── Header: Avatar + Name + One-liner OR SentimentBar (toggle)
│   ├── Expanded: Description | Analysis tabs
│   │   └── Analysis: ScenarioSentimentBar + ScenarioOpinionCard[]
│   └── Remove button
├── "Add More" → Hidden personas menu
├── Progress bar (during assessment)
└── Actions: "Analyze N Personas" | "Generate SWOT"

Data Flow:
1. User selects personas to analyze
2. runAssessment(personaIds) → parallel API calls
3. Each persona evaluates ALL visible scenarios
4. Results stored: { personaId → { scenarioOpinions[], rankings } }
5. SWOT aggregates across all persona assessments
```

### Key Components

**PersonaCard** (`src/components/FocusPanel/personas/PersonaCard.tsx`):
- Shows persona identity (avatar, name, role)
- Toggle between one-liner description and compact sentiment bar
- Expandable for detailed analysis
- Per-scenario opinion cards with sentiment ratings

**ScenarioSentimentBar** (`src/components/FocusPanel/personas/ScenarioSentimentBar.tsx`):
- Horizontal bar from "Very Negative" to "Very Positive"
- Markers positioned by sentiment rating
- Visual comparison of how persona views each scenario

**usePersonaAssessment** (`src/hooks/ai/usePersonaAssessment.ts`):
- Batch assessment runner with progress tracking
- Cancellable operations
- Error handling per-persona

### Data Structure

```typescript
interface PersonaAssessment {
  timestamp: number;
  detailed_text: string;
  scenarioOpinions: Array<{
    scenario_name: string;
    rating: number;        // -2 to +2 (very negative to very positive)
    opinion: string;       // Detailed text opinion
  }>;
  rankings: Record<string, {
    position: 'best' | 'good' | 'neutral' | 'poor' | 'worst';
    score: number;         // 0-1 normalized
  }>;
}
```

### Why This Is Excellent

1. **Human-Centric Evaluation**: Numbers don't tell the whole story. "28°C UTCI" means nothing to stakeholders. A persona saying "This plaza will be uncomfortable for elderly residents during summer afternoons" is actionable.

2. **Multiple Perspectives**: One scenario might be great for investors (high FAR) but terrible for residents (no green space). Personas surface these trade-offs.

3. **Narrative Generation**: The SWOT aggregation creates a story from quantitative data.

4. **Progressive Disclosure**: One-liner → Sentiment bar → Full analysis. User controls detail level.

### What Could Be Improved

- **Caching**: Same scenario data should not re-prompt AI
- **Streaming**: Long assessments should stream, not block

### Already Implemented (Bonus Feature)

- **Persona Customization**: Users can add themselves as personas via a separate mini webapp. The dashboard fetches custom personas dynamically - enabling workshop participants to see AI evaluations from their own perspective. This is brilliant for stakeholder engagement!

---

## 8. Component Architecture

### KPI Card Rendering Pipeline

```
KpiCard Component
├── Props: cardConfig, scenarioKey
│
├── Step 1: useKpiData hook
│   ├── Build key: build4DKey(analysisId, kpiId, scenarioKey, 'all')
│   ├── Fetch: state.results[key]
│   ├── Fetch: state.statistics[`${analysisId}::${kpiId}`]
│   └── Return: { value, statistics, kpiConfig, target, thresholds }
│
├── Step 2: useSeriesData hook
│   ├── Resolve series config with tokens
│   ├── Build 4D keys for each series item
│   └── Return: { seriesItems, seriesValues }
│
├── Step 3: Bounds calculation (useMemo)
│   └── Apply 5-level hierarchy
│
└── Step 4: Render
    ├── Hero value: formatKpiValue(currentValue)
    ├── Comparison bars from seriesItems
    └── Performance badge from thresholds
```

### Card Variants

| Variant | Component | Use Case |
|---------|-----------|----------|
| `kpi` | `KpiCard.tsx` | Standard KPI display with comparison bars |
| `headline` | `KpiCard.tsx` | Large hero number, minimal chrome |
| `bullet` | `KpiCardBullet.tsx` | Bullet chart with target |
| `bulletMulti` | `KpiCardBulletMulti.tsx` | Multi-series bullet |
| `bar` | `KpiCardBar.tsx` | Horizontal bar chart |
| `pie` | `KpiCardPie.tsx` | Pie/donut visualization |
| `spider` | `KpiCardSpider.tsx` | Radar chart for multi-KPI |
| `media` | `MediaCard.tsx` | Image/thumbnail display |

### Focus Panel Integration

```typescript
// Focus Panel modes
type FocusPanelMode = 'topic' | 'scorecard' | 'ai';

// AI Personas integration
- PersonasSelector: Choose AI perspective (investor, planner, resident)
- PersonaCard: Display persona assessment
- SWOTModal: Detailed SWOT analysis per scenario
- ProjectContextBuilder: Assembles markdown context for AI
```

---

## 7. What Worked Well (Reuse)

### 1. 4D Key System
**Pattern:** Composite string key for multi-dimensional data
**Benefits:** O(1) lookups, simple serialization, wildcard filtering
**Reuse:** Any multi-dimensional metric storage (scenario × analysis × region)

### 2. Token Resolution System
**Pattern:** Contextual placeholders resolved at runtime
**Benefits:** Single config for multiple contexts, automatic updates
**Reuse:** Any scenario comparison UI

### 3. Series-First Comparison
**Pattern:** Define comparisons as data, not code
**Benefits:** Config-driven, flexible, type-safe
**Reuse:** Any chart needing dynamic comparison data

### 4. queueMicrotask for Statistics
**Pattern:** Defer heavy calculations without blocking
**Benefits:** Responsive UI during high-frequency updates
**Reuse:** Any derived state calculation

### 5. CSS Variable Theming
**Pattern:** Full theme via CSS variables + Zustand toggle
**Benefits:** Zero-JS theme switching, consistent design tokens
**Reuse:** Any themed dashboard

### 6. Config Hierarchy with Cascade
**Pattern:** Card → KPI → Analysis → Fallback
**Benefits:** Override at any level, sensible defaults
**Reuse:** Any config-driven system

---

## 8. Pain Points & Lessons

### 1. Template Engine Normalization
**Issue:** Manual regex conversion of JS syntax to mathjs
```typescript
// === → ==, && → and, || → or, ! → not
```
**Lesson:** Use a JS-compatible expression parser if possible to avoid translation layers.

### 2. Zustand Selector Boilerplate
**Issue:** Must use individual selectors to avoid re-renders
**Lesson:** Consider selector utilities or Zustand's `shallow` comparison wrapper.

### 3. Series Resolver Complexity
**Issue:** Very powerful but complex for simple use cases
**Lesson:** Provide simplified helpers for common patterns (main vs. target).

### 4. WebSocket Loop Prevention
**Issue:** Bidirectional sync creates potential for infinite loops
**Lesson:** Always implement suppression flags for state changes from external sources.

### 5. Dynamic Import for Ingestion
**Issue:** WebSocket handler uses dynamic import to avoid circular deps
**Lesson:** Structure modules to avoid cross-import between store and utils.

---

## 9. Reusable Patterns Summary

| Pattern | Source File | Reusability |
|---------|-------------|-------------|
| 4D Key Builder | `utils/kpi/keyBuilder.ts` | High - any multi-dim storage |
| Token Resolver | `utils/kpi/tokenResolver.ts` | High - scenario comparison |
| Series Resolver | `utils/kpi/seriesResolver.ts` | Medium - comparison charts |
| Template Processor | `utils/templates/processor.ts` | Medium - dynamic text |
| Bounds Calculator | `utils/kpi/boundsCalculation.ts` | High - any chart scaling |
| Statistics Slice | `store/slices/kpiSlice.ts` | High - aggregation pattern |
| Format Value | `utils/formatting/formatValue.ts` | High - number display |

---

## 10. Critical Assessment (Honest Feedback)

*Note: This assessment was validated against Gemini analysis of the full codebase. Corrections noted where original analysis was wrong.*

### EXCELLENT - Reuse Immediately

#### 1. Topic Lens → Column Architecture ✅ CONFIRMED
The "configure ONCE, display MANY" pattern is **brilliant**:
```typescript
// App.tsx:346-349 - The entire column rendering
{scorecardIds.map((id) => (
  <Scorecard key={id} scorecardId={id} scenarioKey={scenarioId} />
))}
```
- Topic Lens defines scorecards ONCE
- Same config renders in every scenario column
- `$this` token resolves to column's scenarioKey
- Clean separation: config defines WHAT, columns define WHERE
- **Strongest architectural decision in the app** - decouples config from data density

#### 2. AI Personas UX Concept ✅ CONFIRMED (with caveat)
This is a **killer feature idea** worth extracting:
- Multiple AI personas (experts + citizens) evaluate scenarios from different perspectives
- `PersonaCard` shows one-liner OR compact sentiment bar toggle
- `ScenarioSentimentBar` - Visual sentiment scale positioning scenarios
- Expandable cards with per-scenario detailed opinions
- SWOT generation aggregates across personas
- Progress tracking during assessment batch runs

**⚠️ CACHE BUG IDENTIFIED:** Assessments are keyed by `topicLens::scenario::persona` but **missing filter ID**. If user runs assessment with "District A" filter active, then clears filter, the cached District A results show for Global view.

**Key Files:**
- `src/components/FocusPanel/personas/PersonasSelector.tsx`
- `src/components/FocusPanel/personas/PersonaCard.tsx`
- `src/components/FocusPanel/personas/ScenarioSentimentBar.tsx`
- `src/hooks/ai/usePersonaAssessment.ts`

#### 3. Focus Panel Animation ✅ CONFIRMED
Smooth UX when panel opens:
```typescript
// App.tsx:276-279 - Column scaling
transform: focusPanelOpen ? 'translateX(-16px) scale(0.88)' : 'scale(1)',
transition: 'transform 720ms cubic-bezier(0.4, 0, 0.2, 1)',
```
- No jarring layout shifts
- Columns scale down, panel slides in
- Visual "focus channeling" effect via `FocusPanelOverlay`

---

### PROBLEMATIC - Be Careful

#### 1. Spider Chart - Structurally Necessary but Duplicates Logic ⚠️ CORRECTED

**Original claim:** Spider charts reinvent data fetching.
**Correction:** 80% correct. The separate `useMultiAxisKpiData` hook is **structurally necessary**:
- `useSeriesData` resolves **1 KPI** across **N scenarios** (1D)
- Spider charts resolve **N KPIs** across **M scenarios** (2D)

**However, the critique stands:** Spider charts DO duplicate token resolution logic (resolving `$best`, `$active` to scenario keys) that already exists in `resolveSeriesComparisons`. The hook should delegate to shared utilities.

#### 2. KPI Card Variants ❌ CORRECTED - Actually Consistent!

**Original claim:** Each variant has different data hooks.
**Correction:** WRONG. The system is actually quite consistent:

| Variant | Data Hook | Notes |
|---------|-----------|-------|
| `KpiCard` | `useKpiData` + `useSeriesData` | Standard |
| `KpiCardBar` | `useKpiData` + `useSeriesData` | Standard |
| `KpiCardBulletMulti` | `useKpiData` + `useSeriesData` | Standard |
| `KpiCardSpider` | `useMultiAxisKpiData` | Different but necessary (2D data) |
| `KpiCardPie` | `useSegmentValues` | Different - visualizes breakdown of different KPIs |

The Pie and Spider exceptions are valid domain distinctions, not architectural flaws.

#### 3. Focus Panel Content Router - Messy if-Chain ✅ CONFIRMED

```typescript
// FocusPanel.tsx - Giant conditional chain
const FocusPanelContent = ({ mode }) => {
  if (mode === 'topic' && activeScenario) { /* render topic */ }
  if (mode === 'scorecard' && activeScorecardId) { /* render scorecard */ }
  if (mode === 'ai' && cards.length > 0) { /* render AI */ }
  if (mode === 'personas') { /* lazy load PersonasSelector */ }
  return <EmptyState />;
}
```

**Issues:**
- Violates Single Responsibility Principle
- Mixes data fetching with presentation for 3 distinct features
- Should extract into separate components: `TopicView`, `ScorecardView`, `AiView`

#### 4. App.tsx - Too Much in One File (400 lines) ✅ CONFIRMED

**View layer managing Transport layer** - architectural flaw:
- Lines 105-189: ~85 lines of WebSocket/Sync logic
- Lines 55-98: Data loading fallback logic
- Lines 267-330: Complex layout calculations

**Should extract:**
- `useGrasshopperSync()` hook - move ALL WebSocket/state sync logic
- `<ScenarioColumn>` component
- `<DashboardHeader>` component

---

### PERFORMANCE Issues (Previously Missed)

#### 4D Key System - O(N) Aggregation Cost ⚠️ NEW

**Original assessment:** "Excellent" for storage
**Correction:** Good for storage, **bad for aggregation**

```typescript
// kpiSlice.ts → calculateStatistics
// filterKeysByPattern iterates Object.keys(state.results)
const matchingKeys = filterKeysByPattern(allKeys, { analysisId, kpiId, ... });
```

**Problem:** With 10,000 KPI data points, calculating stats for ONE KPI requires scanning 10,000 strings. This runs M times (once per affected KPI).

**Missing:** An index structure like `Record<'analysis::kpi', FourDKey[]>` to avoid full scans.

#### Token System - Mixed Return Types Gotcha ⚠️ NEW

Tokens have mixed return types that create cognitive load:
- `$best` → Scenario ID (string): `"option_a"`
- `$average` → Value (number): `24.5`

In templates: `{{kpi:...:$best...}}` gives the KPI value for best scenario, but `{{$average}}` gives the number directly. Users must remember which tokens resolve to IDs vs values.

---

### MISSING Features (Corrected)

#### 1. Config Validation ❌ CORRECTED - EXISTS!
`src/utils/templates/validator.ts` exists and is quite robust (checks braces, dangerous expressions). May not be used aggressively at config load time, but implementation exists.

#### 2. No Error Boundaries ✅ CONFIRMED
No React Error Boundaries (`componentDidCatch`). If a KPI card throws (e.g., mathjs eval error), the entire Dashboard white-screens.

#### 3. Template Normalization - HIGH RISK ⚠️ UNDERSTATED

The mathjs normalization is more dangerous than originally assessed:
```typescript
// processor.ts
expr = expr.replace(/&&/g, ' and ')
expr = expr.replace(/!(?!=)/g, ' not ')  // !!true becomes "not !true" (mixed syntax)
```

**Edge cases:**
- `!!true` (double bang) → `not !true` (mixed syntax, breaks)
- String properties with `&` character could cause issues
- Heavy reliance on mathjs behaving like Python

---

### Comparison Summary (Validated)

| Aspect | Verdict | Notes |
|--------|---------|-------|
| 4D Key System | **Good** | Fast storage, but O(N) aggregation cost |
| Token System | **Good** | Powerful, but mixed return types confuse |
| Topic Lens → Columns | **Excellent** ✅ | Strongest pattern in codebase |
| Personas UX | **Excellent** ✅ | But has cache invalidation bug (filter ID) |
| CSS Theming | **Excellent** ✅ | Zero-JS overhead |
| Statistics auto-calc | **Good** | Works but performance scales poorly |
| Spider/Multi-axis charts | **Acceptable** | Different hook is necessary for 2D data |
| KPI card variants | **Consistent** ❌ | I was WRONG - actually well-designed |
| Focus Panel content | **Messy** ✅ | if-chain confirmed as code smell |
| App.tsx organization | **Too coupled** ✅ | View managing Transport layer |
| Config validation | **EXISTS** ❌ | `validator.ts` is robust, I missed it |
| Error boundaries | **Missing** ✅ | Cards crash on bad data |
| Template normalization | **High Risk** ⚠️ | Understated - edge cases can break |

### Comparison to Other Projects

| Feature | AIT Dashboard | prec-geo-showcase | LAND-Dashboard |
|---------|---------------|-------------------|----------------|
| Focus | KPI comparison | Spatial analysis | 3D + KPIs |
| Data source | Grasshopper sync | Static JSON | Speckle API |
| Token system | Extended (8 tokens) | Basic | 4D similar |
| Scenario handling | First-class | Via variants | Inline |
| Real-time sync | Yes (bidirectional) | No | No |
| AI Integration | Personas (excellent) | Spatial Q&A | None |
| Chart consistency | Mixed | Consistent | Consistent |
| Config validation | None | Zod schemas | Partial |

---

## 12. File Reference

### Core Architecture
| Purpose | Path |
|---------|------|
| Store composition | `src/store/store.ts` |
| KPI slice (statistics) | `src/store/slices/kpiSlice.ts` |
| 4D key utilities | `src/utils/kpi/keyBuilder.ts` |
| Token resolution | `src/utils/kpi/tokenResolver.ts` |
| Series resolution | `src/utils/kpi/seriesResolver.ts` |
| Data ingestion | `src/utils/projects/projectLoader.ts` |
| Template engine | `src/utils/templates/processor.ts` |
| Bounds calculation | `src/utils/kpi/boundsCalculation.ts` |

### Components
| Purpose | Path |
|---------|------|
| Main app layout | `src/App.tsx` |
| KPI card | `src/components/cards/kpi/KpiCard.tsx` |
| Scorecard container | `src/components/cards/scorecard/Scorecard.tsx` |
| Focus panel | `src/components/FocusPanel/FocusPanel.tsx` |
| Topic lens selector | `src/components/shared/TopicLensSelector.tsx` |

### Hooks
| Purpose | Path |
|---------|------|
| KPI data fetching | `src/hooks/kpi/useKpiData.ts` |
| Series resolution | `src/hooks/kpi/useSeriesData.ts` |
| Multi-axis (spider) | `src/hooks/kpi/useMultiAxisKpiData.ts` |
| Template processing | `src/hooks/templates/useTemplateProcessor.ts` |

### Types
| Purpose | Path |
|---------|------|
| Store types | `src/types/store.ts` |
| KPI types | `src/types/kpi.ts` |
| Config types | `src/types/config.ts` |

### Documentation
| Purpose | Path |
|---------|------|
| Core vision | `ait-docs/AIT_CORE.md` |
| Data structures | `ait-docs/AIT_DATA_STRUCTURES_CORE.md` |
| Config schemas | `ait-docs/AIT_DATA_STRUCTURES_CONFIG.md` |
| Implementation guide | `ait-docs/AIT_IMPLEMENTATION_GUIDE.md` |
| KPI cards feature | `feature_docs/feature_ait_kpi_cards.md` |
| State management | `feature_docs/feature_ait_state_management.md` |
| Template engine | `feature_docs/feature_ait_template_engine.md` |

# Reference Documents

Source architecture documentation from production applications.

---

## Consolidated Documents

### CONSOLIDATED_PLATFORM_RECOMMENDATIONS.md

**Source:** 5 production urban analytics apps (~100k lines total)

Modular architecture with:
- 12 modules across 4 tiers
- Type contracts for each module
- Anti-patterns to avoid
- Module composition examples

### ARCHITECTURE_CRITICAL_FEEDBACK.md

**Source:** 3-agent stress test + audio review (2026-01-16)

Critical gaps identified:
- No Time-Series module
- Streaming data model missing
- Orchestrator underspecified
- Selection system too simple
- AI predictability issues

Includes recommended solutions and implementation sequence.

---

## Source Analyses (per-app)

Located in `source-analyses/`:

| File | App | Key Patterns |
|------|-----|--------------|
| `ARCHITECTURE_ANALYSIS_AIT_Dashboard.md` | AIT Dashboard | 4D KPI keys, topic lens, token system |
| `ARCHITECTURE_ANALYSIS_bokehDashboard.md` | Bokeh Dashboard | 11-slice Zustand, 5-tier selection, multi-source ingest |
| `ARCHITECTURE_ANALYSIS_ISOCARP.md` | ISOCARP Workshop | Grid-based spatial index, asset placement |
| `ARCHITECTURE_ANALYSIS_LAND_Dashboard.md` | LAND Dashboard | Field resolution, scenario persistence |
| `ARCHITECTURE_ANALYSIS.md` | prec-geo-showcase | Spatial Q&A, story mode, deck.gl patterns |

These are the raw analyses that were synthesized into CONSOLIDATED.

---

## How to Use

These docs are **reference material**, not prescriptive.

When building a module:
1. Read the contract in CONSOLIDATED
2. Check for known gaps in CRITICAL_FEEDBACK
3. Look at source analyses for implementation details
4. Adapt for run8n stack (Windmill/Soketi/GoTrue)
5. Document the pattern in `../patterns/` or `../recipes/`

## Origin

Extracted from: `/Users/Joo/01_Projects/prec-geo-showcase/`

# Checklists

**Status:** Placeholder - Checklists to be documented

---

## What Goes Here

Quality control checklists for AI generation, module implementation, and testing.

---

## Planned Checklists

### AI Generation

- [ ] `ai-generation-rules.md` - File size limits, extraction rules, strict typing

### Module Implementation

- [ ] `module-checklist.md` - Per-module validation steps
- [ ] `integration-testing.md` - Cross-module validation

### Performance

- [ ] `performance-budget.md` - Concrete targets (render <16ms, query <2ms)

### Deployment

- [ ] `run8n-deployment.md` - Deploy to run8n stack checklist

---

## Draft: AI Generation Rules

Before completing code generation:

- [ ] File under 200 lines? If not, extract sub-module NOW
- [ ] Hook under 300 lines? If not, split by concern NOW
- [ ] No new `any` types introduced?
- [ ] Coordinate transforms use CoordinateSystem module (not inline math)?
- [ ] Asset paths use AssetManager (not hardcoded strings)?
- [ ] Token resolution uses structured TokenResult type?
- [ ] Zustand selectors use individual values (not object destructuring)?
- [ ] Collections use `useShallow` for comparison?

---

## Draft: Performance Budget

| Operation | Budget | Measurement Point |
|-----------|--------|-------------------|
| Grid render (500k cells) | <16ms | `requestAnimationFrame` callback |
| KPI calculation (single) | <5ms | Calculator function |
| KPI batch (all scenarios) | <50ms | Full comparison modal |
| Spatial query (radius) | <2ms | `spatialIndex.query()` |
| Selection change → UI | <100ms | User-perceived latency |
| Initial data load | <3s | First meaningful paint |
| Scenario switch | <200ms | Grid + KPI + render |

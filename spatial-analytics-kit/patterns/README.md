# Patterns

**Status:** Placeholder - Patterns to be documented

---

## What Goes Here

Framework-agnostic logic patterns. Pure TypeScript, no React dependencies.

These are the HOW - implementation details that can be copy-adapted.

---

## Planned Patterns

### State Management

- [ ] `zustand-slice-pattern.md` - Max 200 lines, individual selectors
- [ ] `selection-source-tracking.md` - Echo prevention for multi-view sync
- [ ] `use-shallow-mandate.md` - Prevent infinite re-renders

### Data Structures

- [ ] `typed-array-grid.md` - SoA pattern for 500k+ cells
- [ ] `spatial-hashing.md` - Grid-based spatial index
- [ ] `entity-normalization.md` - UUID assignment, schema validation

### KPI System

- [ ] `kpi-registry.md` - Type-safe definitions with calculators
- [ ] `nd-keys.md` - N-dimensional key system
- [ ] `token-resolution.md` - `$this`, `$best`, `$average` tokens

### Performance

- [ ] `charts-are-views.md` - Pre-compute, never compute in render
- [ ] `cache-invalidation.md` - TTL and selection-based invalidation
- [ ] `worker-offload.md` - When to use Web Workers

### Error Handling

- [ ] `error-isolation.md` - Module errors don't cascade
- [ ] `graceful-degradation.md` - KPI with failed Grid returns null

---

## Pattern Template

Each pattern file should include:

```markdown
# Pattern Name

## Problem
What problem does this solve?

## Solution
The pattern in plain language.

## Contract
```typescript
interface PatternContract {
  // Types and signatures
}
```

## Implementation
```typescript
// Reference implementation
```

## Anti-Patterns
What NOT to do.

## References
Links to source docs.
```

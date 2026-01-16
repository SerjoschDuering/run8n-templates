# Recipes

**Status:** Placeholder - Recipes to be documented

---

## What Goes Here

run8n-specific implementations. React hooks, Windmill integrations, Soketi patterns.

These connect the abstract patterns to the actual run8n stack.

---

## Planned Recipes

### Authentication (GoTrue)

- [ ] `auth-slice.md` - Zustand slice for GoTrue session management
- [ ] `auth-guard.md` - Protected routes and token refresh
- [ ] `jwt-windmill.md` - Passing auth tokens to Windmill scripts

### Data Loading (Windmill + PostGIS)

- [ ] `windmill-client.md` - Standardized fetch wrapper for Windmill
- [ ] `postgis-bbox.md` - Viewport-based queries (load only visible data)
- [ ] `data-ingest-windmill.md` - Adapting Data Ingest for Windmill outputs

### Real-Time (Soketi)

- [ ] `soketi-stream.md` - Generic React hook for channel subscriptions
- [ ] `delta-updates.md` - EntityDelta → Zustand store patching
- [ ] `presence-channel.md` - Who's online in a project

### Persistence

- [ ] `scenario-save-load.md` - Save variants to PostgreSQL via Windmill
- [ ] `indexeddb-cache.md` - Large binary data (TypedArrays) local storage

### Orchestration

- [ ] `bootstrap-sequence.md` - Login → Config → Socket → Data flow
- [ ] `module-manifest.md` - Dependency resolution for async init

---

## Recipe Template

Each recipe file should include:

```markdown
# Recipe Name

## Use Case
When to use this recipe.

## Prerequisites
- Required modules/patterns
- run8n services needed

## Implementation

### Step 1: [Description]
```typescript
// Code
```

### Step 2: [Description]
```typescript
// Code
```

## Usage Example
```typescript
// How to use in a component/store
```

## Gotchas
Common mistakes and how to avoid them.

## Related
- Related patterns
- Related recipes
```

# Vue → React + Zustand Conversion Summary

**Date:** 2026-01-15
**Status:** Template outline - not fully tested

## What Changed

### Removed (Vue)
- Vue 3
- Vue Router
- @vitejs/plugin-vue

### Added (React)
- React 18
- React DOM
- Zustand (state management)
- Tailwind CSS
- @vitejs/plugin-react
- All necessary TypeScript types

## New File Structure

```
src/
├── lib/
│   ├── auth.ts              → GoTrue client (unchanged)
│   └── api.ts               → Windmill API wrapper (unchanged)
├── store/
│   ├── index.ts             → Zustand store composition
│   └── slices/
│       ├── authSlice.ts     → Auth state (user, tokens, login/logout)
│       └── uiSlice.ts       → UI state (modals, loading, etc.)
├── components/
│   ├── LoginForm.tsx        → Email/password auth form
│   └── Dashboard.tsx        → Main authenticated view
├── App.tsx                  → Main app component
├── main.tsx                 → React entry point
└── index.css                → Tailwind imports

windmill/
└── f/myapp/
    └── example/
        └── get_data.ts      → Example Windmill script

Root configs:
├── vite.config.ts           → React plugin + path aliases
├── tsconfig.json            → TypeScript config with paths
├── tsconfig.node.json       → Node TypeScript config
├── tailwind.config.js       → Tailwind configuration
├── postcss.config.js        → PostCSS for Tailwind
└── index.html               → HTML entry point
```

## Key Patterns

### 1. Zustand Store (Slice Pattern)

```typescript
// src/store/index.ts
import { create } from 'zustand'
import { authSlice } from './slices/authSlice'
import { uiSlice } from './slices/uiSlice'

export const useStore = create((set, get) => ({
  ...authSlice(set, get),
  ...uiSlice(set, get),
}))
```

### 2. Auth Integration

```typescript
// In components
const { user, login, logout, checkAuth } = useStore()

// Check auth on mount
useEffect(() => {
  checkAuth()
}, [checkAuth])
```

### 3. Windmill API Calls

```typescript
import { callWindmill } from '@/lib/api'

// Direct call
const data = await callWindmill('myapp/example/get_data', {})

// Or in Zustand action
fetchData: async () => {
  set({ loading: true })
  const data = await callWindmill('myapp/example/get_data', {})
  set({ data, loading: false })
}
```

## What's Preserved

All core infrastructure remains unchanged:

- **Auth:** GoTrue integration (`src/lib/auth.ts`)
- **API:** Windmill wrapper (`src/lib/api.ts`)
- **Database:** Prisma + PostgreSQL (`prisma/schema.prisma`)
- **Scripts:** Windmill scripts (`windmill/`)
- **Deploy:** Deployment workflow (`scripts/deploy.sh`)
- **Env:** Environment variables (`.env.example`)

## Components Included

### LoginForm.tsx
- Email/password authentication
- Sign up / Sign in toggle
- Error handling
- Integrated with Zustand auth state
- Tailwind styled

### Dashboard.tsx
- Welcome message with user email
- Logout button
- Quick start guide
- Example API call button
- Demonstrates `callWindmill` usage

## Next Steps for Developers

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database password
   ```

3. **Generate Prisma client:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

5. **Create Windmill scripts:**
   - Add scripts to `windmill/f/myapp/`
   - Follow pattern in `example/get_data.ts`
   - Push to Windmill: `npm run wmill:push`

6. **Add Zustand slices:**
   - Create new slices in `src/store/slices/`
   - Import in `src/store/index.ts`
   - Use in components with `useStore()`

7. **Deploy:**
   ```bash
   npm run deploy
   ```

## Testing Status

⚠️ **This is a template outline, not a fully tested implementation.**

Before using in production:
- [ ] Test auth flow (signup, login, logout)
- [ ] Test Windmill API calls
- [ ] Test database operations via Prisma
- [ ] Verify deployment script
- [ ] Test Tailwind styling
- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Add proper TypeScript types throughout

## Documentation

All documentation updated:
- ✅ `CLAUDE.md` - Full development guide
- ✅ `README.md` - Quick start
- ✅ `package.json` - Dependencies
- ✅ Status warnings added

## Migration Notes

If migrating an existing Vue project:

1. Keep all Windmill scripts (they're framework-agnostic)
2. Keep Prisma schema (database is unchanged)
3. Keep `.env` and deployment scripts
4. Rewrite Vue components as React components
5. Replace Vue's `ref`/`reactive` with Zustand stores
6. Replace Vue Router with React Router (if needed)
7. Auth and API integrations work unchanged

## Dependencies

```json
{
  "dependencies": {
    "@supabase/gotrue-js": "^2.63.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@prisma/client": "^5.8.0",
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.47",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "prisma": "^5.8.0",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

## Known Limitations

- No routing (add React Router if needed)
- Basic error handling (add error boundaries)
- Minimal TypeScript types (strengthen as needed)
- No form validation library (add React Hook Form + Zod if needed)
- No loading skeletons (add as needed)
- No toast notifications (add a library if needed)

## Resources

- [React Docs](https://react.dev)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Docs](https://vitejs.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [GoTrue Docs](https://github.com/supabase/gotrue-js)
- [Windmill Docs](https://www.windmill.dev/docs)

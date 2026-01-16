# run8n-fullstack Project

**Status: Template outline - not fully tested**

Fullstack app template for the run8n self-hosted stack.

## Claude Code Skills

Invoke these skills when working on this project:

```
skill: "run8n-stack"           # Infrastructure, Windmill API, deployment
skill: "react-best-practices"  # React/Zustand performance, data fetching
skill: "web-design-guidelines" # Accessibility, forms, UI polish
```

**Key patterns from skills:**
- Use Zustand selectors (`useStore(s => s.count)`) to prevent re-renders
- Use `shallow` for object selections
- Sync form state to store on blur, not every keystroke
- Honor `prefers-reduced-motion` for animations
- Use semantic HTML (`<button>`, `<a>`) not `<div onClick>`
- Form inputs need labels and proper `type`/`autocomplete`

## Architecture

- **Frontend:** Vite + React 18 + TypeScript + Zustand + Tailwind CSS
- **Auth:** GoTrue at `auth.run8n.xyz`
- **Backend:** Windmill scripts (NOT a Node.js server)
- **Database:** PostgreSQL + PostGIS via Prisma

## Key Constraint

**Frontend runs in browser → NO direct database access.**

All database operations go through Windmill scripts.

## Quick Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Deploy | `npm run deploy` |
| Push DB schema | `npm run db:push` |
| Create migration | `npm run db:migrate` |
| Push Windmill scripts | `npm run wmill:push` |

## File Structure

```
src/
├── lib/
│   ├── auth.ts          → GoTrue client (login, signup, tokens)
│   └── api.ts           → Windmill API wrapper (callWindmill function)
├── store/
│   ├── index.ts         → Zustand store composition
│   └── slices/
│       ├── authSlice.ts → Auth state (user, tokens)
│       └── uiSlice.ts   → UI state (modals, loading)
├── components/          → React components
├── App.tsx              → Main app component
└── main.tsx             → React entry point

prisma/schema.prisma     → Database schema (source of truth)
windmill/f/myapp/        → Backend scripts (your API endpoints)
```

## API Pattern

Frontend calls Windmill scripts as API endpoints:

```typescript
import { callWindmill } from '@/lib/api'

// Call a Windmill script in a component
const user = await callWindmill('myapp/users/get_user', {
  userId: '123'
})

// Or use in Zustand store actions
const fetchUser = async (userId: string) => {
  const user = await callWindmill('myapp/users/get_user', { userId })
  set({ user })
}
```

## State Management

Zustand store pattern with slices:

```typescript
// src/store/index.ts
import { create } from 'zustand'
import { authSlice } from './slices/authSlice'
import { uiSlice } from './slices/uiSlice'

export const useStore = create((set, get) => ({
  ...authSlice(set, get),
  ...uiSlice(set, get),
}))

// Use in components
const { user, login, logout } = useStore()
```

## Database Workflow

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)
3. Use Prisma client in Windmill scripts

## Windmill Scripts

Location: `windmill/f/myapp/`

Each script is an API endpoint. Example:

```typescript
// windmill/f/myapp/users/get_user.ts
import { PrismaClient } from '@prisma/client'
import * as wmill from 'windmill-client'

export async function main(userId: string) {
    const dbUrl = await wmill.getVariable('f/myapp/database_url')
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    await prisma.$disconnect()
    return user
}
```

Call it: `POST https://windmill.run8n.xyz/api/w/main/jobs/run_wait_result/f/myapp/users/get_user`

## Auth Flow

Use auth helpers from `src/lib/auth.ts`:

```typescript
import { auth, getCurrentUser, signOut } from '@/lib/auth'

// Sign up
await auth.signUp({ email, password })

// Sign in
await auth.signInWithPassword({ email, password })

// Get current user
const user = await getCurrentUser()

// Sign out
await signOut()
```

Or integrate with Zustand store:

```typescript
// src/store/slices/authSlice.ts
export const authSlice = (set, get) => ({
  user: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const { data, error } = await auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user, isAuthenticated: true })
  },

  logout: async () => {
    await auth.signOut()
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const user = await getCurrentUser()
    set({ user, isAuthenticated: !!user })
  },
})
```

## Deployment

```bash
npm run deploy
```

This builds frontend, rsyncs to server, and pushes Windmill scripts.

Site URL: `https://sites.run8n.xyz/SITE_NAME/`

## React + Zustand Patterns

### Component Structure

```typescript
// Simple component with Zustand
import { useStore } from '@/store'

function MyComponent() {
  const { user, someAction } = useStore()

  return <div>{user?.email}</div>
}
```

### Async Actions in Store

```typescript
// src/store/slices/dataSlice.ts
export const dataSlice = (set, get) => ({
  items: [],
  loading: false,

  fetchItems: async () => {
    set({ loading: true })
    try {
      const items = await callWindmill('myapp/items/list', {})
      set({ items, loading: false })
    } catch (error) {
      console.error(error)
      set({ loading: false })
    }
  },
})
```

### Using callWindmill

```typescript
import { callWindmill } from '@/lib/api'

// In a component
const handleSubmit = async (data) => {
  try {
    const result = await callWindmill('myapp/items/create', data)
    console.log('Created:', result)
  } catch (error) {
    console.error('Failed:', error)
  }
}

// In a Zustand action
createItem: async (data) => {
  const result = await callWindmill('myapp/items/create', data)
  set({ items: [...get().items, result] })
}
```

## Server Details

- SSH: `ssh -i ~/.ssh/id_ed25519_hetzner_2025 root@91.98.144.66`
- Database: `91.98.144.66:5432` (user: supabase_admin)
- Windmill: `windmill.run8n.xyz`
- Auth: `auth.run8n.xyz`

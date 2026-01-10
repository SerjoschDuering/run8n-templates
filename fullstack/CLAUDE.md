# run8n-fullstack Project

Fullstack app template for the run8n self-hosted stack.

## Architecture

- **Frontend:** Vite + Vue + TypeScript
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
src/lib/auth.ts     → GoTrue client (login, signup, tokens)
src/lib/api.ts      → Windmill API wrapper (callWindmill function)
prisma/schema.prisma → Database schema (source of truth)
windmill/f/myapp/   → Backend scripts (your API endpoints)
```

## API Pattern

Frontend calls Windmill scripts as API endpoints:

```typescript
import { callWindmill } from '@/lib/api'

// Call a Windmill script
const user = await callWindmill('myapp/users/get_user', {
  userId: '123'
})
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

```typescript
import { auth } from '@/lib/auth'

// Sign up
await auth.signUp({ email, password })

// Sign in
await auth.signInWithPassword({ email, password })

// Get current user
const { data } = await auth.getUser()

// Sign out
await auth.signOut()
```

## Deployment

```bash
npm run deploy
```

This builds frontend, rsyncs to server, and pushes Windmill scripts.

Site URL: `https://sites.run8n.xyz/SITE_NAME/`

## Server Details

- SSH: `ssh -i ~/.ssh/id_ed25519_hetzner_2025 root@91.98.144.66`
- Database: `91.98.144.66:5432` (user: supabase_admin)
- Windmill: `windmill.run8n.xyz`
- Auth: `auth.run8n.xyz`

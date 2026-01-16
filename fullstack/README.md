# run8n Fullstack Template

**Status: Template outline - not fully tested**

A fullstack web app template using the run8n self-hosted stack.

## Features

- Vite + React 18 + TypeScript + Zustand + Tailwind CSS frontend
- GoTrue authentication (email/password, OAuth)
- Prisma ORM with PostgreSQL + PostGIS
- Windmill serverless backend
- One-command deployment

## Quick Start

```bash
# Setup
./scripts/setup.sh

# Edit .env with your database password
nano .env

# Create database tables
npm run db:push

# Start dev server
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Stack

| Component | URL |
|-----------|-----|
| Auth | auth.run8n.xyz |
| Backend | windmill.run8n.xyz |
| Database | 91.98.144.66:5432 |
| Your Site | sites.run8n.xyz/yoursite/ |

## Documentation

See `CLAUDE.md` for detailed development instructions.

## License

MIT

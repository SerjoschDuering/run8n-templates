# run8n Templates

Project starter templates for the run8n self-hosted stack.

## Templates

### [static/](./static)
Simple HTML/CSS static sites. No build step. Deploy with rsync.

**Best for:** Landing pages, portfolios, simple sites

### [fullstack/](./fullstack)
Vite + Vue + Prisma + Windmill. Full authentication and database.

**Best for:** Web apps, dashboards, SaaS MVPs

## Usage

```bash
# Clone a template
cp -r static/ ~/my-new-site/
cd ~/my-new-site/

# For static
./scripts/deploy.sh mysite

# For fullstack
./scripts/setup.sh
npm run dev
```

## Stack Services

| Service | URL |
|---------|-----|
| n8n | run8n.xyz |
| Windmill | windmill.run8n.xyz |
| Auth | auth.run8n.xyz |
| Database | 91.98.144.66:5432 |
| Qdrant | qdrant.run8n.xyz |
| Real-time | realtime.run8n.xyz |

## Planned Templates

### realtime/
WebSocket apps with Soketi (Pusher-compatible).

**Use cases:** Multiplayer games, live cursors, chat, collaborative editing, notifications

**Stack:** Vite + pusher-js + Soketi at `realtime.run8n.xyz`

---

### ai/
RAG and vector search apps with Qdrant.

**Use cases:** Document search, AI chatbots, semantic search, embeddings

**Stack:** Vite + Qdrant + OpenAI/local embeddings + Windmill

---

### admin/
NocoDB-backed admin panels.

**Use cases:** Internal tools, CRUD dashboards, data management

**Stack:** NocoDB REST API + simple frontend, no Prisma needed

---

### mcp/
MCP (Model Context Protocol) server template.

**Use cases:** Claude Code integrations, custom AI tools, API wrappers

**Stack:** TypeScript + MCP SDK, based on siyuan-mcp-server

---

### container/
Full backend apps with Docker deployment.

**Use cases:** When you need < 50ms latency, complex backends, Python/FastAPI

**Stack:** FastAPI or Express + Docker + CI/CD to server

---

### saas/
SaaS starter with Stripe billing.

**Use cases:** Subscription apps, paid tools, freemium products

**Stack:** fullstack + Stripe + subscription management

---

## Contributing

To add a template:
1. Create folder with template name
2. Include `CLAUDE.md` (AI instructions) and `README.md` (human docs)
3. Add deploy script in `scripts/`

## License

MIT

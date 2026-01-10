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

## More Templates (Coming)

- `run8n-realtime` - WebSocket apps with Soketi
- `run8n-ai` - RAG/vector search with Qdrant
- `run8n-mcp` - MCP server template

## License

MIT

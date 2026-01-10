# Static Site Template

This is a simple static site deployed to the run8n stack.

## Project Type
- Plain HTML/CSS/JS
- No build step required
- Deployed via rsync

## Deployment

```bash
# Deploy to server (replace SITENAME with your folder name)
./scripts/deploy.sh SITENAME
```

Your site will be available at: `https://sites.run8n.xyz/SITENAME/`

## File Structure

```
├── index.html      # Main page
├── styles.css      # Styles
├── scripts/        # JS files (optional)
└── assets/         # Images, fonts, etc.
```

## Adding Backend Features

If you need:
- **Form submissions** → Create a Windmill script, POST to `windmill.run8n.xyz/api/w/...`
- **Authentication** → Use GoTrue client, connect to `auth.run8n.xyz`
- **Database** → Never direct from frontend. Use Windmill scripts as API.

## Server Details

- SSH: `ssh -i ~/.ssh/id_ed25519_hetzner_2025 root@91.98.144.66`
- Static files location: `/opt/run8n_data/static_sites/`
- Served by Caddy at `sites.run8n.xyz`

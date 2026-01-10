#!/bin/bash
set -e

# Load env
source .env 2>/dev/null || true

SITE_NAME=${SITE_NAME:-myapp}
SERVER="root@91.98.144.66"
SSH_KEY="$HOME/.ssh/id_ed25519_hetzner_2025"

echo "Building frontend..."
npm run build

echo "Deploying to $SITE_NAME..."
rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    ./dist/ \
    "$SERVER:/opt/run8n_data/static_sites/$SITE_NAME/"

echo "Pushing Windmill scripts..."
npm run wmill:push

echo ""
echo "Done! Site live at: https://sites.run8n.xyz/$SITE_NAME/"

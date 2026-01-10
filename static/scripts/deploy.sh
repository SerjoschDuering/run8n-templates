#!/bin/bash
# Deploy static site to run8n server

SITENAME=${1:-mysite}
SERVER="root@91.98.144.66"
SSH_KEY="$HOME/.ssh/id_ed25519_hetzner_2025"
REMOTE_PATH="/opt/run8n_data/static_sites/$SITENAME"

echo "Deploying to $SITENAME..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Deploy (exclude scripts folder and hidden files)
rsync -avz --delete \
    --exclude 'scripts/' \
    --exclude '.*' \
    --exclude 'README.md' \
    --exclude 'CLAUDE.md' \
    -e "ssh -i $SSH_KEY" \
    "$PROJECT_DIR/" \
    "$SERVER:$REMOTE_PATH/"

echo ""
echo "Done! Your site is live at:"
echo "https://sites.run8n.xyz/$SITENAME/"

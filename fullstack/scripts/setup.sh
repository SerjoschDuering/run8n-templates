#!/bin/bash
set -e

echo "Setting up run8n-fullstack project..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Copy env file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env - EDIT THIS FILE with your values!"
fi

# Generate Prisma client
echo "Generating Prisma client..."
npm run db:generate

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your database password"
echo "2. Run: npm run db:push (create tables)"
echo "3. Run: npm run dev (start dev server)"

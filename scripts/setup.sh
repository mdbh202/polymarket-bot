#!/usr/bin/env bash
set -euo pipefail

# Polymarket Bot -- Setup
echo "========================================"
echo "    Polymarket Bot -- Setup             "
echo "========================================"

# 1. Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18 or higher is required. Current: $NODE_VERSION"
    exit 1
fi
echo "✓ Node.js $NODE_VERSION detected."

# 2. Check Gemini CLI
if ! command -v gemini &> /dev/null; then
    echo "Error: Gemini CLI is not installed."
    echo "Install it with: npm install -g @google/gemini-cli"
    exit 1
fi
echo "✓ Gemini CLI detected."

# 3. Install MCP dependencies
echo "Installing MCP dependencies..."
cd mcp
npm install
cd ..
echo "✓ MCP dependencies installed."

# 4. Handle .env
if [ -f .env ]; then
    echo "Skipping .env (already exists)."
else
    cp .env.example .env
    echo "✓ .env created from .env.example."
    echo "ACTION REQUIRED: Open .env and fill in GOOGLE_API_KEY and PORTFOLIO_SIZE_USDC."
fi

# 5. Create output directory
mkdir -p output
echo "✓ Output directory created."

# 6. Make scripts executable
chmod +x scripts/*.sh
echo "✓ Scripts made executable."

# 7. Verify MCP servers (brief check)
echo "Verifying MCP servers..."
if ! timeout 3 node mcp/polymarket-server.js 2>&1 | head -n 3 | grep -q "polymarket"; then
    echo "Warning: Polymarket MCP server check failed or timed out."
fi

# 8. Confirm Gemini version
GEMINI_VER=$(gemini --version)
echo "✓ Gemini CLI version: $GEMINI_VER"

echo "========================================"
echo "Setup Complete!"
echo "Next steps:"
echo "1. source .env"
echo "2. gemini (to enter interactive mode)"
echo "3. bash scripts/scan.sh (to run an automated scan)"
echo "========================================"

#!/usr/bin/env bash
# Storacha space provisioning for Agent Governance Sandbox
# Run this in your terminal (needs interactive prompts for billing auth)
#
# Usage: bash scripts/setup-storacha.sh

set -e

echo "=== Storacha Space Setup ==="
echo ""

# 1. Check CLI
if ! command -v storacha &> /dev/null; then
  echo "Installing @storacha/cli..."
  npm install -g @storacha/cli
fi

# 2. Check login
DID=$(storacha whoami 2>/dev/null || true)
if [ -z "$DID" ]; then
  echo "Not logged in. Running storacha login..."
  storacha login
  DID=$(storacha whoami)
fi
echo "Logged in as: $DID"

# 3. Create space (interactive — billing auth required)
echo ""
echo "Creating space (you'll be prompted for billing authorization)..."
storacha space create ags-camargue-2026 --no-recovery

# 4. Generate delegation proof
echo ""
echo "Generating delegation proof..."
PROOF=$(storacha delegation create "$DID" --base64 --can 'space/blob/add' --can 'upload/add')

# 5. Write .env
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  # Append or replace
  if grep -q "VITE_STORACHA_PROOF" "$ENV_FILE"; then
    sed -i '' "s|^VITE_STORACHA_PROOF=.*|VITE_STORACHA_PROOF=$PROOF|" "$ENV_FILE"
  else
    echo "VITE_STORACHA_PROOF=$PROOF" >> "$ENV_FILE"
  fi
else
  echo "VITE_STORACHA_PROOF=$PROOF" > "$ENV_FILE"
fi

echo ""
echo "=== Done ==="
echo "Proof written to .env"
echo "Restart dev server: npm run dev"
echo "CID badges will now link to https://{cid}.ipfs.storacha.link"

#!/bin/bash
# Builds and runs the fixture tests for every template (or the ones named as arguments).
# Needs Node 20+ and network for npm. No Shopify login required.
set -euo pipefail
cd "$(dirname "$0")/.."

# Minimal app config so the Shopify CLI can find each function; git-ignored.
cat > shopify.app.toml <<'EOF'
client_id = "00000000000000000000000000000000"
name = "shopify-functions-ci"
application_url = "https://example.com"
embedded = true
extension_directories = ["templates/*"]

[access_scopes]
scopes = ""

[auth]
redirect_urls = ["https://example.com/auth/callback"]

[webhooks]
api_version = "2026-07"
EOF

dirs=("$@")
[ ${#dirs[@]} -eq 0 ] && dirs=(templates/*/)
for dir in "${dirs[@]}"; do
  echo "== $dir"
  (cd "$dir" && npm install --no-audit --no-fund --silent && npx vitest run)
done

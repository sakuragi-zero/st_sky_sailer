#!/usr/bin/env bash
# Optional browser checks; run only inside the Dev Container.
set -euo pipefail
if [[ ! -f /.dockerenv ]]; then
  echo "Run this script inside the Dev Container." >&2
  exit 1
fi
# Yarn is unused; its stale repository key prevents Debian package updates.
if [[ -f /etc/apt/sources.list.d/yarn.list ]]; then
  sudo mv /etc/apt/sources.list.d/yarn.list /etc/apt/sources.list.d/yarn.list.disabled
fi
sudo apt-get update
sudo apt-get install -y --no-install-recommends chromium fonts-noto-cjk

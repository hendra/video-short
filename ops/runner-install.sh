#!/bin/bash
# Install self-hosted GitHub Actions runner untuk video-short di mesin ini (Ubuntu x86_64).
# Pakai sekali; RUNNER_REGISTRATION_TOKEN dari: repo Settings → Actions → Runners → New self-hosted runner (Linux x64)
set -euo pipefail

if [ -z "${RUNNER_REGISTRATION_TOKEN:-}" ]; then
  echo "Set RUNNER_REGISTRATION_TOKEN dulu (repo Settings → Actions → Runners → New self-hosted runner)."
  exit 1
fi
command -v curl >/dev/null || { echo "curl missing"; exit 1; }
[ "$(uname -m)" = "x86_64" ] || { echo "hanya x86_64 didukung"; exit 1; }

DIR="$HOME/actions-runner"
mkdir -p "$DIR" && cd "$DIR"

VER=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tag_name" | sed 's/^v//')
[ -n "$VER" ] || { echo "Gagal mengambil versi runner terbaru"; exit 1; }
echo "Runner version: $VER"

TGZ="actions-runner-linux-x64-${VER}.tar.gz"
[ -f "$TGZ" ] || curl -L -o "$TGZ" "https://github.com/actions/runner/releases/download/v${VER}/$TGZ"
tar xzf "$TGZ"

./config.sh --url https://github.com/hendra/video-short --token "$RUNNER_REGISTRATION_TOKEN" \
  --name video-short-desktop --labels self-hosted,linux,x64 --unattended --replace

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/video-runner.service" <<'SVC'
[Unit]
Description=GitHub Actions runner for video-short
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=%h/actions-runner/run.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
SVC
systemctl --user daemon-reload
systemctl --user enable --now video-runner.service
loginctl enable-linger "$USER" 2>/dev/null || true

echo
echo "Runner 'video-short-desktop' terpasang & jalan sebagai user service."
echo "Cek: systemctl --user status video-runner.service"
echo "Log:  journalctl --user -u video-runner.service -f"

#!/bin/bash
# Install self-hosted GitHub Actions runner untuk video-short di mesin ini (Ubuntu x86_64).
# Pakai sekali; RUNNER_REGISTRATION_TOKEN dari: repo Settings → Actions → Runners → New self-hosted runner (Linux x64)
# Optional: RUNNER_VERSION=2.xxx.x pins the version instead of tracking "latest".
set -uo pipefail

if [ -z "${RUNNER_REGISTRATION_TOKEN:-}" ]; then
  echo "Set RUNNER_REGISTRATION_TOKEN dulu (repo Settings → Actions → Runners → New self-hosted runner)."
  exit 1
fi
for cmd in curl tar unzip node; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 1; }
done
[ "$(uname -m)" = "x86_64" ] || { echo "hanya x86_64 didukung"; exit 1; }

DIR="$HOME/actions-runner"
mkdir -p "$DIR" && cd "$DIR"

if [ -n "${RUNNER_VERSION:-}" ]; then
  VER="$RUNNER_VERSION"
else
  VER=$(curl -sf https://api.github.com/repos/actions/runner/releases/latest | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tag_name" | sed 's/^v//') || VER=""
  [ -n "$VER" ] || { echo "Gagal mengambil versi runner terbaru"; exit 1; }
fi
echo "Runner version: $VER"

TGZ="actions-runner-linux-x64-${VER}.tar.gz"
if [ ! -f "$TGZ" ]; then
  curl -fL -o "$TGZ" "https://github.com/actions/runner/releases/download/v${VER}/$TGZ" || { echo "download gagal"; exit 1; }
fi

# Verify SHA-256 against the digest GitHub publishes on the release asset.
DIGEST=$(curl -sf https://api.github.com/repos/actions/runner/releases/tags/v${VER} \
  | node -p "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); const a=(r.assets||[]).find(a=>a.name==='${TGZ}'); a&&a.digest?a.digest:''") || DIGEST=""
if [ -z "$DIGEST" ]; then
  echo "Release asset digest tidak tersedia untuk ${TGZ} — verifikasi tidak bisa dilakukan, batalkan." >&2
  echo "(Pin RUNNER_VERSION ke versi yang dikenal setelah verifikasi manual sha256sum.)" >&2
  exit 1
fi
SHA="${DIGEST#sha256:}"
echo "${SHA}  ${TGZ}" | sha256sum -c - || { echo "checksum MISMATCH — batalkan."; exit 1; }

# Extract into a fresh dir so partial/mixed versions never coexist with old files.
STAGE="$DIR/.stage-${VER}"
rm -rf "$STAGE" && mkdir -p "$STAGE"
tar xzf "$TGZ" -C "$STAGE" || { echo "extract gagal"; exit 1; }
# Replace runner payload but keep any user files not owned by the tarball is overkill —
# the runner is fully reproducible, so move staged payload into place.
shopt -s dotglob
mv "$STAGE"/* "$DIR/"
rmdir "$STAGE"

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

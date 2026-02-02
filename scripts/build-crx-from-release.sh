#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required." >&2
  exit 1
fi

if ! command -v op >/dev/null 2>&1; then
  echo "Error: 1Password CLI (op) is required." >&2
  exit 1
fi

chrome_bin="${CHROME_BIN:-}"
if [ -z "$chrome_bin" ]; then
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  elif command -v google-chrome >/dev/null 2>&1; then
    chrome_bin="$(command -v google-chrome)"
  elif command -v chromium >/dev/null 2>&1; then
    chrome_bin="$(command -v chromium)"
  else
    echo "Error: Chrome binary not found. Set CHROME_BIN." >&2
    exit 1
  fi
fi

echo "Downloading latest release chrome zip..."
gh release download --pattern "*-chrome.zip" --dir "$tmpdir" >/dev/null

zip_path="$(find "$tmpdir" -maxdepth 1 -type f -name "*-chrome.zip" -print -quit)"
if [ -z "$zip_path" ]; then
  echo "Error: chrome zip not found in latest release." >&2
  exit 1
fi

unzipped_dir="$tmpdir/unzipped"
mkdir -p "$unzipped_dir"
unzip -q "$zip_path" -d "$unzipped_dir"

manifest_path="$(find "$unzipped_dir" -type f -name "manifest.json" -print -quit)"
if [ -z "$manifest_path" ]; then
  echo "Error: manifest.json not found after unzip." >&2
  exit 1
fi

ext_dir="$(dirname "$manifest_path")"
version="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('$manifest_path','utf8'));console.log(m.version||'unknown');")"

key_path="$tmpdir/extension-key.pem"
op read "op://Private/chrome-extension-key/private key" > "$key_path"
chmod 600 "$key_path"

echo "Packing CRX..."
"$chrome_bin" --pack-extension="$ext_dir" --pack-extension-key="$key_path" >/dev/null

crx_path="${ext_dir}.crx"
if [ ! -f "$crx_path" ]; then
  echo "Error: CRX was not created." >&2
  exit 1
fi

out_path="$repo_root/designer-feedback-v${version}.crx"
mv "$crx_path" "$out_path"

echo "CRX created: $out_path"

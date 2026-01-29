#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO="pproenca/designer-feedback"

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --repo <owner/repo>    GitHub repo to fetch releases from.
  --browser <name>       Browser target in asset name (default: chrome).
  --version <x.y.z>      Release tag without the leading "v".
  --zip-url <url>        Direct URL to a zip asset.
  --dir <path>           Install directory (default: ~/.designer-feedback).
  --force                Overwrite existing install directory.
  -h, --help             Show this help.

Env vars (alternative to flags):
  REPO, BROWSER, VERSION, ZIP_URL, INSTALL_DIR, FORCE

Examples:
  REPO=acme/designer-feedback curl -fsSL <URL> | bash
  curl -fsSL <URL> | bash -s -- --repo acme/designer-feedback
  curl -fsSL <URL> | bash -s -- --zip-url https://example.com/extension.zip
EOF
}

log() {
  printf "%s\n" "$*"
}

err() {
  printf "%s\n" "Error: $*" >&2
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

REPO="${REPO:-$DEFAULT_REPO}"
BROWSER="${BROWSER:-chrome}"
VERSION="${VERSION:-}"
ZIP_URL="${ZIP_URL:-}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.designer-feedback}"
FORCE="${FORCE:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --zip-url)
      ZIP_URL="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

require curl
require unzip

if [[ -z "$ZIP_URL" ]]; then
  if [[ -n "$VERSION" ]]; then
    api_url="https://api.github.com/repos/${REPO}/releases/tags/v${VERSION}"
  else
    api_url="https://api.github.com/repos/${REPO}/releases/latest"
  fi

  log "Fetching release metadata from ${REPO}..."
  release_json="$(curl -fsSL "$api_url")"

  ZIP_URL="$(
    printf "%s" "$release_json" \
      | sed -n 's/.*"browser_download_url": "\([^"]*\)".*/\1/p' \
      | grep -iE '\.zip$' \
      | grep -i "${BROWSER}" \
      | head -n1
  )"

  if [[ -z "$ZIP_URL" ]]; then
    ZIP_URL="$(
      printf "%s" "$release_json" \
        | sed -n 's/.*"browser_download_url": "\([^"]*\)".*/\1/p' \
        | grep -iE '\.zip$' \
        | head -n1
    )"
  fi

  if [[ -z "$ZIP_URL" ]]; then
    err "No zip asset found in the release. Use --zip-url or add a zip asset."
    exit 1
  fi
fi

case "$INSTALL_DIR" in
  "/"|"$HOME")
    err "Refusing to use unsafe INSTALL_DIR: $INSTALL_DIR"
    exit 1
    ;;
esac

if [[ -e "$INSTALL_DIR" ]]; then
  if [[ "$FORCE" -ne 1 ]]; then
    err "Install directory exists: $INSTALL_DIR (use --force to overwrite)"
    exit 1
  fi
  rm -rf "$INSTALL_DIR"
fi

tmpdir="$(mktemp -d)"
tmpzip="$tmpdir/extension.zip"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

log "Downloading: $ZIP_URL"
curl -fsSL "$ZIP_URL" -o "$tmpzip"

unzip -q "$tmpzip" -d "$tmpdir/unzipped"

src_dir="$tmpdir/unzipped"
if [[ ! -f "$src_dir/manifest.json" ]]; then
  top_level_dir="$(find "$src_dir" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  if [[ -n "$top_level_dir" && -f "$top_level_dir/manifest.json" ]]; then
    src_dir="$top_level_dir"
  else
    err "Could not find manifest.json in the zip archive."
    exit 1
  fi
fi

mkdir -p "$INSTALL_DIR"
cp -R "$src_dir"/. "$INSTALL_DIR"/

abs_install_dir="$(cd "$INSTALL_DIR" && pwd)"

log ""
log "Installed to: $abs_install_dir"
log ""
log "Next steps (Chrome/Edge/Brave):"
log "1) Open chrome://extensions"
log "2) Enable Developer mode"
log "3) Click Load unpacked and select: $abs_install_dir"
log ""
log "Updates: rerun this script with --force to overwrite the install directory."

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: cws-verified-key.sh <private_key_pem> [public_key_out]
       cws-verified-key.sh --op-ref <op://...> [public_key_out]

Generates the public key PEM required for Chrome Web Store "Verified uploads".

Examples:
  scripts/cws-verified-key.sh ~/keys/privatekey.pem
  scripts/cws-verified-key.sh ~/keys/privatekey.pem ~/keys/publickey.pem
  scripts/cws-verified-key.sh --op-ref "op://Personal/Chrome Key/private.pem" ~/keys/publickey.pem

Env vars:
  OP_PRIVATE_KEY_REF  1Password reference to the private key (same as --op-ref)
EOF
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "Error: openssl not found on PATH." >&2
  exit 1
fi

op_ref="${OP_PRIVATE_KEY_REF:-}"
private_key=""
public_key=""

if [[ "${1:-}" == "--op-ref" ]]; then
  op_ref="${2:-}"
  public_key="${3:-publickey.pem}"
elif [[ -n "${op_ref:-}" ]]; then
  public_key="${1:-publickey.pem}"
else
  private_key="${1:-}"
  public_key="${2:-publickey.pem}"
fi

if [[ -n "${op_ref:-}" && -z "${private_key:-}" ]]; then
  if ! command -v op >/dev/null 2>&1; then
    echo "Error: 1Password CLI (op) not found on PATH." >&2
    exit 1
  fi
  if [[ -z "${op_ref:-}" ]]; then
    echo "Error: missing 1Password reference. Use --op-ref or OP_PRIVATE_KEY_REF." >&2
    exit 1
  fi
  temp_key="$(mktemp)"
  trap 'rm -f "$temp_key"' EXIT
  if ! op read "$op_ref" > "$temp_key"; then
    echo "Error: failed to read key from 1Password reference: $op_ref" >&2
    exit 1
  fi
  private_key="$temp_key"
fi

if [[ ! -f "$private_key" ]]; then
  echo "Error: private key file not found: $private_key" >&2
  exit 1
fi

openssl pkey -in "$private_key" -pubout -out "$public_key"

echo "Public key written to: $public_key"

key_info="$(openssl pkey -in "$private_key" -text -noout 2>/dev/null | grep -m1 'Private-Key' || true)"
if [[ -n "$key_info" ]]; then
  echo "Key info: $key_info"
fi

if command -v base64 >/dev/null 2>&1; then
  fingerprint="$(openssl pkey -pubin -in "$public_key" -outform DER | openssl dgst -sha256 -binary | base64 | tr -d '\n')"
  echo "Public key SHA-256 (base64): $fingerprint"
fi

// =============================================================================
// Hash Utilities (non-cryptographic, deterministic)
// =============================================================================

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_MASK_64 = 0xffffffffffffffffn;

/**
 * Generate a stable 64-bit FNV-1a hash for the given input.
 * This is used to avoid storing raw URLs while keeping keys deterministic.
 */
export function hashString(input: string): string {
  let hash = FNV_OFFSET_BASIS_64;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & FNV_MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

#!/usr/bin/env python3
"""
Write or print the Agentation motion CSS asset.

Usage:
  python3 scripts/apply_agentation_motion.py            # print to stdout
  python3 scripts/apply_agentation_motion.py --out path/to/file.css
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Write Agentation motion CSS to a file or stdout.")
    parser.add_argument("--out", default="-", help="Output path or '-' for stdout (default: -).")
    args = parser.parse_args()

    asset_path = Path(__file__).resolve().parent.parent / "assets" / "agentation-motion.css"
    if not asset_path.exists():
        print(f"Asset not found: {asset_path}", file=sys.stderr)
        return 1

    css = asset_path.read_text(encoding="utf-8")

    if args.out == "-":
        sys.stdout.write(css)
        return 0

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(css, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
CLI pentru teste locale și generare în lot.

Exemple:
  python -m pbn_engine poza.jpg -o out/ --colors 24
  python -m pbn_engine poza.jpg -o out/ --colors 36 --size 300x400 --fit pad
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from .config import SUPPORTED_COLOR_COUNTS, ProcessingConfig
from .pipeline import generate


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="pbn_engine", description="Generator Paint-by-Numbers")
    p.add_argument("image", help="calea către imaginea sursă")
    p.add_argument("-o", "--output", required=True, help="directorul de ieșire")
    p.add_argument("-c", "--colors", type=int, default=24, choices=SUPPORTED_COLOR_COUNTS)
    p.add_argument("--size", default="400x500", help="dimensiunea pânzei în mm, LxH")
    p.add_argument("--fit", choices=("crop", "pad"), default="crop")
    p.add_argument("--px-per-mm", type=float, default=4.0)
    p.add_argument("--min-region-mm2", type=float, default=8.0)
    p.add_argument("--title", default=None)
    p.add_argument("--icc", default=None, help="profil ICC CMYK (ex. ISOcoated_v2.icc)")
    p.add_argument("--no-pdf", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    w_mm, h_mm = (float(v) for v in args.size.lower().split("x"))
    cfg = ProcessingConfig(
        num_colors=args.colors, canvas_width_mm=w_mm, canvas_height_mm=h_mm,
        fit=args.fit, px_per_mm=args.px_per_mm, min_region_mm2=args.min_region_mm2,
        export_pdf=not args.no_pdf,
    )
    res = generate(args.image, args.output, cfg, title=args.title, icc_profile=args.icc)
    json.dump({"files": res.files, "stats": res.stats,
               "total_paint_ml": res.recipe["total_paint_ml"]}, sys.stdout, indent=2,
              ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Orchestratorul: imagine sursă -> set complet de fișiere de producție.

Funcția `generate()` este punctul unic de intrare folosit de:
  - CLI (`python -m pbn_engine ...`) pentru teste locale;
  - worker-ul de coadă (BullMQ / SQS), care descarcă sursa din bucket,
    apelează `generate()` într-un director temporar și urcă rezultatele.

Funcția este pură față de infrastructură (nu știe de S3, Redis sau DB),
ceea ce o face ușor de testat și de rulat oriunde (container, Lambda, Batch).
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Union

import numpy as np
from PIL import Image

from . import __version__
from .config import ProcessingConfig
from .mockup import render_mockup, render_numbered, render_painted, render_palette_card
from .paint import build_recipe, rgb_to_hex
from .quantize import ImageSource, fit_to_canvas, load_image, preprocess, quantize_colors
from .regions import cleanup_regions, compact_palette, extract_regions
from .vectorize import build_svg, compute_paths, detect_edges, svg_to_pdf

log = logging.getLogger("pbn_engine")


@dataclass
class GenerationResult:
    output_dir: Path
    files: Dict[str, str]              # cheie logică -> nume fișier
    recipe: dict
    stats: dict = field(default_factory=dict)


def _save_png(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(arr).save(path, optimize=True)


def generate(
    source: ImageSource,
    output_dir: Union[str, Path],
    cfg: Optional[ProcessingConfig] = None,
    title: Optional[str] = None,
    icc_profile: Optional[str] = None,
) -> GenerationResult:
    cfg = cfg or ProcessingConfig()
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    timings: Dict[str, float] = {}

    def tick(name: str, t0: float) -> float:
        timings[name] = round(time.perf_counter() - t0, 3)
        return time.perf_counter()

    t = time.perf_counter()
    # 1. Încărcare + normalizare la dimensiunea pânzei.
    rgb = load_image(source)
    source_hash = hashlib.sha256(rgb.tobytes()).hexdigest()[:16]
    work = preprocess(fit_to_canvas(rgb, cfg), cfg)
    t = tick("load_preprocess", t)

    # 2. K-Means -> N culori.
    q = quantize_colors(work, cfg)
    t = tick("kmeans", t)

    # 3. Curățarea regiunilor + renumerotare compactă.
    labels = cleanup_regions(q.labels, len(q.palette_rgb), cfg)
    labels, palette_lab, palette_rgb = compact_palette(labels, q.palette_lab, q.palette_rgb)
    k = len(palette_rgb)
    if k < cfg.num_colors:
        log.warning("Paleta finală are %d culori (cerute %d): imaginea are prea puține "
                    "nuanțe distincte sau unele culori au fost absorbite la curățare.",
                    k, cfg.num_colors)
    t = tick("cleanup", t)

    # 4. Regiuni + poziționarea numerelor.
    regions, region_map = extract_regions(labels, k)
    region_counts = Counter(r.color_index for r in regions)
    t = tick("regions", t)

    # 5. Vectorizare (fișierul de producție + soluția colorată).
    palette_hex = [rgb_to_hex(c) for c in palette_rgb]
    paths = compute_paths(region_map, regions, cfg.contour_simplify_tolerance_px)
    svg_canvas = build_svg(region_map, regions, palette_hex, cfg, False, title, paths)
    svg_solution = build_svg(region_map, regions, palette_hex, cfg, True, title, paths)
    files: Dict[str, str] = {"canvas_svg": "canvas.svg", "solution_svg": "solution.svg"}
    (out / files["canvas_svg"]).write_text(svg_canvas, encoding="utf-8")
    (out / files["solution_svg"]).write_text(svg_solution, encoding="utf-8")
    if cfg.export_pdf and svg_to_pdf(svg_canvas, str(out / "canvas.pdf")):
        files["canvas_pdf"] = "canvas.pdf"
    t = tick("vectorize", t)

    # 6. Rețeta de vopsea.
    recipe = build_recipe(labels, palette_rgb, palette_lab, region_counts, cfg, icc_profile)
    files["recipe_json"] = "recipe.json"
    (out / files["recipe_json"]).write_text(json.dumps(recipe, indent=2, ensure_ascii=False),
                                            encoding="utf-8")
    t = tick("recipe", t)

    # 7. Imagini de previzualizare.
    painted = render_painted(labels, palette_rgb)
    edges = detect_edges(labels)
    _save_png(painted, out / "painted.png")
    _save_png(render_numbered(labels, edges, regions, cfg), out / "numbered.png")
    _save_png(render_palette_card(recipe), out / "palette.png")
    Image.fromarray(render_mockup(painted, cfg, seed=cfg.random_seed)).save(
        out / "mockup.jpg", quality=88, optimize=True, progressive=True)
    files.update(painted_png="painted.png", numbered_png="numbered.png",
                 palette_png="palette.png", mockup_jpg="mockup.jpg")
    t = tick("previews", t)

    # Scor de dificultate (pentru filtrele din catalog): densitatea de regiuni.
    canvas_dm2 = cfg.canvas_width_mm * cfg.canvas_height_mm / 1e4
    density = len(regions) / canvas_dm2
    difficulty = ("ușor" if density < 25 else "mediu" if density < 60
                  else "avansat" if density < 120 else "expert")

    stats = {
        "engine_version": __version__,
        "source_hash": source_hash,
        "work_size_px": list(cfg.work_size_px),
        "num_colors_requested": cfg.num_colors,
        "num_colors_final": k,
        "num_regions": len(regions),
        "regions_per_dm2": round(density, 1),
        "difficulty": difficulty,
        "timings_s": timings,
    }
    manifest = {"title": title, "files": files, "stats": stats, "config": cfg.to_dict()}
    files["manifest_json"] = "manifest.json"
    manifest["files"] = files
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False),
                                       encoding="utf-8")
    log.info("Generat %s: %d culori, %d regiuni în %.1fs", out, k, len(regions),
             sum(timings.values()))
    return GenerationResult(output_dir=out, files=files, recipe=recipe, stats=stats)

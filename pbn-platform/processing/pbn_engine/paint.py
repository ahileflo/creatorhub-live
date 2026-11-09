"""
Etapa 4: rețeta de culori și estimarea consumului de vopsea.

Modelul de consum (relația X pixeli -> Y ml):

    aria_cm²  = pixeli × (aria_pânzei_cm² / pixeli_totali)
    volum_ml  = aria_cm² × (grosime_film_mm / 10) × straturi × (1 + pierderi)

  1 ml = 1 cm³, deci un film de 0.08 mm (= 0.008 cm) pe 1 cm² consumă 0.008 ml.
  Exemplu: pânză 40×50 cm (2000 cm²), 2 straturi, 20% pierderi
           => ~38 ml vopsea în total, adică ~1.6 ml/culoare la 24 de culori
           (consistent cu recipientele de 3 ml din kiturile comerciale).

  Parametrii sunt calibrabili: după primele N kituri produse, se cântăresc
  recipientele returnate/folosite și se ajustează `wet_film_mm`.

Conversia CMYK:
  Conversia „naivă" (fără profil ICC) este aproximativă și servește doar ca
  referință. Pentru tipar real, setați `icc_profile` (ex.: ISOcoated_v2 /
  FOGRA39), iar conversia se face prin LittleCMS (Pillow ImageCms).
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

import numpy as np
from PIL import Image, ImageCms

from .config import ProcessingConfig


def rgb_to_hex(rgb) -> str:
    return "#{:02X}{:02X}{:02X}".format(*(int(v) for v in rgb))


def rgb_to_cmyk_naive(rgb) -> List[float]:
    """Conversie matematică sRGB -> CMYK (procente). Fără management de culoare."""
    r, g, b = (v / 255.0 for v in rgb)
    k = 1.0 - max(r, g, b)
    if k >= 1.0:
        return [0.0, 0.0, 0.0, 100.0]
    c = (1 - r - k) / (1 - k)
    m = (1 - g - k) / (1 - k)
    y = (1 - b - k) / (1 - k)
    return [round(v * 100, 1) for v in (c, m, y, k)]


def rgb_to_cmyk_icc(palette_rgb: np.ndarray, icc_profile: str) -> List[List[float]]:
    """Conversie cu profil ICC (intent perceptual) pentru întreaga paletă."""
    img = Image.fromarray(palette_rgb.reshape(1, -1, 3).astype(np.uint8), "RGB")
    transform = ImageCms.buildTransform(
        ImageCms.createProfile("sRGB"), ImageCms.getOpenProfile(icc_profile),
        "RGB", "CMYK", renderingIntent=ImageCms.Intent.PERCEPTUAL,
    )
    cmyk = np.asarray(ImageCms.applyTransform(img, transform)).reshape(-1, 4)
    return [[round(v / 255 * 100, 1) for v in row] for row in cmyk]


def _pot_size(ml: float, pot_sizes: tuple) -> float:
    for size in sorted(pot_sizes):
        if ml <= size:
            return size
    # Peste cel mai mare recipient: multiplu al acestuia.
    largest = max(pot_sizes)
    return largest * math.ceil(ml / largest)


def build_recipe(
    labels: np.ndarray,
    palette_rgb: np.ndarray,
    palette_lab: np.ndarray,
    region_counts: Dict[int, int],
    cfg: ProcessingConfig,
    icc_profile: Optional[str] = None,
) -> dict:
    """Construiește rețeta JSON: cod culoare, arie, ml estimați, recipient."""
    pc = cfg.paint
    total_px = labels.size
    canvas_cm2 = (cfg.canvas_width_mm / 10.0) * (cfg.canvas_height_mm / 10.0)
    cm2_per_px = canvas_cm2 / total_px
    film_cm = pc.wet_film_mm / 10.0

    counts = np.bincount(labels.ravel(), minlength=len(palette_rgb))
    cmyk_icc = rgb_to_cmyk_icc(palette_rgb, icc_profile) if icc_profile else None

    colors = []
    total_ml = 0.0
    for i, (rgb, lab) in enumerate(zip(palette_rgb, palette_lab)):
        area_px = int(counts[i])
        area_cm2 = area_px * cm2_per_px
        coats = pc.coats + (1 if lab[0] >= pc.extra_coat_above_lightness else 0)
        ml = area_cm2 * film_cm * coats * (1.0 + pc.waste_factor)
        ml_rounded = max(pc.min_ml, round(ml, 2))
        total_ml += ml_rounded
        colors.append({
            "number": i + 1,
            "hex": rgb_to_hex(rgb),
            "rgb": [int(v) for v in rgb],
            "lab": [round(float(v), 2) for v in lab],
            "cmyk": cmyk_icc[i] if cmyk_icc else rgb_to_cmyk_naive(rgb),
            "cmyk_method": "icc" if cmyk_icc else "naive",
            "area_px": area_px,
            "area_cm2": round(area_cm2, 2),
            "coverage_pct": round(100.0 * area_px / total_px, 3),
            "regions": int(region_counts.get(i, 0)),
            "coats": coats,
            "paint_ml": ml_rounded,
            "pot_ml": _pot_size(ml_rounded, pc.pot_sizes_ml),
        })

    return {
        "canvas": {
            "width_mm": cfg.canvas_width_mm,
            "height_mm": cfg.canvas_height_mm,
            "area_cm2": round(canvas_cm2, 1),
        },
        "model": {
            "wet_film_mm": pc.wet_film_mm,
            "base_coats": pc.coats,
            "waste_factor": pc.waste_factor,
            "formula": "ml = area_cm2 * (wet_film_mm/10) * coats * (1 + waste_factor)",
        },
        "num_colors": len(colors),
        "total_paint_ml": round(total_ml, 1),
        "colors": colors,
    }

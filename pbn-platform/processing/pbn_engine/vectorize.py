"""
Etapa 3: vectorizarea — SVG/PDF pentru printul pe pânză.

Contururi vectoriale (SVG):
  Folosim „marching squares" (skimage.measure.find_contours) la pragul 0.5 pe
  masca binară a fiecărei regiuni. Iso-linia 0.5 trece EXACT la jumătatea
  distanței dintre un pixel al regiunii și pixelul vecin, deci două regiuni
  alăturate produc aceeași frontieră -> o singură linie curată pe pânză, nu
  două linii paralele decalate (problema clasică a cv2.findContours, care
  urmărește centrele pixelilor de margine).

Contururi raster (previzualizare):
  Pentru imaginile PNG de previzualizare folosim Canny pe harta de etichete:
  orice salt de etichetă este o „margine" perfectă, iar suprimarea non-maximelor
  din Canny produce linii de 1 px.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from xml.sax.saxutils import escape

import cv2
import numpy as np
from skimage import measure

from .config import ProcessingConfig
from .regions import Region


# ---------------------------------------------------------------------------
# Raster
# ---------------------------------------------------------------------------
def detect_edges(labels: np.ndarray) -> np.ndarray:
    """Hartă binară (H, W) uint8 {0,255} a frontierelor dintre culori (Canny)."""
    # Scalăm etichetele ca să maximizăm gradientul; pragurile mici prind
    # orice schimbare de etichetă, iar harta nu are zgomot (este discretă).
    k = int(labels.max()) + 1
    img = (labels.astype(np.float32) * (255.0 / max(1, k - 1))).astype(np.uint8)
    edges = cv2.Canny(img, 1, 1, L2gradient=True)
    # Granițele exacte (salturi orizontale/verticale) completează eventualele
    # goluri lăsate de Canny la joncțiunile de 3+ regiuni.
    exact = np.zeros_like(edges)
    exact[:, 1:][labels[:, 1:] != labels[:, :-1]] = 255
    exact[1:, :][labels[1:, :] != labels[:-1, :]] = 255
    return cv2.bitwise_or(edges, exact)


# ---------------------------------------------------------------------------
# Vector
# ---------------------------------------------------------------------------
def _region_path(region_map: np.ndarray, region: Region, tolerance: float) -> str:
    """Path SVG (inclusiv găurile) pentru o regiune, cu fill-rule evenodd."""
    x, y, w, h = region.bbox
    comp = (region_map[y:y + h, x:x + w] == region.region_id).astype(np.float32)
    padded = np.pad(comp, 1)  # garantează contururi închise

    parts: List[str] = []
    for contour in measure.find_contours(padded, 0.5):
        if tolerance > 0 and len(contour) > 4:
            contour = measure.approximate_polygon(contour, tolerance=tolerance)
        if len(contour) < 3:
            continue
        # (rând, coloană) -> (x, y). -1 pentru padding, +0.5 pentru că pixelul
        # (i, j) acoperă pătratul [j, j+1] × [i, i+1] în coordonatele SVG.
        xs = contour[:, 1] - 1 + x + 0.5
        ys = contour[:, 0] - 1 + y + 0.5
        pts = " ".join(f"{a:.2f},{b:.2f}" for a, b in zip(xs, ys))
        parts.append(f"M{pts}Z")
    return "".join(parts)


def compute_paths(region_map: np.ndarray, regions: List[Region], tolerance: float) -> Dict[int, str]:
    """Calculează o singură dată path-urile tuturor regiunilor (refolosite
    pentru SVG-ul de producție și pentru soluția colorată)."""
    return {r.region_id: _region_path(region_map, r, tolerance) for r in regions}


def font_size_px(region: Region, cfg: ProcessingConfig) -> float:
    """Mărimea fontului: cât încape în raza înscrisă, limitată la [min, max] mm."""
    fmin, fmax = cfg.mm_to_px(cfg.font_min_mm), cfg.mm_to_px(cfg.font_max_mm)
    return float(np.clip(region.clearance_px * 1.3, fmin, fmax))


def build_svg(
    region_map: np.ndarray,
    regions: List[Region],
    palette_hex: List[str],
    cfg: ProcessingConfig,
    filled: bool = False,
    title: Optional[str] = None,
    paths: Optional[Dict[int, str]] = None,
) -> str:
    """Construiește SVG-ul la dimensiunea fizică a pânzei (mm).

    filled=False -> fișierul de PRODUCȚIE: doar contururi + numere (pe pânză albă).
    filled=True  -> „soluția" colorată (control de calitate / previzualizare).
    viewBox-ul este în pixeli de lucru, iar width/height în mm, deci imprimanta
    primește dimensiunea fizică exactă indiferent de rezoluția de lucru.
    """
    H, W = region_map.shape
    stroke_w = cfg.mm_to_px(cfg.line_width_mm)
    if paths is None:
        paths = compute_paths(region_map, regions, cfg.contour_simplify_tolerance_px)

    out: List[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{cfg.canvas_width_mm:g}mm" '
        f'height="{cfg.canvas_height_mm:g}mm" viewBox="0 0 {W} {H}">',
    ]
    if title:
        out.append(f"<title>{escape(title)}</title>")
    out.append(
        "<style>"
        f".r{{fill:none;stroke:{cfg.line_color};stroke-width:{stroke_w:.3f};"
        "stroke-linejoin:round;fill-rule:evenodd}"
        f".n{{font-family:{cfg.font_family};fill:{cfg.number_color};"
        "text-anchor:middle;dominant-baseline:central}"
        "</style>"
    )
    out.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')

    # Grupăm path-urile pe culoare: fișier mai mic și ușor de editat în Illustrator.
    by_color: Dict[int, List[Region]] = {}
    for r in regions:
        by_color.setdefault(r.color_index, []).append(r)

    out.append('<g id="regions">')
    for c in sorted(by_color):
        # Stilul inline are prioritate față de clasa .r (fill:none).
        fill_attr = f' style="fill:{palette_hex[c]}"' if filled else ""
        out.append(f'<g id="color-{c + 1}" data-color="{c + 1}">')
        for r in by_color[c]:
            d = paths.get(r.region_id, "")
            if d:
                out.append(f'<path class="r" id="reg-{r.region_id}"{fill_attr} d="{d}"/>')
        out.append("</g>")
    out.append("</g>")

    if not filled:
        out.append('<g id="numbers">')
        for r in regions:
            fs = font_size_px(r, cfg)
            lx, ly = r.label_xy
            out.append(
                f'<text class="n" x="{lx:.1f}" y="{ly:.1f}" '
                f'font-size="{fs:.2f}">{r.color_index + 1}</text>'
            )
        out.append("</g>")

    out.append("</svg>")
    return "\n".join(out)


def svg_to_pdf(svg: str, pdf_path: str) -> bool:
    """Conversie SVG -> PDF vectorial (CairoSVG). Returnează False dacă
    biblioteca nativă Cairo lipsește (PDF-ul devine opțional, nu blochează job-ul)."""
    try:
        import cairosvg  # import local: dependență opțională
    except (ImportError, OSError):
        return False
    cairosvg.svg2pdf(bytestring=svg.encode("utf-8"), write_to=pdf_path)
    return True

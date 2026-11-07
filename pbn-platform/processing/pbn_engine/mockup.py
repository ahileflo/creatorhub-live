"""
Etapa 5: imagini de previzualizare pentru magazin.

  - painted.png   : cum arată tabloul terminat (culorile paletei).
  - numbered.png  : pânza de pornire (contururi + numere), raster.
  - mockup.jpg    : tabloul terminat pe un perete, cu ramă de lemn/pânză
                    și umbră — generat procedural, fără asset-uri externe,
                    deci rulează identic în orice worker.
"""
from __future__ import annotations

from typing import List

import cv2
import numpy as np

from .config import ProcessingConfig
from .regions import Region
from .vectorize import font_size_px


def render_painted(labels: np.ndarray, palette_rgb: np.ndarray) -> np.ndarray:
    return palette_rgb[labels]


def render_numbered(labels: np.ndarray, edges: np.ndarray, regions: List[Region],
                    cfg: ProcessingConfig) -> np.ndarray:
    """Pânza de pornire, raster RGB."""
    img = np.full((*labels.shape, 3), 255, dtype=np.uint8)
    img[edges > 0] = (150, 150, 150)
    for r in regions:
        txt = str(r.color_index + 1)
        fs_px = font_size_px(r, cfg)
        scale = fs_px / 22.0  # HERSHEY_SIMPLEX are ~22 px înălțime la scale=1
        thick = 1
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)
        x, y = r.label_xy
        cv2.putText(img, txt, (int(x - tw / 2), int(y + th / 2)),
                    cv2.FONT_HERSHEY_SIMPLEX, scale, (110, 110, 110), thick, cv2.LINE_AA)
    return img


def _limit(img: np.ndarray, max_side: int) -> np.ndarray:
    h, w = img.shape[:2]
    s = max_side / max(h, w)
    if s >= 1:
        return img
    return cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)


def render_mockup(painted: np.ndarray, cfg: ProcessingConfig, seed: int = 0) -> np.ndarray:
    """Compune tabloul pe un perete: textură de pânză, margine 3D, umbră."""
    art = _limit(painted, int(cfg.mockup_max_side_px * 0.62)).astype(np.float32)
    h, w = art.shape[:2]
    rng = np.random.default_rng(seed)

    # Textură de pânză (țesătură fină) + variație ușoară de pensulă.
    yy, xx = np.mgrid[0:h, 0:w]
    weave = 0.5 * (np.sin(xx * 1.9) + np.sin(yy * 1.9))
    noise = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.2)
    art *= (1.0 + 0.018 * weave + 0.025 * noise)[..., None]

    # Peretele: gradient cald, lumină de sus.
    pad_x, pad_y = int(w * 0.35), int(h * 0.28)
    H, W = h + 2 * pad_y, w + 2 * pad_x
    gy = np.linspace(1.0, 0.86, H, dtype=np.float32)[:, None, None]
    wall = np.ones((H, W, 3), np.float32) * np.array([236, 232, 226], np.float32) * gy

    # Umbră difuză (decalată în jos-dreapta).
    depth = max(4, int(min(h, w) * 0.022))
    shadow = np.zeros((H, W), np.float32)
    cv2.rectangle(shadow, (pad_x + depth, pad_y + depth * 2),
                  (pad_x + w + depth, pad_y + h + depth * 2), 1.0, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), depth * 2.5)
    wall *= (1.0 - 0.42 * shadow)[..., None]

    # Muchia laterală a șasiului (efect 3D de pânză întinsă).
    edge = art[:, -1:, :] * 0.62
    wall[pad_y:pad_y + h, pad_x + w:pad_x + w + depth] = np.repeat(edge, depth, axis=1)
    bottom = art[-1:, :, :] * 0.55
    wall[pad_y + h:pad_y + h + depth // 2, pad_x:pad_x + w] = np.repeat(bottom, depth // 2, axis=0)

    wall[pad_y:pad_y + h, pad_x:pad_x + w] = art
    return np.clip(wall, 0, 255).astype(np.uint8)


def render_palette_card(recipe: dict, swatch: int = 64) -> np.ndarray:
    """Cartonaș cu paleta (număr + mostră + HEX + ml) inclus în kit și pe site."""
    colors = recipe["colors"]
    cols = 6
    rows = (len(colors) + cols - 1) // cols
    cell_w, cell_h = swatch * 3, swatch + 40
    img = np.full((rows * cell_h + 20, cols * cell_w + 20, 3), 255, np.uint8)
    for i, c in enumerate(colors):
        r, k = divmod(i, cols)
        x0, y0 = 10 + k * cell_w, 10 + r * cell_h
        cv2.rectangle(img, (x0, y0), (x0 + swatch, y0 + swatch), tuple(c["rgb"]), -1)
        cv2.rectangle(img, (x0, y0), (x0 + swatch, y0 + swatch), (180, 180, 180), 1)
        cv2.putText(img, str(c["number"]), (x0 + swatch + 8, y0 + 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2, cv2.LINE_AA)
        cv2.putText(img, c["hex"], (x0 + swatch + 8, y0 + 46),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (90, 90, 90), 1, cv2.LINE_AA)
        cv2.putText(img, f'{c["paint_ml"]} ml', (x0 + swatch + 8, y0 + 64),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (90, 90, 90), 1, cv2.LINE_AA)
    return img

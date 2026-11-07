"""
Etapa 2: curățarea hărții de etichete și extragerea regiunilor pictabile.

O hartă K-Means „brută" conține zeci de mii de insule de 1–10 pixeli.
Pe pânză, fiecare insulă ar fi o zonă cu număr — imposibil de pictat.
Procesul de curățare:
  1. Filtru de majoritate (mode filter): fiecare pixel ia culoarea dominantă
     din vecinătate -> elimină zgomotul fin.
  2. Absorbția regiunilor prea mici (arie < min_region) sau prea înguste
     (raza maximă înscrisă < min_clearance) în vecinul cu care au cea mai
     lungă frontieră comună.
  3. Pentru fiecare regiune finală: poziția numărului.

Plasarea numărului — de ce nu (doar) centroidul?
  Centroidul unei forme concave (litera „C", o semilună, un inel) cade adesea
  ÎN AFARA formei. Folosim centroidul doar dacă este în interior și are spațiu
  suficient; altfel folosim „polul de inaccesibilitate" (punctul cel mai
  îndepărtat de margine = maximul transformatei distanță), unde numărul are
  garantat cel mai mult loc.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import cv2
import numpy as np

from .config import ProcessingConfig

_CROSS = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))


@dataclass
class Region:
    region_id: int
    color_index: int                 # index 0-based în paletă
    area_px: int
    bbox: Tuple[int, int, int, int]  # x, y, w, h
    label_xy: Tuple[float, float]    # poziția numărului (coordonate pixel)
    clearance_px: float              # raza maximă înscrisă (spațiu pentru număr)


# ---------------------------------------------------------------------------
def majority_filter(labels: np.ndarray, num_colors: int, size: int, passes: int) -> np.ndarray:
    """Filtru de majoritate vectorizat: pentru fiecare culoare calculăm câți
    vecini din fereastra size×size o au, apoi alegem culoarea cu scor maxim.
    Complexitate O(K·H·W), dar fiecare pas este un box-filter OpenCV (foarte rapid)."""
    out = labels
    for _ in range(passes):
        best_score = np.full(out.shape, -1.0, dtype=np.float32)
        best_label = out.copy()
        for c in range(num_colors):
            score = cv2.blur((out == c).astype(np.float32), (size, size),
                             borderType=cv2.BORDER_REFLECT)
            better = score > best_score
            best_score[better] = score[better]
            best_label[better] = c
        out = best_label
    return out


def _absorb_component(labels: np.ndarray, comp_mask: np.ndarray, y0: int, x0: int, own: int) -> bool:
    """Atribuie componenta culorii vecine cu cea mai lungă frontieră comună."""
    h, w = comp_mask.shape
    sub = labels[y0:y0 + h, x0:x0 + w]
    ring = cv2.dilate(comp_mask.astype(np.uint8), _CROSS).astype(bool) & ~comp_mask
    neigh = sub[ring]
    neigh = neigh[neigh != own]
    if neigh.size == 0:
        return False
    sub[comp_mask] = np.bincount(neigh).argmax()
    return True


def cleanup_regions(labels: np.ndarray, num_colors: int, cfg: ProcessingConfig) -> np.ndarray:
    """Elimină iterativ regiunile prea mici sau prea înguste."""
    labels = majority_filter(labels, num_colors, cfg.majority_filter_size, cfg.majority_filter_passes)
    labels = labels.copy()
    H, W = labels.shape
    min_area = cfg.min_region_px
    min_clear = cfg.min_clearance_px

    for _ in range(cfg.cleanup_max_iterations):
        changed = 0
        for c in range(num_colors):
            mask = (labels == c).astype(np.uint8)
            if not mask.any():
                continue
            n, cc, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
            for idx in range(1, n):
                x, y, w, h, area = stats[idx]
                # Bounding box extins cu 1 px pentru inelul de vecini.
                x0, y0 = max(0, x - 1), max(0, y - 1)
                x1, y1 = min(W, x + w + 1), min(H, y + h + 1)
                comp = cc[y0:y1, x0:x1] == idx

                too_small = area < min_area
                if not too_small and min_clear > 0 and area < min_area * 20:
                    # Verificăm grosimea doar pentru regiuni mici/medii (cost redus).
                    padded = np.pad(comp, 1).astype(np.uint8)
                    clearance = cv2.distanceTransform(padded, cv2.DIST_L2, 3).max()
                    too_small = clearance < min_clear
                if too_small and _absorb_component(labels, comp, y0, x0, c):
                    changed += 1
        if changed == 0:
            break
    return labels


def compact_palette(labels: np.ndarray, palette_lab: np.ndarray, palette_rgb: np.ndarray):
    """După curățare unele culori pot dispărea complet; renumerotăm compact
    (fără „găuri" în numerotare) păstrând ordinea deschis -> închis."""
    used = np.unique(labels)
    remap = np.full(palette_lab.shape[0], -1, dtype=np.int32)
    remap[used] = np.arange(used.size)
    return remap[labels], palette_lab[used], palette_rgb[used]


def extract_regions(labels: np.ndarray, num_colors: int) -> Tuple[List[Region], np.ndarray]:
    """Identifică fiecare regiune conexă și calculează poziția numărului.

    Returnează lista de regiuni și o hartă (H, W) cu ID-ul regiunii per pixel.
    """
    H, W = labels.shape
    region_map = np.zeros((H, W), dtype=np.int32)
    regions: List[Region] = []
    next_id = 1

    for c in range(num_colors):
        mask = (labels == c).astype(np.uint8)
        if not mask.any():
            continue
        n, cc, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=4)
        for idx in range(1, n):
            x, y, w, h, area = (int(v) for v in stats[idx])
            comp = cc[y:y + h, x:x + w] == idx
            region_map[y:y + h, x:x + w][comp] = next_id

            # Transformata distanță pe crop cu padding (marginea contează ca graniță).
            dist = cv2.distanceTransform(np.pad(comp, 1).astype(np.uint8), cv2.DIST_L2, 5)[1:-1, 1:-1]
            max_clear = float(dist.max())
            py, px = np.unravel_index(int(dist.argmax()), dist.shape)
            pole = (x + px + 0.5, y + py + 0.5)

            cx, cy = centroids[idx]
            ix, iy = int(cx) - x, int(cy) - y
            label_xy = pole
            if 0 <= ix < w and 0 <= iy < h and comp[iy, ix] and dist[iy, ix] >= 0.7 * max_clear:
                label_xy = (float(cx) + 0.5, float(cy) + 0.5)

            regions.append(Region(next_id, c, area, (x, y, w, h), label_xy,
                                  float(dist[int(label_xy[1] - y - 0.5), int(label_xy[0] - x - 0.5)])))
            next_id += 1
    return regions, region_map

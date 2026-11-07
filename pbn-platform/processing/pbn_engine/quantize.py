"""
Etapa 1: încărcare, normalizare și reducerea culorilor prin K-Means.

De ce în spațiul CIELAB și nu RGB?
  Distanța euclidiană în RGB nu corespunde percepției umane (două verzi
  „apropiate" în RGB pot arăta foarte diferit). În CIELAB, distanța ≈ diferența
  percepută (ΔE76), deci clusterele K-Means devin culori pe care ochiul le
  distinge efectiv — exact ce vrem pentru o paletă de vopsele.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Union

import cv2
import numpy as np
from PIL import Image, ImageOps
from skimage import color as skcolor
from sklearn.cluster import KMeans

from .config import ProcessingConfig

ImageSource = Union[str, Path, bytes, Image.Image, np.ndarray]

# Protecție împotriva „decompression bombs": refuzăm imagini > 100 MP.
Image.MAX_IMAGE_PIXELS = 100_000_000

# Pozele de iPhone (iCloud) vin adesea în HEIC: suport opțional prin pillow-heif.
try:  # pragma: no cover - dependență opțională
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass


@dataclass
class QuantizedImage:
    labels: np.ndarray       # (H, W) int32 — indexul culorii pentru fiecare pixel
    palette_lab: np.ndarray  # (K, 3) float64 — centrele clusterelor în CIELAB
    palette_rgb: np.ndarray  # (K, 3) uint8 — aceleași culori în sRGB


# ---------------------------------------------------------------------------
# Încărcare & normalizare
# ---------------------------------------------------------------------------
def load_image(source: ImageSource) -> np.ndarray:
    """Încarcă imaginea ca array RGB uint8, respectând orientarea EXIF.

    Pozele de pe telefon (Google Photos / iCloud) sunt adesea salvate „culcat"
    cu un tag EXIF de rotație — fără exif_transpose, tabloul iese rotit.
    """
    if isinstance(source, np.ndarray):
        arr = source
        if arr.ndim == 2:
            arr = np.stack([arr] * 3, axis=-1)
        return np.ascontiguousarray(arr[..., :3]).astype(np.uint8)

    if isinstance(source, Image.Image):
        img = source
    elif isinstance(source, (bytes, bytearray)):
        import io
        img = Image.open(io.BytesIO(source))
    else:
        img = Image.open(str(source))

    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        # Transparența se compune pe fundal alb (pânza este albă).
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    return np.asarray(img.convert("RGB"), dtype=np.uint8)


def fit_to_canvas(rgb: np.ndarray, cfg: ProcessingConfig) -> np.ndarray:
    """Aduce imaginea la raportul și rezoluția de lucru ale pânzei."""
    target_w, target_h = cfg.work_size_px
    h, w = rgb.shape[:2]
    target_ratio = target_w / target_h

    if cfg.fit == "crop":
        # Decupare centrală la raportul pânzei.
        if w / h > target_ratio:
            new_w = int(round(h * target_ratio))
            x0 = (w - new_w) // 2
            rgb = rgb[:, x0:x0 + new_w]
        else:
            new_h = int(round(w / target_ratio))
            y0 = (h - new_h) // 2
            rgb = rgb[y0:y0 + new_h, :]
        interp = cv2.INTER_AREA if rgb.shape[1] > target_w else cv2.INTER_CUBIC
        return cv2.resize(rgb, (target_w, target_h), interpolation=interp)

    # "pad": încadrare completă + margini albe.
    scale = min(target_w / w, target_h / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    resized = cv2.resize(rgb, (nw, nh), interpolation=interp)
    canvas = np.full((target_h, target_w, 3), 255, dtype=np.uint8)
    y0, x0 = (target_h - nh) // 2, (target_w - nw) // 2
    canvas[y0:y0 + nh, x0:x0 + nw] = resized
    return canvas


def preprocess(rgb: np.ndarray, cfg: ProcessingConfig) -> np.ndarray:
    """Netezire care păstrează marginile.

    Filtrul bilateral elimină zgomotul și micro-texturile (porii pielii,
    frunzișul) care altfel ar genera mii de regiuni minuscule, imposibil de pictat.
    """
    out = rgb
    for _ in range(cfg.bilateral_passes):
        out = cv2.bilateralFilter(
            out,
            d=cfg.bilateral_diameter,
            sigmaColor=cfg.bilateral_sigma_color,
            sigmaSpace=cfg.bilateral_sigma_space,
        )
    return out


# ---------------------------------------------------------------------------
# K-Means
# ---------------------------------------------------------------------------
def lab_to_rgb8(lab: np.ndarray) -> np.ndarray:
    rgb = skcolor.lab2rgb(lab.reshape(-1, 1, 3)).reshape(-1, 3)
    return np.clip(np.round(rgb * 255.0), 0, 255).astype(np.uint8)


def quantize_colors(rgb: np.ndarray, cfg: ProcessingConfig) -> QuantizedImage:
    """Reduce imaginea la exact `cfg.num_colors` culori prin K-Means în CIELAB.

    1. Conversie RGB -> LAB (float, precizie completă).
    2. Antrenare K-Means pe un eșantion aleator de pixeli (rapid, rezultat
       practic identic cu antrenarea pe toată imaginea).
    3. Atribuirea fiecărui pixel celui mai apropiat centru.
    4. Sortarea paletei după luminozitate (1 = cea mai deschisă culoare),
       astfel încât numerotarea să fie previzibilă pentru client.
    """
    h, w = rgb.shape[:2]
    k = cfg.num_colors
    lab = skcolor.rgb2lab(rgb).reshape(-1, 3).astype(np.float32)

    rng = np.random.default_rng(cfg.random_seed)
    n_sample = min(cfg.kmeans_sample_size, lab.shape[0])
    sample = lab[rng.choice(lab.shape[0], size=n_sample, replace=False)]

    # Dacă imaginea are mai puține culori distincte decât K (ex.: grafică
    # vectorială simplă), K-Means nu poate produce K clustere distincte.
    n_unique = np.unique(sample.round(1), axis=0).shape[0]
    k_eff = min(k, n_unique)

    km = KMeans(n_clusters=k_eff, n_init=4, max_iter=300, random_state=cfg.random_seed)
    km.fit(sample)
    labels = km.predict(lab).astype(np.int32)
    centers = km.cluster_centers_.astype(np.float64)

    # Sortare după L* descrescător (deschis -> închis).
    order = np.argsort(-centers[:, 0])
    remap = np.empty_like(order)
    remap[order] = np.arange(k_eff)
    labels = remap[labels].reshape(h, w)
    centers = centers[order]

    return QuantizedImage(labels=labels, palette_lab=centers, palette_rgb=lab_to_rgb8(centers))

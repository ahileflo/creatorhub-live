"""
Motor de procesare Paint-by-Numbers (PBN).

Pipeline:
  1. Încărcare + redimensionare + netezire (păstrează marginile — bilateral filter)
  2. K-Means în spațiul de culoare CIE Lab (perceptual uniform) -> N culori
  3. Curățare "facete": filtru de majoritate + absorbția zonelor prea mici în vecinul dominant
     (altfel clientul primește sute de căsuțe minuscule imposibil de pictat)
  4. Contururi între zone -> SVG vectorial (linii + numere) pentru pânză
  5. Plasarea numărului în "polul de inaccesibilitate" (punctul cel mai interior al zonei,
     calculat cu distance transform). Centroidul simplu cade des ÎN AFARA zonelor concave.
  6. Rețeta de vopsea: arie fizică (cm²) per culoare -> ml de acrilic (cu straturi + pierderi)
  7. Previzualizare colorată + mockup simplu

Folosire CLI:
  python -m pbn.engine.pbn poza.jpg out/ --colors 24 --width-cm 40 --height-cm 50
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, asdict, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from sklearn.cluster import MiniBatchKMeans


# ----------------------------------------------------------------------------- config
@dataclass
class PBNConfig:
    n_colors: int = 24                 # 12 / 24 / 36 / 48
    max_side_px: int = 1600            # rezoluția de lucru (procesare); SVG-ul e vectorial, se scalează
    canvas_width_cm: float = 40.0
    canvas_height_cm: float = 50.0
    min_region_px: int = 0             # 0 = automat (≈ 0.02% din imagine)
    smoothing: int = 9                 # diametrul filtrului bilateral
    majority_passes: int = 2
    ml_per_cm2: float = 0.012          # acoperire acrilic fluid, un strat (calibrați pe vopseaua voastră!)
    coats: int = 2
    waste_factor: float = 1.35         # pierderi pe pensulă/cupă
    min_ml_per_pot: float = 1.0
    pot_sizes_ml: tuple = (3.0, 5.0, 10.0)
    line_color: str = "#9aa0a6"        # gri deschis: se acoperă ușor cu vopsea
    line_width_mm: float = 0.25
    min_delta_e: float = 4.0           # culori mai apropiate de atât (ΔE Lab) se unesc: nu are sens 2 cupe aproape identice
    seed: int = 42


@dataclass
class PaintEntry:
    number: int
    hex: str
    rgb: tuple
    cmyk: tuple
    area_px: int
    area_cm2: float
    coverage_pct: float
    paint_ml: float
    pot_ml: float
    regions: int


@dataclass
class PBNResult:
    width_px: int
    height_px: int
    n_colors: int
    n_regions: int
    palette: list[PaintEntry] = field(default_factory=list)
    files: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        d = asdict(self)
        d["total_paint_ml"] = round(sum(p.paint_ml for p in self.palette), 2)
        return d


# ----------------------------------------------------------------------------- utilitare culoare
def rgb_to_hex(rgb) -> str:
    return "#{:02x}{:02x}{:02x}".format(*[int(c) for c in rgb])


def rgb_to_cmyk(rgb) -> tuple:
    """Conversie naivă RGB->CMYK (0-100). Pentru tipar real folosiți un profil ICC (ex. FOGRA39)."""
    r, g, b = [c / 255.0 for c in rgb]
    k = 1 - max(r, g, b)
    if k >= 0.999:
        return (0, 0, 0, 100)
    c = (1 - r - k) / (1 - k)
    m = (1 - g - k) / (1 - k)
    y = (1 - b - k) / (1 - k)
    return tuple(int(round(v * 100)) for v in (c, m, y, k))


# ----------------------------------------------------------------------------- pași pipeline
def load_image(path_or_array, max_side: int) -> np.ndarray:
    """Returnează imagine RGB uint8, redimensionată ca latura maximă să fie max_side."""
    if isinstance(path_or_array, np.ndarray):
        img = path_or_array
    else:
        try:  # pozele iPhone vin în HEIC
            import pillow_heif  # type: ignore
            pillow_heif.register_heif_opener()
        except ImportError:
            pass
        pil = Image.open(path_or_array)
        # respectă orientarea EXIF (pozele de pe telefon vin des rotite)
        from PIL import ImageOps
        pil = ImageOps.exif_transpose(pil).convert("RGB")
        img = np.array(pil)
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def quantize(img: np.ndarray, n_colors: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """K-Means în Lab. Returnează (labels HxW int32, paleta RGB n x 3)."""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    rng = np.random.default_rng(seed)
    sample = lab[rng.choice(len(lab), size=min(len(lab), 60_000), replace=False)]
    km = MiniBatchKMeans(n_clusters=n_colors, random_state=seed, n_init=3, batch_size=4096)
    km.fit(sample)
    labels = km.predict(lab).reshape(img.shape[:2]).astype(np.int32)
    centers = km.cluster_centers_
    return labels, _lab_to_rgb(centers), centers


def _lab_to_rgb(centers_lab: np.ndarray) -> np.ndarray:
    c = np.clip(centers_lab, 0, 255).astype(np.uint8).reshape(-1, 1, 3)
    return cv2.cvtColor(c, cv2.COLOR_LAB2RGB).reshape(-1, 3)


def merge_similar_colors(labels, centers_lab, min_delta_e: float):
    """Unește greedy clusterele cu ΔE < prag (OpenCV Lab 8-bit: L scalat 0-255 -> îl readucem la 0-100)."""
    scale = np.array([100 / 255, 1, 1])
    lab = centers_lab * scale
    counts = np.bincount(labels.ravel(), minlength=len(lab)).astype(float)
    target = np.arange(len(lab))
    for i in np.argsort(-counts):            # culorile dominante "înghit" vecinele apropiate
        if target[i] != i:
            continue
        for j in range(len(lab)):
            if j != i and target[j] == j and counts[j] <= counts[i] and np.linalg.norm(lab[i] - lab[j]) < min_delta_e:
                target[j] = i
    return target[labels], _lab_to_rgb(centers_lab)


def majority_filter(labels: np.ndarray, n: int, ksize: int = 5) -> np.ndarray:
    """Fiecare pixel ia eticheta dominantă din vecinătate -> margini mai netede."""
    best = np.zeros(labels.shape, np.float32)
    out = labels.copy()
    kernel = np.ones((ksize, ksize), np.float32)
    for c in range(n):
        votes = cv2.filter2D((labels == c).astype(np.float32), -1, kernel, borderType=cv2.BORDER_REPLICATE)
        better = votes > best
        best[better] = votes[better]
        out[better] = c
    return out


def merge_small_regions(labels: np.ndarray, n: int, min_px: int, max_iter: int = 6) -> np.ndarray:
    """Absoarbe componentele conexe < min_px în culoarea vecină dominantă."""
    labels = labels.copy()
    k3 = np.ones((3, 3), np.uint8)
    for _ in range(max_iter):
        changed = 0
        for c in range(n):
            mask = (labels == c).astype(np.uint8)
            if not mask.any():
                continue
            cnt, comp, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
            for i in range(1, cnt):
                if stats[i, cv2.CC_STAT_AREA] >= min_px:
                    continue
                x, y, w, h = stats[i, :4]
                x0, y0 = max(x - 1, 0), max(y - 1, 0)
                x1, y1 = min(x + w + 1, labels.shape[1]), min(y + h + 1, labels.shape[0])
                sub_comp = comp[y0:y1, x0:x1] == i
                ring = cv2.dilate(sub_comp.astype(np.uint8), k3).astype(bool) & ~sub_comp
                neigh = labels[y0:y1, x0:x1][ring]
                neigh = neigh[neigh != c]
                if neigh.size == 0:
                    continue
                labels[y0:y1, x0:x1][sub_comp] = np.bincount(neigh).argmax()
                changed += 1
        if changed == 0:
            break
    return labels


def boundary_mask(labels: np.ndarray) -> np.ndarray:
    """Pixelii unde eticheta diferă de vecinul din dreapta/jos = linie de contur."""
    b = np.zeros(labels.shape, bool)
    b[:, :-1] |= labels[:, :-1] != labels[:, 1:]
    b[:-1, :] |= labels[:-1, :] != labels[1:, :]
    return b


@dataclass
class Region:
    color: int
    contours: list            # liste de puncte (exterior + găuri)
    label_xy: tuple           # poziția numărului (px)
    label_r: float            # raza cercului inscriptibil (px) -> mărimea fontului
    area: int


def extract_regions(labels: np.ndarray, n: int) -> list[Region]:
    regions: list[Region] = []
    for c in range(n):
        mask = (labels == c).astype(np.uint8)
        cnt, comp = cv2.connectedComponents(mask, connectivity=4)
        for i in range(1, cnt):
            m = (comp == i).astype(np.uint8)
            area = int(m.sum())
            contours, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            contours = [cv2.approxPolyDP(ct, 0.8, True).reshape(-1, 2) for ct in contours if len(ct) >= 3]
            # pol de inaccesibilitate: maximul distance transform (bordat cu 0 ca marginea imaginii să conteze)
            dist = cv2.distanceTransform(np.pad(m, 1), cv2.DIST_L2, 5)[1:-1, 1:-1]
            _, maxv, _, maxloc = cv2.minMaxLoc(dist)
            regions.append(Region(c, contours, maxloc, float(maxv), area))
    return regions


# ----------------------------------------------------------------------------- export
def _font(size: int):
    for name in ("DejaVuSans.ttf", "Arial.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def write_svg(path: Path, regions: list[Region], palette, w: int, h: int, cfg: PBNConfig,
              filled: bool = False) -> None:
    """SVG la dimensiunea fizică a pânzei (mm). filled=True -> previzualizare vectorială colorată."""
    wmm, hmm = cfg.canvas_width_cm * 10, cfg.canvas_height_cm * 10
    sx = wmm / w
    stroke = cfg.line_width_mm / sx  # grosimea liniei în unități viewBox (px)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{wmm:.1f}mm" height="{hmm:.1f}mm" '
           f'viewBox="0 0 {w} {h}">',
           '<rect width="100%" height="100%" fill="#ffffff"/>',
           f'<g fill-rule="evenodd" stroke="{cfg.line_color}" stroke-width="{stroke:.3f}" stroke-linejoin="round">']
    for r in regions:
        d = " ".join("M" + " L".join(f"{x},{y}" for x, y in ct) + " Z" for ct in r.contours)
        fill = rgb_to_hex(palette[r.color]) if filled else "none"
        out.append(f'<path d="{d}" fill="{fill}"/>')
    out.append("</g>")
    if not filled:
        out.append(f'<g font-family="Helvetica,Arial,sans-serif" fill="{cfg.line_color}" '
                   f'text-anchor="middle" dominant-baseline="central">')
        for r in regions:
            if r.label_r < 2.5:      # zonă prea îngustă pentru un număr lizibil
                continue
            fs = max(3.0, min(r.label_r * 1.1, 14.0))
            out.append(f'<text x="{r.label_xy[0]}" y="{r.label_xy[1]}" font-size="{fs:.1f}">{r.color + 1}</text>')
        out.append("</g>")
    out.append("</svg>")
    path.write_text("\n".join(out), encoding="utf-8")


def render_outline_png(regions, labels, palette, cfg, scale: int = 2) -> Image.Image:
    """Varianta raster a schiței (util pentru plottere care nu iau SVG, și pentru QA vizual)."""
    h, w = labels.shape
    b = boundary_mask(labels)
    b = cv2.resize(b.astype(np.uint8) * 255, (w * scale, h * scale), interpolation=cv2.INTER_NEAREST)
    img = Image.fromarray(255 - (b // 255) * (255 - 160)).convert("RGB")
    draw = ImageDraw.Draw(img)
    for r in regions:
        if r.label_r < 2.5:
            continue
        fs = int(max(7, min(r.label_r * 1.1 * scale, 28)))
        draw.text((r.label_xy[0] * scale, r.label_xy[1] * scale), str(r.color + 1),
                  fill=(150, 150, 150), font=_font(fs), anchor="mm")
    return img


def render_preview(labels, palette) -> Image.Image:
    """Cum va arăta tabloul pictat (fără linii)."""
    return Image.fromarray(palette[labels].astype(np.uint8))


def render_mockup(preview: Image.Image, size=(1200, 1200)) -> Image.Image:
    """Mockup simplu: tablou pe perete, cu ramă și umbră. Înlocuiți cu mockup-uri PSD reale la nevoie."""
    bg = Image.new("RGB", size, (236, 231, 224))
    pw = int(size[0] * 0.62)
    ph = int(pw * preview.height / preview.width)
    if ph > size[1] * 0.75:
        ph = int(size[1] * 0.75)
        pw = int(ph * preview.width / preview.height)
    art = preview.resize((pw, ph), Image.LANCZOS)
    frame = 18
    framed = Image.new("RGB", (pw + 2 * frame, ph + 2 * frame), (58, 42, 30))
    framed.paste(art, (frame, frame))
    x, y = (size[0] - framed.width) // 2, int((size[1] - framed.height) * 0.42)
    shadow = Image.new("L", size, 0)
    ImageDraw.Draw(shadow).rectangle([x + 14, y + 22, x + framed.width + 14, y + framed.height + 22], fill=120)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    bg.paste((0, 0, 0), mask=shadow.point(lambda v: v * 0.5))
    bg.paste(framed, (x, y))
    return bg


def paint_recipe(labels, palette, regions, cfg: PBNConfig) -> list[PaintEntry]:
    h, w = labels.shape
    cm2_per_px = (cfg.canvas_width_cm * cfg.canvas_height_cm) / (w * h)
    counts = np.bincount(labels.ravel(), minlength=len(palette))
    reg_count = np.bincount([r.color for r in regions], minlength=len(palette))
    entries = []
    for c, px in enumerate(counts):
        if px == 0:
            continue
        cm2 = px * cm2_per_px
        ml = max(cfg.min_ml_per_pot, cm2 * cfg.ml_per_cm2 * cfg.coats * cfg.waste_factor)
        pot = next((s for s in cfg.pot_sizes_ml if s >= ml), math.ceil(ml))
        rgb = tuple(int(v) for v in palette[c])
        entries.append(PaintEntry(c + 1, rgb_to_hex(rgb), rgb, rgb_to_cmyk(rgb), int(px),
                                  round(cm2, 1), round(100 * px / (w * h), 2), round(ml, 2), pot,
                                  int(reg_count[c])))
    return entries


def relabel_compact(labels: np.ndarray, palette: np.ndarray):
    """Elimină culorile dispărute după curățare și ordonează paleta de la deschis la închis."""
    used = np.unique(labels)
    lum = palette[used] @ np.array([0.299, 0.587, 0.114])
    order = used[np.argsort(-lum)]
    remap = np.zeros(len(palette), np.int32)
    remap[order] = np.arange(len(order))
    return remap[labels], palette[order]


# ----------------------------------------------------------------------------- API public
def process(src, out_dir: str | Path, cfg: PBNConfig | None = None, mockup: bool = True) -> PBNResult:
    cfg = cfg or PBNConfig()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    img = load_image(src, cfg.max_side_px)
    img = cv2.bilateralFilter(img, cfg.smoothing, 40, 40)
    labels, palette, centers = quantize(img, cfg.n_colors, cfg.seed)
    if cfg.min_delta_e > 0:
        labels, palette = merge_similar_colors(labels, centers, cfg.min_delta_e)
    for _ in range(cfg.majority_passes):
        labels = majority_filter(labels, cfg.n_colors)
    min_px = cfg.min_region_px or max(20, int(labels.size * 0.0002))
    labels = merge_small_regions(labels, cfg.n_colors, min_px)
    labels, palette = relabel_compact(labels, palette)
    n = len(palette)

    regions = extract_regions(labels, n)
    h, w = labels.shape

    files = {
        "canvas_svg": out / "canvas.svg",
        "preview_svg": out / "preview.svg",
        "outline_png": out / "outline.png",
        "preview_png": out / "preview.png",
        "recipe_json": out / "recipe.json",
    }
    write_svg(files["canvas_svg"], regions, palette, w, h, cfg, filled=False)
    write_svg(files["preview_svg"], regions, palette, w, h, cfg, filled=True)
    render_outline_png(regions, labels, palette, cfg).save(files["outline_png"])
    preview = render_preview(labels, palette)
    preview.save(files["preview_png"])
    if mockup:
        files["mockup_jpg"] = out / "mockup.jpg"
        render_mockup(preview).save(files["mockup_jpg"], quality=88)

    # PDF de producție, opțional (pip install cairosvg)
    try:
        import cairosvg  # type: ignore
        files["canvas_pdf"] = out / "canvas.pdf"
        cairosvg.svg2pdf(url=str(files["canvas_svg"]), write_to=str(files["canvas_pdf"]))
    except Exception:
        pass

    result = PBNResult(w, h, n, len(regions), paint_recipe(labels, palette, regions, cfg),
                       {k: v.name for k, v in files.items()})
    payload = result.to_json()
    payload["canvas_cm"] = [cfg.canvas_width_cm, cfg.canvas_height_cm]
    files["recipe_json"].write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def main():
    ap = argparse.ArgumentParser(description="Generează kit Paint-by-Numbers dintr-o fotografie")
    ap.add_argument("image")
    ap.add_argument("out_dir")
    ap.add_argument("--colors", type=int, default=24)
    ap.add_argument("--width-cm", type=float, default=40)
    ap.add_argument("--height-cm", type=float, default=50)
    ap.add_argument("--max-side", type=int, default=1600)
    a = ap.parse_args()
    cfg = PBNConfig(n_colors=a.colors, canvas_width_cm=a.width_cm, canvas_height_cm=a.height_cm,
                    max_side_px=a.max_side)
    r = process(a.image, a.out_dir, cfg)
    print(f"OK: {r.n_colors} culori, {r.n_regions} zone, {sum(p.paint_ml for p in r.palette):.1f} ml vopsea -> {a.out_dir}")


if __name__ == "__main__":
    main()

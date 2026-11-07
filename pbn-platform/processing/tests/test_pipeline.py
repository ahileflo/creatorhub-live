"""Teste end-to-end pentru motorul PBN (rulează în ~10 s pe o imagine sintetică)."""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET

import numpy as np
import pytest

from pbn_engine import ProcessingConfig, generate
from pbn_engine.paint import rgb_to_cmyk_naive
from pbn_engine.regions import extract_regions

SVG_NS = "{http://www.w3.org/2000/svg}"


def synthetic_image(h=300, w=240, seed=0) -> np.ndarray:
    """Gradient + forme geometrice + zgomot: simulează o fotografie."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w]
    img = np.stack([xx / w * 255, yy / h * 255, (1 - xx / w) * 200], -1)
    img[60:140, 40:120] = (220, 40, 40)                    # pătrat roșu
    img[((yy - 200) ** 2 + (xx - 160) ** 2) < 45 ** 2] = (30, 30, 160)  # disc albastru
    img += rng.normal(0, 8, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


@pytest.fixture(scope="module")
def result(tmp_path_factory):
    cfg = ProcessingConfig(num_colors=12, canvas_width_mm=200, canvas_height_mm=250,
                           px_per_mm=3.0, export_pdf=False)
    return generate(synthetic_image(), tmp_path_factory.mktemp("out"), cfg, title="Test"), cfg


def test_all_files_written(result):
    res, _ = result
    for name in res.files.values():
        assert (res.output_dir / name).stat().st_size > 0


def test_palette_size_and_order(result):
    res, cfg = result
    colors = res.recipe["colors"]
    assert 2 <= len(colors) <= cfg.num_colors
    assert [c["number"] for c in colors] == list(range(1, len(colors) + 1))
    lightness = [c["lab"][0] for c in colors]
    assert lightness == sorted(lightness, reverse=True)  # 1 = cea mai deschisă


def test_recipe_area_and_paint(result):
    res, cfg = result
    colors = res.recipe["colors"]
    w, h = cfg.work_size_px
    assert sum(c["area_px"] for c in colors) == w * h
    assert abs(sum(c["area_cm2"] for c in colors) - 20 * 25) < 0.5
    for c in colors:
        assert c["paint_ml"] >= cfg.paint.min_ml
        assert c["pot_ml"] >= c["paint_ml"]


def test_svg_is_valid_and_numbered(result):
    res, _ = result
    root = ET.parse(res.output_dir / "canvas.svg").getroot()
    assert root.get("width") == "200mm"
    paths = root.findall(f".//{SVG_NS}path")
    texts = root.findall(f".//{SVG_NS}text")
    assert len(paths) == len(texts) == res.stats["num_regions"]
    n_colors = res.stats["num_colors_final"]
    assert all(1 <= int(t.text) <= n_colors for t in texts)


def test_manifest_stats(result):
    res, _ = result
    manifest = json.loads((res.output_dir / "manifest.json").read_text())
    assert manifest["stats"]["num_regions"] > 0
    assert manifest["stats"]["difficulty"] in {"ușor", "mediu", "avansat", "expert"}


def test_label_inside_concave_region():
    """Pentru o formă „C", centroidul cade în gol: eticheta trebuie să fie în interior."""
    labels = np.zeros((100, 100), np.int32)
    labels[10:90, 10:90] = 1
    labels[30:70, 30:95] = 0  # golul literei C (deschis spre dreapta)
    regions, region_map = extract_regions(labels, 2)
    c_region = next(r for r in regions if r.color_index == 1)
    x, y = c_region.label_xy
    assert region_map[int(y), int(x)] == c_region.region_id


def test_cmyk_naive():
    assert rgb_to_cmyk_naive((0, 0, 0)) == [0.0, 0.0, 0.0, 100.0]
    assert rgb_to_cmyk_naive((255, 255, 255)) == [0.0, 0.0, 0.0, 0.0]


def test_rejects_unsupported_color_count():
    with pytest.raises(ValueError):
        ProcessingConfig(num_colors=25)

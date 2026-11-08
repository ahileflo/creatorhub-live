import json

import cv2
import numpy as np
import pytest

from pbn.engine.pbn import PBNConfig, process, rgb_to_cmyk, rgb_to_hex


@pytest.fixture
def landscape(tmp_path):
    h, w = 300, 400
    img = np.zeros((h, w, 3), np.uint8)
    img[:] = (130, 180, 235)
    img[180:] = (60, 140, 60)
    cv2.circle(img, (300, 70), 35, (250, 220, 90), -1)
    cv2.fillPoly(img, [np.array([[50, 190], [160, 80], [270, 190]])], (100, 95, 90))
    p = tmp_path / "in.png"
    cv2.imwrite(str(p), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    return p


def test_full_pipeline(landscape, tmp_path):
    out = tmp_path / "out"
    r = process(landscape, out, PBNConfig(n_colors=8, canvas_width_cm=30, canvas_height_cm=40))
    for f in ("canvas.svg", "preview.svg", "outline.png", "preview.png", "recipe.json", "mockup.jpg"):
        assert (out / f).exists(), f
    recipe = json.loads((out / "recipe.json").read_text())
    # 4 culori clare în imagine -> între 4 și 8 culori după curățare
    assert 4 <= recipe["n_colors"] <= 8
    assert sum(p["coverage_pct"] for p in recipe["palette"]) == pytest.approx(100, abs=0.2)
    assert all(p["pot_ml"] >= p["paint_ml"] for p in recipe["palette"])
    svg = (out / "canvas.svg").read_text()
    assert svg.startswith("<svg") and 'width="300.0mm"' in svg and "<text" in svg


def test_color_helpers():
    assert rgb_to_hex((255, 0, 16)) == "#ff0010"
    assert rgb_to_cmyk((0, 0, 0)) == (0, 0, 0, 100)
    assert rgb_to_cmyk((255, 255, 255)) == (0, 0, 0, 0)

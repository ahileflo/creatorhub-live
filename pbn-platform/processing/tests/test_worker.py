"""Teste fără infrastructură pentru pbn_worker (DB/Redis sunt acoperite de testul de integrare din api/)."""
import pytest

from pbn_worker.storage import LocalStorage
from pbn_worker.worker import JobProcessor


def test_build_config_accepts_api_params():
    cfg = JobProcessor.build_config(
        {"num_colors": 36, "canvas_width_mm": 300, "canvas_height_mm": 400, "fit": "pad"})
    assert (cfg.num_colors, cfg.canvas_width_mm, cfg.fit) == (36, 300, "pad")


def test_build_config_rejects_unknown_params():
    # API-ul nu poate seta parametri interni (ex. px_per_mm uriaș => OOM în worker).
    with pytest.raises(ValueError):
        JobProcessor.build_config({"num_colors": 24, "px_per_mm": 50})


def test_local_storage_roundtrip_and_traversal(tmp_path):
    s = LocalStorage(str(tmp_path))
    s.put_object("artifacts", "orders/o/jobs/j/canvas.svg", b"<svg/>", "image/svg+xml")
    assert s.get_object("artifacts", "orders/o/jobs/j/canvas.svg") == b"<svg/>"
    with pytest.raises(ValueError):
        s.get_object("artifacts", "../../etc/passwd")

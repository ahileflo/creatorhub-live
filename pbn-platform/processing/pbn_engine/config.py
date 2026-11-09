"""
Configurarea motorului de procesare Paint-by-Numbers.

Toți parametrii „fizici" sunt exprimați în milimetri (dimensiunea reală a pânzei),
iar conversia în pixeli se face o singură dată, aici. Astfel, aceeași configurație
produce rezultate consistente indiferent de rezoluția imaginii sursă.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal, Tuple

# Numerele de culori pe care le vindem ca produs (nivele de dificultate).
SUPPORTED_COLOR_COUNTS: Tuple[int, ...] = (12, 18, 24, 30, 36, 48, 60)


@dataclass(frozen=True)
class PaintConfig:
    """Parametrii modelului de consum de vopsea acrilică."""

    # Grosimea filmului umed per strat. Un strat subțire de acrilic pentru PBN
    # are ~0.06–0.10 mm. 1 cm² × 0.008 cm = 0.008 ml.
    wet_film_mm: float = 0.08
    # Numărul de straturi pentru o acoperire opacă pe pânză albă cu contur gri.
    coats: int = 2
    # Culorile foarte deschise (L* mare) au putere de acoperire mai slabă:
    # primesc un strat suplimentar.
    extra_coat_above_lightness: float = 78.0
    # Pierderi: vopsea rămasă pe pensulă, în capac, uscată în recipient.
    waste_factor: float = 0.20
    # Cantitatea minimă livrată per culoare (nu umplem recipiente sub atât).
    min_ml: float = 1.5
    # Mărimile de recipiente disponibile la furnizor (ml).
    pot_sizes_ml: Tuple[float, ...] = (3.0, 5.0, 10.0, 20.0, 50.0)


@dataclass(frozen=True)
class ProcessingConfig:
    """Configurația completă a unui job de generare PBN."""

    num_colors: int = 24

    # Dimensiunea fizică a pânzei (produsul vândut).
    canvas_width_mm: float = 400.0
    canvas_height_mm: float = 500.0
    # Rezoluția de lucru. 4 px/mm ≈ 100 DPI: suficient pentru contururi,
    # deoarece ieșirea finală este vectorială (SVG/PDF) și se scalează fără pierderi.
    px_per_mm: float = 4.0
    # "crop" = decupare centrală la raportul pânzei; "pad" = margini albe.
    fit: Literal["crop", "pad"] = "crop"

    # --- Pre-procesare -----------------------------------------------------
    # Filtru bilateral: netezește texturile (piele, iarbă) păstrând marginile.
    bilateral_diameter: int = 9
    bilateral_sigma_color: float = 60.0
    bilateral_sigma_space: float = 60.0
    bilateral_passes: int = 2

    # --- K-Means --------------------------------------------------------------
    kmeans_sample_size: int = 80_000  # pixeli eșantionați pentru antrenare
    random_seed: int = 42             # determinism: același input => același output

    # --- Curățarea regiunilor -------------------------------------------------
    majority_filter_size: int = 5
    majority_filter_passes: int = 2
    # O zonă mai mică de atât nu poate fi pictată / numerotată lizibil.
    min_region_mm2: float = 8.0
    # Raza maximă înscrisă minimă: elimină „fâșiile" subțiri de 1–2 px.
    min_clearance_mm: float = 0.6
    cleanup_max_iterations: int = 8

    # --- Vectorizare ----------------------------------------------------------
    contour_simplify_tolerance_px: float = 0.6
    line_width_mm: float = 0.20
    line_color: str = "#8f8f8f"
    number_color: str = "#6f6f6f"
    font_min_mm: float = 1.6
    font_max_mm: float = 6.0
    font_family: str = "Arial, Helvetica, sans-serif"

    # --- Ieșiri ---------------------------------------------------------------
    export_pdf: bool = True
    mockup_max_side_px: int = 1600

    paint: PaintConfig = field(default_factory=PaintConfig)

    # ------------------------------------------------------------------------
    def __post_init__(self) -> None:
        if self.num_colors not in SUPPORTED_COLOR_COUNTS:
            raise ValueError(
                f"num_colors={self.num_colors} nu este suportat; "
                f"valori permise: {SUPPORTED_COLOR_COUNTS}"
            )
        if self.canvas_width_mm <= 0 or self.canvas_height_mm <= 0:
            raise ValueError("Dimensiunile pânzei trebuie să fie pozitive.")
        if not (1.0 <= self.px_per_mm <= 12.0):
            raise ValueError("px_per_mm trebuie să fie între 1 și 12.")

    # --- Valori derivate (mm -> px) -------------------------------------------
    @property
    def work_size_px(self) -> Tuple[int, int]:
        """(lățime, înălțime) a imaginii de lucru, în pixeli."""
        return (
            int(round(self.canvas_width_mm * self.px_per_mm)),
            int(round(self.canvas_height_mm * self.px_per_mm)),
        )

    @property
    def min_region_px(self) -> int:
        return max(4, int(round(self.min_region_mm2 * self.px_per_mm ** 2)))

    @property
    def min_clearance_px(self) -> float:
        return self.min_clearance_mm * self.px_per_mm

    def mm_to_px(self, mm: float) -> float:
        return mm * self.px_per_mm

    def to_dict(self) -> dict:
        return asdict(self)

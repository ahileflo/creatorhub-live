"""pbn_engine — motorul de generare Paint-by-Numbers (K-Means, contururi, rețetă)."""

__version__ = "0.1.0"

from .config import PaintConfig, ProcessingConfig, SUPPORTED_COLOR_COUNTS  # noqa: E402
from .pipeline import GenerationResult, generate  # noqa: E402

__all__ = [
    "PaintConfig",
    "ProcessingConfig",
    "SUPPORTED_COLOR_COUNTS",
    "GenerationResult",
    "generate",
]

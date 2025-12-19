from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np


class YoloDetector:
    """Lightweight placeholder for YOLOv8 integration.

    The class exposes a detect method that would normally interface with
    Ultralytics' YOLOv8 model. In this sandbox we simply return mocked
    detections, enabling the API and UI to behave as if a model were running.
    """

    def __init__(self, model_path: str | Path | None = None) -> None:
        self.model_path = Path(model_path) if model_path else None

    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        height, width, _ = frame.shape
        return {
            "boxes": [
                {
                    "x1": int(width * 0.1),
                    "y1": int(height * 0.1),
                    "x2": int(width * 0.3),
                    "y2": int(height * 0.5),
                    "label": "bag",
                    "confidence": 0.92,
                }
            ],
            "meta": {"model": str(self.model_path) if self.model_path else "mock", "height": height, "width": width},
        }

    def warmup(self) -> Tuple[int, int]:
        """Pretend to run a warmup pass for start-up readiness."""

        dummy_frame = np.zeros((640, 480, 3), dtype=np.uint8)
        result = self.detect(dummy_frame)
        return result["meta"]["height"], result["meta"]["width"]

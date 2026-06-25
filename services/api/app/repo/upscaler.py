"""Real-ESRGAN / GFPGAN engine adapter.

This is the external-model boundary, kept in repo/ like the B2 client. The
heavy ML stack (torch, realesrgan, gfpgan, basicsr, opencv, imageio-ffmpeg)
lives ONLY in services/api/requirements-restore.txt and is **lazy-imported
inside functions** — mirroring how service/metadata.py imports PIL/PyPDF2 —
so `from main import app`, the test suite, lint, and `pnpm build` all work
without the stack installed. Only an actual restoration run needs it.

Real-ESRGAN is the only engine. There is no classical fallback: a sample
themed on Real-ESRGAN must use Real-ESRGAN. If the stack is missing we raise
a clear, actionable error pointing at requirements-restore.txt.
"""

import logging

logger = logging.getLogger(__name__)

INSTALL_HINT = (
    "The restoration engine is not installed. Install the heavy ML stack "
    "with: pip install -r services/api/requirements-restore.txt "
    "(torch, realesrgan, gfpgan, basicsr, opencv-python-headless, "
    "imageio-ffmpeg). Storage, the UI, and all other B2 features work "
    "without it — only running a restoration requires it."
)

# Real-ESRGAN x4plus weights. Auto-downloaded on first use to the realesrgan
# weights cache; pinned here so the source/feature docs stay accurate.
_MODEL_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
    "v0.1.0/RealESRGAN_x4plus.pth"
)


class EngineUnavailableError(RuntimeError):
    """Raised when a restoration run is attempted without the ML stack."""


def _install_functional_tensor_shim() -> None:
    """Work around basicsr importing torchvision.transforms.functional_tensor.

    `functional_tensor` was removed in torchvision >= 0.17, but basicsr (a
    realesrgan/gfpgan dependency) still imports it at module load. We alias
    the new module path under the old name before importing the engine so
    the import succeeds regardless of the installed torchvision version.
    Documented in the README + restoration-jobs feature doc.
    """
    import importlib
    import sys

    if "torchvision.transforms.functional_tensor" in sys.modules:
        return
    try:
        functional = importlib.import_module("torchvision.transforms.functional")
        sys.modules["torchvision.transforms.functional_tensor"] = functional
    except ImportError:
        # torchvision itself missing — the real import below raises the
        # actionable EngineUnavailableError, so nothing to do here.
        pass


def engine_available() -> bool:
    """True if the heavy ML stack can be imported. Never raises."""
    import importlib.util

    return all(
        importlib.util.find_spec(mod) is not None
        for mod in ("torch", "realesrgan", "cv2", "numpy")
    )


def _build_upscaler(scale: int, face_restore: bool):
    """Construct the Real-ESRGAN (+ optional GFPGAN) pipeline. Lazy imports."""
    _install_functional_tensor_shim()
    try:
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
    except ImportError as e:
        raise EngineUnavailableError(INSTALL_HINT) from e

    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=4,
    )
    upsampler = RealESRGANer(
        scale=4,
        model_path=_MODEL_URL,
        model=model,
        tile=256,
        tile_pad=10,
        pre_pad=0,
        half=False,
    )

    face_enhancer = None
    if face_restore:
        try:
            from gfpgan import GFPGANer

            face_enhancer = GFPGANer(
                model_path=(
                    "https://github.com/TencentARC/GFPGAN/releases/"
                    "download/v1.3.0/GFPGANv1.3.pth"
                ),
                upscale=scale,
                arch="clean",
                channel_multiplier=2,
                bg_upsampler=upsampler,
            )
        except ImportError as e:
            raise EngineUnavailableError(INSTALL_HINT) from e

    return upsampler, face_enhancer


def upscale_image(
    image_bytes: bytes, scale: int, face_restore: bool
) -> tuple[bytes, int, int, int]:
    """Upscale a single image. Returns (png_bytes, width, height, faces).

    `faces` is the count of faces enhanced by GFPGAN (0 when face_restore
    is off or no faces are detected). Raises EngineUnavailableError when the
    ML stack is missing.
    """
    if not engine_available():
        raise EngineUnavailableError(INSTALL_HINT)

    import cv2
    import numpy as np

    upsampler, face_enhancer = _build_upscaler(scale, face_restore)

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode source image bytes")

    faces = 0
    if face_enhancer is not None:
        cropped, _restored, output = face_enhancer.enhance(
            img, has_aligned=False, only_center_face=False, paste_back=True
        )
        faces = len(cropped) if cropped is not None else 0
    else:
        output, _ = upsampler.enhance(img, outscale=scale)

    height, width = output.shape[:2]
    ok, buf = cv2.imencode(".png", output)
    if not ok:
        raise RuntimeError("Failed to encode restored image")
    return buf.tobytes(), int(width), int(height), faces

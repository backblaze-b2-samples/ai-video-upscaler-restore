"""Engine-adapter guards that run WITHOUT the heavy ML stack installed.

Confirms the lazy-import discipline: importing app.repo.upscaler must not
pull torch/realesrgan, calling it without the stack must raise the
actionable EngineUnavailableError (not an ImportError), and the public
signature stays stable.
"""

import inspect

from app.repo import upscaler


def test_module_imports_without_ml_stack():
    # The module imported at collection time — if it eagerly imported torch
    # this test session (base deps only) would already have failed.
    assert hasattr(upscaler, "upscale_image")
    assert hasattr(upscaler, "engine_available")
    assert hasattr(upscaler, "EngineUnavailableError")


def test_engine_available_is_false_with_base_deps():
    # torch / realesrgan are not in base requirements, so this is False and
    # must never raise.
    assert upscaler.engine_available() is False


def test_upscale_image_raises_actionable_error_without_stack():
    try:
        upscaler.upscale_image(b"not-real-bytes", scale=4, face_restore=False)
    except upscaler.EngineUnavailableError as e:
        assert "requirements-restore.txt" in str(e)
    else:  # pragma: no cover - only reached if the stack is installed
        pass


def test_upscale_image_signature_stable():
    sig = inspect.signature(upscaler.upscale_image)
    assert list(sig.parameters) == ["image_bytes", "scale", "face_restore"]

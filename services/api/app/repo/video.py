"""Video frame extraction / reassembly via the imageio-ffmpeg bundled binary.

We deliberately use the ffmpeg binary that ships *inside* imageio-ffmpeg
(`imageio_ffmpeg.get_ffmpeg_exe()`) rather than a system `ffmpeg`. A system
ffmpeg may be a slim build missing filters/codecs, and requiring users to
install one is exactly the friction this sample avoids. All imports are lazy
so the base (engine-free) install still imports this module.

Part of the repo/ layer: this is an external-tool boundary like the B2
client and the model adapter.
"""

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def _ffmpeg_exe() -> str:
    """Resolve the bundled ffmpeg binary. Raises if imageio-ffmpeg absent."""
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as e:
        from app.repo.upscaler import INSTALL_HINT

        raise RuntimeError(INSTALL_HINT) from e


def probe_fps(video_path: Path) -> float:
    """Best-effort source frame rate. Falls back to 24 fps."""
    exe = _ffmpeg_exe()
    try:
        result = subprocess.run(
            [exe, "-i", str(video_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        for token in result.stderr.split(","):
            if "fps" in token:
                return float(token.strip().split(" ")[0])
    except (ValueError, OSError):
        logger.warning("fps probe failed; defaulting to 24", exc_info=True)
    return 24.0


def extract_frames(video_path: Path, frames_dir: Path) -> list[Path]:
    """Extract every frame of `video_path` as PNGs into `frames_dir`."""
    exe = _ffmpeg_exe()
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(frames_dir / "frame_%06d.png")
    subprocess.run(
        [exe, "-y", "-i", str(video_path), pattern],
        capture_output=True,
        check=True,
    )
    return sorted(frames_dir.glob("frame_*.png"))


def assemble_video(
    frames_dir: Path, output_path: Path, fps: float, frame_glob: str
) -> None:
    """Reassemble restored frames (matching `frame_glob`) into an mp4."""
    exe = _ffmpeg_exe()
    subprocess.run(
        [
            exe,
            "-y",
            "-framerate",
            str(fps),
            "-pattern_type",
            "glob",
            "-i",
            str(frames_dir / frame_glob),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
        capture_output=True,
        check=True,
    )

"""Build the backend into a standalone executable using PyInstaller."""

import subprocess
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC_FILE = ROOT / "backend.spec"
DIST_DIR = ROOT / "dist" / "backend-dist"


def expected_backend_names():
    primary = "backend.exe" if sys.platform.startswith("win") else "backend"
    fallback = "backend" if primary == "backend.exe" else "backend.exe"
    return [primary, fallback]


def main():
    if not ((3, 10) <= sys.version_info[:2] < (3, 13)):
        print(
            "[build-backend] ERROR: Backend packaging requires Python 3.10, 3.11, or 3.12. "
            f"Current Python is {sys.version.split()[0]}.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Ensure all dependencies are installed
    req_file = ROOT / "backend" / "requirements.txt"
    if req_file.exists():
        print("[build-backend] Installing backend requirements...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(req_file),
        ])

    # Ensure PyInstaller is installed
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("[build-backend] Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # Clean previous build
    if DIST_DIR.exists():
        print(f"[build-backend] Cleaning {DIST_DIR}")
        shutil.rmtree(DIST_DIR)

    # Run PyInstaller
    print("[build-backend] Running PyInstaller...")
    result = subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            str(SPEC_FILE),
            "--distpath", str(ROOT / "dist"),
            "--workpath", str(ROOT / "build"),
            "--noconfirm",
        ],
        cwd=str(ROOT),
    )

    if result.returncode != 0:
        print("[build-backend] PyInstaller failed!", file=sys.stderr)
        sys.exit(1)

    # Verify output. PyInstaller uses "backend.exe" on Windows and "backend"
    # on macOS/Linux even though the same spec name is used.
    exe_path = next((DIST_DIR / name for name in expected_backend_names() if (DIST_DIR / name).exists()), None)
    if exe_path is None:
        expected = ", ".join(str(DIST_DIR / name) for name in expected_backend_names())
        print(f"[build-backend] ERROR: backend executable not found. Expected one of: {expected}", file=sys.stderr)
        sys.exit(1)

    size_mb = exe_path.stat().st_size / (1024 * 1024)
    print(f"[build-backend] Success: {exe_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()

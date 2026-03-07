# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Game Translator backend."""

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

backend_submodules = collect_submodules("backend")

a = Analysis(
    ["backend/main.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        *backend_submodules,
        # uvicorn internals
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # starlette / fastapi
        "starlette",
        "starlette.responses",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        "starlette.staticfiles",
        # async DB
        "aiosqlite",
        # multipart form parsing
        "multipart",
        "python_multipart",
        # network / image / android
        "httpx",
        "PIL",
        "pyaxmlparser",
        # pydantic
        "pydantic",
        # email-validator (optional for pydantic)
        "email_validator",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "scipy",
        "numpy",
        "pandas",
        "pytest",
    ],
    noarchive=False,
    optimize=0,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="backend-dist",
)

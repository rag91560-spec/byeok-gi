"""Novel/text library REST API."""

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from html import unescape
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db

router = APIRouter(prefix="/api/novels", tags=["novels"])
logger = logging.getLogger(__name__)

READABLE_EXTS = {".txt", ".md", ".markdown", ".log", ".csv", ".json", ".xml", ".html", ".htm", ".srt", ".vtt", ".ass", ".ssa", ".rpy", ".ks"}
SUPPORTED_EXTS = READABLE_EXTS | {".epub", ".pdf"}
MAX_CACHED_TEXT_CHARS = 1_000_000
MAX_SOURCE_READ_CHARS = 1_000_000
MAX_JSON_CHARS = 512_000
MAX_STYLE_RANGES = 5_000
GRANT_ACTION_FILE_IMPORT = "file-import"
GRANT_ACTION_FOLDER_SCAN = "folder-scan"
ALLOW_NOVEL_FOLDER_SCAN = os.environ.get("GT_ALLOW_NOVEL_FOLDER_SCAN") == "1"


class NovelCreate(BaseModel):
    title: str
    file_name: str = ""
    extension: str = ""
    source_path: str = ""
    content: str = ""
    preview: str = ""
    size: int = 0
    category_id: Optional[int] = None
    metadata_only: Optional[bool] = None
    translation_status: str = "original"
    translated_text_path: str = ""
    translation_project_id: Optional[int] = None
    content_style_json: str = '{"ranges":[]}'


class NovelUpdate(BaseModel):
    title: Optional[str] = None
    file_name: Optional[str] = None
    extension: Optional[str] = None
    source_path: Optional[str] = None
    content: Optional[str] = None
    preview: Optional[str] = None
    size: Optional[int] = None
    category_id: Optional[int] = None
    metadata_only: Optional[bool] = None
    translation_status: Optional[str] = None
    translated_text_path: Optional[str] = None
    translation_project_id: Optional[int] = None
    read_progress: Optional[float] = None
    last_opened_at: Optional[str] = None
    reader_settings_json: Optional[str] = None
    content_style_json: Optional[str] = None
    sort_order: Optional[int] = None


class BulkIdsRequest(BaseModel):
    ids: list[int]


class BulkMoveRequest(BaseModel):
    ids: list[int]
    category_id: Optional[int] = None


class ImportPathGrant(BaseModel):
    path: str
    source_grant: str = ""


class ImportPathsRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    items: list[ImportPathGrant] = Field(default_factory=list)
    category_id: Optional[int] = None


class ScanFolderRequest(BaseModel):
    path: str
    source_grant: str = ""
    category_id: Optional[int] = None
    parent_category_id: Optional[int] = None
    preserve_structure: bool = True


class ProgressUpdate(BaseModel):
    read_progress: float
    reader_settings_json: Optional[str] = None


def _extension(value: str) -> str:
    return os.path.splitext(value)[1].lower()


def _file_name(path: str) -> str:
    return os.path.basename(path.rstrip("\\/")) or path


def _title(path: str) -> str:
    return os.path.splitext(_file_name(path))[0] or _file_name(path)


def _preview(text: str) -> str:
    return " ".join(text.split())[:240]


def _plain_text_for_preview(text: str, extension: str) -> str:
    if extension in {".html", ".htm", ".xml"}:
        text = re.sub(r"(?i)<br\s*/?>", "\n", text)
        text = re.sub(r"(?i)</(?:p|div|li|h[1-6]|section|article)>", "\n", text)
        text = re.sub(r"(?is)<(?:script|style|noscript)[^>]*>.*?</(?:script|style|noscript)>", "", text)
        text = re.sub(r"<[^>]+>", "", text)
        text = unescape(text)
    text = re.sub(r"(?i)\[/?(?:color|colour|bg|background|size|b|i|u)(?:=[^\]]*)?\]", "", text)
    return text


def _public_novel(novel: dict | None) -> dict | None:
    if not novel:
        return novel
    public = dict(novel)
    public["source_path"] = ""
    public.pop("content", None)
    return public


def _public_novels(items: list[dict]) -> list[dict]:
    return [item for item in (_public_novel(item) for item in items) if item]


def _is_supported(path: str) -> bool:
    return _extension(path) in SUPPORTED_EXTS


def _is_readable(path: str) -> bool:
    return _extension(path) in READABLE_EXTS


def _stat_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _grant_secret() -> str:
    return os.environ.get("GT_IMPORT_GRANT_SECRET", "")


def _decode_grant_payload(payload_b64: str) -> dict:
    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    return json.loads(raw.decode("utf-8"))


async def _validate_source_grant(path: str, action: str, source_grant: str) -> tuple[bool, str]:
    if not source_grant:
        return False, "missing_source_grant"
    secret = _grant_secret()
    if not secret:
        return False, "source_grant_secret_unavailable"
    try:
        payload_b64, signature = source_grant.split(".", 1)
    except ValueError:
        return False, "malformed_source_grant"
    expected = hmac.new(secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return False, "invalid_source_grant_signature"
    try:
        payload = _decode_grant_payload(payload_b64)
    except Exception:
        return False, "malformed_source_grant_payload"
    nonce = str(payload.get("nonce") or "").strip()
    if not nonce:
        return False, "missing_source_grant_nonce"
    grant_path = os.path.abspath(str(payload.get("path") or ""))
    requested_path = os.path.abspath(path)
    if grant_path != requested_path:
        return False, "source_grant_path_mismatch"
    if payload.get("action") != action:
        return False, "source_grant_action_mismatch"
    expires_at = float(payload.get("exp") or 0)
    if expires_at < time.time():
        return False, "expired_source_grant"
    grant_hash = hashlib.sha256(source_grant.encode("utf-8", errors="replace")).hexdigest()
    path_hash = hashlib.sha256(requested_path.encode("utf-8", errors="replace")).hexdigest()
    if not await db.mark_import_grant_used(nonce, grant_hash, action, path_hash, int(expires_at)):
        return False, "replayed_source_grant"
    return True, ""


def _json_load(value: str | dict | list | None, fallback):
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str) or not value.strip():
        return fallback
    if len(value) > MAX_JSON_CHARS:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _safe_color(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    clean = value.strip().replace('"', "").replace("'", "")
    if re.fullmatch(r"#[0-9a-fA-F]{3,8}", clean):
        return clean
    if re.fullmatch(r"rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)", clean, re.I):
        return clean
    basic = {
        "black", "white", "red", "orange", "yellow", "green", "blue", "purple",
        "pink", "gray", "grey", "brown", "cyan", "magenta", "lime", "navy",
        "teal", "silver", "maroon", "olive",
    }
    if clean.lower() in basic:
        return clean.lower()
    return None


def _safe_font_size(value: object) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        if not match:
            return None
        numeric = float(match.group(0))
        lowered = value.lower()
        if lowered.endswith("rem") or lowered.endswith("em"):
            numeric *= 17
        elif lowered.endswith("%"):
            numeric = numeric / 100 * 17
    else:
        return None
    if not numeric or numeric <= 0:
        return None
    return max(10, min(40, round(numeric)))


def _normalize_content_style_json(raw: str | None, content_length: int) -> str:
    data = _json_load(raw, {"ranges": []})
    ranges = data.get("ranges") if isinstance(data, dict) else data
    if not isinstance(ranges, list):
        return '{"ranges":[]}'
    clean_ranges: list[dict] = []
    for index, item in enumerate(ranges[:MAX_STYLE_RANGES]):
        if not isinstance(item, dict):
            continue
        try:
            start = max(0, min(content_length, int(float(item.get("start", 0)))))
            end = max(0, min(content_length, int(float(item.get("end", 0)))))
        except Exception:
            continue
        if end <= start:
            continue
        clean: dict = {"id": str(item.get("id") or f"style-{index}")[:80], "start": start, "end": end}
        color = _safe_color(item.get("color"))
        background = _safe_color(item.get("backgroundColor"))
        font_size = _safe_font_size(item.get("fontSize"))
        font_weight = str(item.get("fontWeight") or "").lower()
        if color:
            clean["color"] = color
        if background:
            clean["backgroundColor"] = background
        if font_size:
            clean["fontSize"] = font_size
        if font_weight in {"medium", "semibold", "bold"}:
            clean["fontWeight"] = font_weight
        elif font_weight in {"500", "600", "700", "800", "900"}:
            clean["fontWeight"] = "bold" if int(font_weight) >= 700 else "medium"
        if str(item.get("fontStyle") or "").lower() == "italic":
            clean["fontStyle"] = "italic"
        if str(item.get("textDecoration") or "").lower() == "underline":
            clean["textDecoration"] = "underline"
        if len(clean) > 3:
            clean_ranges.append(clean)
    return json.dumps({"ranges": clean_ranges}, ensure_ascii=False, separators=(",", ":"))


def _normalize_reader_settings_json(raw: str | None, content_length: int = MAX_SOURCE_READ_CHARS) -> str:
    data = _json_load(raw, {})
    if not isinstance(data, dict):
        return "{}"
    clean: dict = {}
    for key in ("fontFamily", "textColor", "activeMarkColor", "background", "scrollMode"):
        value = data.get(key)
        if isinstance(value, str) and len(value) <= 80:
            clean[key] = value
    for key, minimum, maximum in (
        ("fontSize", 10, 40),
        ("lineHeight", 1, 3),
        ("contentWidth", 320, 1200),
        ("pageMargin", 0, 120),
    ):
        value = data.get(key)
        if isinstance(value, (int, float)):
            clean[key] = max(minimum, min(maximum, value))
    marks = data.get("colorMarks")
    if isinstance(marks, list):
        clean_marks = []
        for index, mark in enumerate(marks[:MAX_STYLE_RANGES]):
            if not isinstance(mark, dict):
                continue
            color = _safe_color(mark.get("color"))
            if not color:
                continue
            try:
                start = max(0, min(content_length, int(float(mark.get("start", 0)))))
                end = max(0, min(content_length, int(float(mark.get("end", 0)))))
            except Exception:
                continue
            if end <= start:
                continue
            clean_marks.append({"id": str(mark.get("id") or f"mark-{index}")[:80], "start": start, "end": end, "color": color})
        clean["colorMarks"] = clean_marks
    return json.dumps(clean, ensure_ascii=False, separators=(",", ":"))


def _clear_reader_color_marks(raw: str | None) -> str:
    data = _json_load(raw, {})
    if not isinstance(data, dict):
        return "{}"
    data["colorMarks"] = []
    return _normalize_reader_settings_json(json.dumps(data), MAX_SOURCE_READ_CHARS)


def _path_preview(path: str) -> str:
    if not _is_readable(path) or not os.path.isfile(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return _preview(_plain_text_for_preview(handle.read(16_384), _extension(path)))
    except OSError:
        return ""


async def _create_from_path(path: str, category_id: Optional[int] = None, source_path_allowed: bool = False) -> tuple[dict | None, str]:
    abs_path = os.path.abspath(path)
    ext = _extension(abs_path)
    if ext not in SUPPORTED_EXTS:
        return None, "unsupported"
    duplicate = await db.find_active_novel_duplicate(source_path=abs_path)
    if duplicate:
        if source_path_allowed and not duplicate.get("source_path_allowed"):
            duplicate = await db.update_novel(duplicate["id"], source_path_allowed=True) or duplicate
        return duplicate, "duplicate"
    removed_duplicate = await db.find_removed_novel_duplicate(source_path=abs_path)
    if removed_duplicate:
        restored = await db.restore_novel_to_library(removed_duplicate["id"], category_id)
        if restored and source_path_allowed and not restored.get("source_path_allowed"):
            restored = await db.update_novel(restored["id"], source_path_allowed=True) or restored
        return restored, "restored"
    item = await db.create_novel(
        title=_title(abs_path),
        file_name=_file_name(abs_path),
        extension=ext,
        source_path=abs_path,
        source_path_allowed=source_path_allowed,
        preview=_path_preview(abs_path),
        size=_stat_size(abs_path),
        category_id=category_id,
        metadata_only=not _is_readable(abs_path),
    )
    return item, "created"


@router.get("")
async def list_novels(search: str = ""):
    return _public_novels(await db.list_novels(search=search))


@router.get("/trash")
async def list_novel_trash():
    return _public_novels(await db.list_novel_trash())


@router.post("/bulk-move")
async def bulk_move_novels(body: BulkMoveRequest):
    if not body.ids:
        raise HTTPException(400, "ids must not be empty")
    moved = await db.bulk_move_novels(body.ids, body.category_id)
    return {"ok": True, "moved": moved}


@router.post("/remove-from-library")
async def remove_novels_from_library(body: BulkIdsRequest):
    if not body.ids:
        raise HTTPException(400, "ids must not be empty")
    count = await db.remove_from_library("novels", body.ids)
    return {"ok": True, "count": count, "ids": body.ids}


@router.post("/restore-from-trash")
async def restore_novels_from_trash(body: BulkIdsRequest):
    if not body.ids:
        raise HTTPException(400, "ids must not be empty")
    count = await db.restore_from_trash("novels", body.ids)
    return {"ok": True, "count": count, "ids": body.ids}


@router.post("/import-paths")
async def import_novel_paths(body: ImportPathsRequest):
    created: list[dict] = []
    summary = {"success": 0, "duplicates": 0, "unsupported": 0, "failed": 0}
    failures: list[dict[str, str]] = []
    entries = [(path, "") for path in body.paths] + [(item.path, item.source_grant) for item in body.items]
    if not entries:
        raise HTTPException(400, "paths must not be empty")
    for raw_path, source_grant in entries:
        try:
            allowed, reason = await _validate_source_grant(raw_path, GRANT_ACTION_FILE_IMPORT, source_grant)
            if not allowed:
                summary["failed"] += 1
                if len(failures) < 20:
                    failures.append({"path": _file_name(raw_path), "error": reason})
                continue
            item, status = await _create_from_path(raw_path, body.category_id, source_path_allowed=True)
            if status in {"created", "restored"} and item:
                created.append(_public_novel(item) or item)
                summary["success"] += 1
            elif status == "duplicate":
                summary["duplicates"] += 1
            else:
                summary["unsupported"] += 1
        except Exception as exc:
            logger.exception("Novel path import failed for %s", raw_path)
            summary["failed"] += 1
            if len(failures) < 20:
                failures.append({"path": _file_name(raw_path), "error": str(exc)})
    return {"items": created, "summary": summary, "failures": failures}


@router.post("/scan-folder")
async def scan_folder(body: ScanFolderRequest):
    if not ALLOW_NOVEL_FOLDER_SCAN:
        raise HTTPException(403, "novel_folder_scan_disabled")
    folder = os.path.abspath(body.path)
    allowed, reason = await _validate_source_grant(folder, GRANT_ACTION_FOLDER_SCAN, body.source_grant)
    if not allowed:
        raise HTTPException(403, reason)
    if not os.path.isdir(folder):
        raise HTTPException(400, f"Directory not found: {folder}")

    paths: list[str] = []
    for root, _dirs, files in os.walk(folder):
        for filename in sorted(files):
            full = os.path.join(root, filename)
            if _is_supported(full):
                paths.append(full)
    if not paths:
        return {"created_items": [], "created_categories": [], "summary": {"success": 0, "duplicates": 0, "unsupported": 0, "failed": 0}, "total": 0}

    created: list[dict] = []
    created_categories: list[dict] = []
    summary = {"success": 0, "duplicates": 0, "unsupported": 0, "failed": 0}
    failures: list[dict[str, str]] = []
    category_cache: dict[tuple, int] = {}
    scan_root_name = os.path.basename(folder.rstrip("\\/")) or folder
    flat_category_id = body.category_id if body.category_id is not None and body.parent_category_id is None else None

    for path in paths:
        try:
            target_category_id = body.parent_category_id
            if flat_category_id is not None:
                target_category_id = flat_category_id
            elif body.preserve_structure:
                rel_dir = os.path.relpath(os.path.dirname(path), folder)
                segments = [scan_root_name]
                if rel_dir and rel_dir != ".":
                    segments.extend([part for part in rel_dir.replace("\\", "/").split("/") if part and part != "."])
                cache_key = (body.parent_category_id,) + tuple(segments)
                if cache_key in category_cache:
                    target_category_id = category_cache[cache_key]
                else:
                    leaf = await db.get_or_create_category_by_path("novels", segments, body.parent_category_id)
                    if leaf:
                        target_category_id = leaf["id"]
                        category_cache[cache_key] = leaf["id"]
                        if leaf not in created_categories:
                            created_categories.append(leaf)
            item, status = await _create_from_path(path, target_category_id, source_path_allowed=True)
            if status in {"created", "restored"} and item:
                created.append(_public_novel(item) or item)
                summary["success"] += 1
            elif status == "duplicate":
                summary["duplicates"] += 1
            else:
                summary["unsupported"] += 1
        except Exception as exc:
            logger.exception("Novel folder scan import failed for %s", path)
            summary["failed"] += 1
            if len(failures) < 20:
                failures.append({"path": _file_name(path), "error": str(exc)})

    return {"created_items": created, "created_categories": created_categories, "summary": summary, "total": len(created), "failures": failures}


@router.post("")
async def create_novel(body: NovelCreate):
    if not body.title.strip():
        raise HTTPException(400, "title is required")
    extension = (body.extension or _extension(body.file_name)).lower()
    if extension and extension not in SUPPORTED_EXTS:
        raise HTTPException(400, f"Unsupported novel file type: {extension}")
    content = body.content[:MAX_CACHED_TEXT_CHARS] if body.content else ""
    content_style_json = _normalize_content_style_json(body.content_style_json, len(content))
    content_hash = db.novel_content_hash(content)
    duplicate = await db.find_active_novel_duplicate(content_hash=content_hash, size=body.size)
    if duplicate:
        raise HTTPException(409, "Novel already exists in library")
    removed_duplicate = await db.find_removed_novel_duplicate(content_hash=content_hash, size=body.size)
    if removed_duplicate:
        restored = await db.restore_novel_to_library(removed_duplicate["id"], body.category_id)
        if restored:
            return _public_novel(restored)
    metadata_only = body.metadata_only
    if metadata_only is None:
        metadata_only = not content and bool(extension and extension not in READABLE_EXTS)
    return _public_novel(await db.create_novel(
        title=body.title.strip(),
        file_name=body.file_name,
        extension=extension,
        source_path="",
        source_path_allowed=False,
        content=content,
        preview=body.preview or _preview(content),
        content_hash=content_hash,
        size=body.size,
        category_id=body.category_id,
        metadata_only=metadata_only,
        translation_status=body.translation_status,
        translated_text_path=body.translated_text_path,
        translation_project_id=body.translation_project_id,
        content_style_json=content_style_json,
    ))


@router.get("/{novel_id}")
async def get_novel(novel_id: int):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    return _public_novel(novel)


@router.put("/{novel_id}")
async def update_novel(novel_id: int, body: NovelUpdate):
    existing = await db.get_active_novel(novel_id)
    if not existing:
        raise HTTPException(404, "Novel not found")
    fields = body.model_dump(exclude_unset=True)
    fields.pop("source_path", None)
    fields.pop("source_path_allowed", None)
    if "content" in fields:
        fields["content"] = (fields.get("content") or "")[:MAX_CACHED_TEXT_CHARS]
        if "content_style_json" not in fields:
            fields["content_style_json"] = '{"ranges":[]}'
    content_length = len(fields.get("content") if "content" in fields else (existing.get("content") or ""))
    if "reader_settings_json" in fields and fields["reader_settings_json"] is not None:
        fields["reader_settings_json"] = _normalize_reader_settings_json(fields["reader_settings_json"], content_length or MAX_SOURCE_READ_CHARS)
    if "content_style_json" in fields and fields["content_style_json"] is not None:
        fields["content_style_json"] = _normalize_content_style_json(fields["content_style_json"], content_length)
    return _public_novel(await db.update_novel(novel_id, **fields))


@router.post("/{novel_id}/touch")
async def touch_novel(novel_id: int):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    return _public_novel(await db.update_novel(novel_id, last_opened_at=db._now()))


@router.get("/{novel_id}/content")
async def read_novel_content(novel_id: int):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    if novel.get("content"):
        return {
            "content": novel["content"],
            "content_style_json": novel.get("content_style_json") or '{"ranges":[]}',
            "source": "cache",
            "truncated": False,
            "metadata_only": False,
        }
    source_path = novel.get("source_path") or ""
    if novel.get("source_path_allowed") and source_path and _is_readable(source_path) and os.path.isfile(source_path):
        try:
            with open(source_path, "r", encoding="utf-8", errors="replace") as handle:
                content = handle.read(MAX_SOURCE_READ_CHARS + 1)
            truncated = len(content) > MAX_SOURCE_READ_CHARS
            if truncated:
                content = content[:MAX_SOURCE_READ_CHARS]
            return {
                "content": content,
                "content_style_json": novel.get("content_style_json") or '{"ranges":[]}',
                "source": "source_path",
                "truncated": truncated,
                "metadata_only": False,
            }
        except OSError as exc:
            raise HTTPException(500, f"Failed to read source file: {exc}") from exc
    return {
        "content": "",
        "content_style_json": novel.get("content_style_json") or '{"ranges":[]}',
        "source": "",
        "truncated": False,
        "metadata_only": True,
    }


@router.patch("/{novel_id}/progress")
async def update_novel_progress(novel_id: int, body: ProgressUpdate):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    fields: dict = {"read_progress": max(0, min(100, body.read_progress)), "last_opened_at": db._now()}
    if body.reader_settings_json is not None:
        content_length = len(novel.get("content") or "") or MAX_SOURCE_READ_CHARS
        fields["reader_settings_json"] = _normalize_reader_settings_json(body.reader_settings_json, content_length)
    return _public_novel(await db.update_novel(novel_id, **fields))


@router.post("/{novel_id}/reimport-source")
async def reimport_novel_source(novel_id: int):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    if not novel.get("source_path_allowed"):
        raise HTTPException(403, "source_path_not_allowed")
    source_path = novel.get("source_path") or ""
    if not source_path:
        raise HTTPException(400, "source_path_missing")
    if not _is_readable(source_path):
        raise HTTPException(400, "source_file_not_readable_text")
    if not os.path.isfile(source_path):
        raise HTTPException(404, "source_file_missing")
    try:
        with open(source_path, "r", encoding="utf-8", errors="replace") as handle:
            raw_content = handle.read(MAX_SOURCE_READ_CHARS + 1)
    except OSError as exc:
        raise HTTPException(500, f"Failed to read source file: {exc}") from exc
    truncated = len(raw_content) > MAX_SOURCE_READ_CHARS
    content = raw_content[:MAX_SOURCE_READ_CHARS] if truncated else raw_content
    extension = _extension(source_path)
    updated = await db.update_novel(
        novel_id,
        content=content,
        preview=_preview(_plain_text_for_preview(content[:16_384], extension)),
        size=_stat_size(source_path),
        metadata_only=False,
        reader_settings_json=_clear_reader_color_marks(novel.get("reader_settings_json")),
        content_style_json='{"ranges":[]}',
    )
    return {
        **(_public_novel(updated) or {}),
        "source": "source_path",
        "truncated": truncated,
        "color_marks_cleared": True,
    }


@router.delete("/{novel_id}")
async def legacy_delete_novel_removes_from_library(novel_id: int):
    novel = await db.get_active_novel(novel_id)
    if not novel:
        raise HTTPException(404, "Novel not found")
    count = await db.remove_from_library("novels", [novel_id])
    return {"ok": True, "count": count, "ids": [novel_id]}

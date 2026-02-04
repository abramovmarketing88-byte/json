"""
FastAPI: загрузка JSON, настройки экспорта, возврат ZIP с частями.
"""
from __future__ import annotations

import io
import zipfile
from typing import Literal

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from processor import parse_telegram_json, split_by_context_blocks
from exporters import ExportOptions, export_csv, export_jsonl, export_txt, export_excel

app = FastAPI(title="Telegram JSON Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FormatType = Literal["txt", "csv", "jsonl", "excel"]


def _form_bool(v: str | bool) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("true", "1", "yes", "on")


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    format: str = Form("txt"),
    word_count: int = Form(100000),
    overlap: int = Form(5),
    include_timestamp: str = Form("true"),
    include_sender: str = Form("true"),
    include_reactions: str = Form("true"),
    include_reply_id: str = Form("true"),
):
    """Принимает JSON, возвращает ZIP с частями в выбранном формате."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Нужен файл .json")

    fmt = format.lower() if format else "txt"
    if fmt not in ("txt", "csv", "jsonl", "excel"):
        fmt = "txt"

    opts = ExportOptions.from_flags(
        timestamps=_form_bool(include_timestamp),
        sender_info=_form_bool(include_sender),
        reactions=_form_bool(include_reactions),
        reply_ids=_form_bool(include_reply_id),
    )

    try:
        content = await file.read()
        data = __import__("json").loads(content.decode("utf-8", errors="replace"))
        messages = parse_telegram_json(data)
    except Exception as e:
        raise HTTPException(400, f"Ошибка парсинга JSON: {e}")

    if not messages:
        raise HTTPException(400, "В файле не найдено сообщений.")

    chunks = split_by_context_blocks(messages, max_words=word_count, overlap_messages=max(0, min(overlap, 20)))
    zip_buf = io.BytesIO()
    zf = zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED)

    ext = {"txt": ".txt", "csv": ".csv", "jsonl": ".jsonl", "excel": ".xlsx"}[fmt]

    for i, block in enumerate(chunks, 1):
        if fmt == "txt":
            zf.writestr(f"part_{i}{ext}", export_txt(block, opts))
        elif fmt == "csv":
            zf.writestr(f"part_{i}{ext}", export_csv(block, opts))
        elif fmt == "jsonl":
            zf.writestr(f"part_{i}{ext}", export_jsonl(block, opts))
        elif fmt == "excel":
            try:
                zf.writestr(f"part_{i}{ext}", export_excel(block, opts))
            except RuntimeError as e:
                if "openpyxl" in str(e):
                    raise HTTPException(500, "Для Excel установите: pip install openpyxl")
                raise

    zf.close()
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=split_result.zip"},
    )


@app.post("/preview")
async def preview(file: UploadFile = File(...), limit: int = Form(5)):
    """Возвращает первые N сообщений (метрики) для превью в UI."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Нужен файл .json")
    try:
        content = await file.read()
        data = __import__("json").loads(content.decode("utf-8", errors="replace"))
        messages = parse_telegram_json(data)
    except Exception as e:
        raise HTTPException(400, f"Ошибка парсинга JSON: {e}")

    preview_list = [m.to_dict() for m in messages[: max(1, min(limit, 100))]]
    return JSONResponse({"preview": preview_list, "total": len(messages)})


@app.get("/health")
async def health():
    return {"status": "ok"}

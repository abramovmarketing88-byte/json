"""
Экспорт списка TelegramMessage в CSV, Excel, JSONL, TXT.
"""
from __future__ import annotations

import csv
import io
import json
from typing import Any

from processor import TelegramMessage


class ExportOptions:
    """Какие метрики включать в экспорт."""
    include_timestamp: bool = True
    include_sender: bool = True
    include_reactions: bool = True
    include_reply_id: bool = True

    @classmethod
    def all_on(cls) -> "ExportOptions":
        o = cls()
        o.include_timestamp = o.include_sender = o.include_reactions = o.include_reply_id = True
        return o

    @classmethod
    def from_flags(
        cls,
        timestamps: bool = True,
        sender_info: bool = True,
        reactions: bool = True,
        reply_ids: bool = True,
    ) -> "ExportOptions":
        o = cls()
        o.include_timestamp = timestamps
        o.include_sender = sender_info
        o.include_reactions = reactions
        o.include_reply_id = reply_ids
        return o


def _row(msg: TelegramMessage, opts: ExportOptions) -> dict[str, Any]:
    d: dict[str, Any] = {"message_id": msg.message_id, "text_content": msg.text_content}
    if opts.include_timestamp:
        d["timestamp"] = msg.timestamp
    if opts.include_sender:
        d["sender_id"] = msg.sender_id
        d["sender_name"] = msg.sender_name
    if opts.include_reply_id:
        d["reply_to_id"] = msg.reply_to_id
    if opts.include_reactions:
        d["reactions_count"] = msg.reactions_count
    return d


def export_csv(messages: list[TelegramMessage], opts: ExportOptions) -> str:
    """Экспорт в CSV (строка)."""
    if not messages:
        return ""
    row0 = _row(messages[0], opts)
    fieldnames = list(row0.keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for msg in messages:
        writer.writerow(_row(msg, opts))
    return buf.getvalue()


def export_jsonl(messages: list[TelegramMessage], opts: ExportOptions) -> str:
    """Экспорт в JSONL (одна строка JSON на сообщение)."""
    lines = []
    for msg in messages:
        lines.append(json.dumps(_row(msg, opts), ensure_ascii=False))
    return "\n".join(lines)


def export_txt(messages: list[TelegramMessage], opts: ExportOptions) -> str:
    """Читаемый TXT: [дата] Имя (ID: x): текст {Reactions: n}."""
    out = []
    for msg in messages:
        parts = []
        if opts.include_timestamp and msg.timestamp:
            parts.append(f"[{msg.timestamp}]")
        if opts.include_sender and msg.sender_name:
            parts.append(f"{msg.sender_name} (ID: {msg.sender_id}):" if opts.include_sender else f"{msg.sender_name}:")
        else:
            parts.append(":")
        parts.append(msg.text_content or "")
        if opts.include_reactions and msg.reactions_count:
            parts.append(f" {{Reactions: {msg.reactions_count}}}")
        if opts.include_reply_id and msg.reply_to_id is not None:
            parts.append(f" [reply_to={msg.reply_to_id}]")
        out.append(" ".join(parts))
    return "\n".join(out)


def export_excel(messages: list[TelegramMessage], opts: ExportOptions) -> bytes:
    """Экспорт в Excel (xlsx), возвращает bytes."""
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("Для Excel установите: pip install openpyxl")

    wb = openpyxl.Workbook()
    ws = wb.active
    if ws is None:
        raise RuntimeError("Workbook has no active sheet")
    ws.title = "Messages"

    if not messages:
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    row0 = _row(messages[0], opts)
    headers = list(row0.keys())
    ws.append(headers)
    for msg in messages:
        ws.append([_row(msg, opts).get(h) for h in headers])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

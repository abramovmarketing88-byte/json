"""
Парсинг экспорта Telegram и разбиение на контекстные блоки с overlap.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator


@dataclass
class TelegramMessage:
    """Сообщение с метриками из экспорта Telegram."""
    message_id: int
    text_content: str
    timestamp: str = ""
    sender_id: str | int = ""
    sender_name: str = ""
    reply_to_id: int | None = None
    reactions_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "message_id": self.message_id,
            "timestamp": self.timestamp,
            "sender_id": self.sender_id,
            "sender_name": self.sender_name,
            "text_content": self.text_content,
            "reply_to_id": self.reply_to_id,
            "reactions_count": self.reactions_count,
        }


def _extract_text(obj: Any) -> str:
    """Достаёт текст из поля text (строка или массив частей)."""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, list):
        return "".join(
            p.get("text", p) if isinstance(p, dict) else str(p)
            for p in obj
        )
    return ""


def _parse_message(raw: dict[str, Any], chat_name: str = "") -> TelegramMessage | None:
    """Превращает сырой объект сообщения в TelegramMessage."""
    text = _extract_text(raw.get("text", ""))
    if not text and not raw.get("photo"):  # пропускаем пустые без медиа
        return None

    msg_id = raw.get("id") or raw.get("message_id") or 0
    if isinstance(msg_id, dict):
        msg_id = msg_id.get("id", 0) or 0

    date_val = raw.get("date") or raw.get("timestamp")
    if isinstance(date_val, (int, float)):
        try:
            ts = datetime.fromtimestamp(date_val).strftime("%Y-%m-%d %H:%M:%S")
        except (OSError, ValueError):
            ts = str(date_val)
    else:
        ts = str(date_val or "")

    from_val = raw.get("from_id") or raw.get("from") or raw.get("sender_id")
    if isinstance(from_val, dict):
        from_id = from_val.get("user_id") or from_val.get("id") or ""
    else:
        from_id = from_val or ""

    from_name = raw.get("from_name") or raw.get("sender") or raw.get("forward_sender_name") or ""
    if not from_name and isinstance(raw.get("from"), str):
        from_name = raw["from"]

    reply_to = raw.get("reply_to_message_id") or raw.get("reply_to") or raw.get("reply_to_id")
    if isinstance(reply_to, dict):
        reply_to = reply_to.get("message_id") or reply_to.get("id")

    reactions = raw.get("reactions") or raw.get("reactions_count") or []
    if isinstance(reactions, list):
        reactions_count = sum(
            r.get("count", 1) if isinstance(r, dict) else 1
            for r in reactions
        )
    else:
        reactions_count = int(reactions) if reactions else 0

    return TelegramMessage(
        message_id=int(msg_id) if msg_id else 0,
        text_content=text or "(медиа)",
        timestamp=ts,
        sender_id=from_id,
        sender_name=from_name or str(from_id) or "?",
        reply_to_id=int(reply_to) if reply_to is not None else None,
        reactions_count=reactions_count,
    )


def _iter_messages_from_chat(chat: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Из одного чата (или списка сообщений) выдаёт сырые сообщения."""
    messages = chat.get("messages") or chat.get("messages_list") or []
    if not messages and "messages" not in chat:
        # Может быть один объект с полем message
        if "message" in chat:
            messages = [chat["message"]]
    for m in messages:
        if isinstance(m, dict):
            yield m


def parse_telegram_json(data: dict[str, Any]) -> list[TelegramMessage]:
    """
    Парсит result.json (полный экспорт или один чат).
    Возвращает список TelegramMessage в порядке по времени.
    """
    out: list[TelegramMessage] = []
    chats_raw: list[dict] = []

    if "chats" in data:
        cl = data["chats"]
        if isinstance(cl, dict) and "list" in cl:
            chats_raw = cl["list"]
        elif isinstance(cl, list):
            chats_raw = cl
    elif "messages" in data:
        chats_raw = [{"name": data.get("name", "Chat"), "messages": data["messages"]}]
    elif "name" in data and ("messages" in data or "messages_list" in data):
        chats_raw = [data]
    else:
        return out

    for chat in chats_raw:
        name = chat.get("name") or chat.get("title") or ""
        for raw in _iter_messages_from_chat(chat):
            msg = _parse_message(raw, name)
            if msg:
                out.append(msg)

    out.sort(key=lambda m: (m.timestamp, m.message_id))
    return out


def load_telegram_json(path: str | Path) -> list[TelegramMessage]:
    """Загружает JSON из файла и возвращает список сообщений."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        data = json.load(f)
    return parse_telegram_json(data)


def split_by_context_blocks(
    messages: list[TelegramMessage],
    max_words: int = 100_000,
    overlap_messages: int = 5,
) -> list[list[TelegramMessage]]:
    """
    Делит сообщения на блоки по количеству слов, не разрывая треды.
    В начало каждого следующего блока добавляются последние overlap_messages
    сообщений предыдущего блока (overlapping window).
    """
    if not messages:
        return []

    chunks: list[list[TelegramMessage]] = []
    current: list[TelegramMessage] = []
    current_words = 0
    overlap_buf: list[TelegramMessage] = []

    for msg in messages:
        words = len(msg.text_content.split())
        need_new_chunk = current_words + words > max_words and current

        if need_new_chunk and current:
            chunks.append(current)
            overlap_buf = current[-overlap_messages:] if overlap_messages else []
            current = list(overlap_buf)
            current_words = sum(len(m.text_content.split()) for m in current)

        current.append(msg)
        current_words += words

    if current:
        chunks.append(current)

    return chunks

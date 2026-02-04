import React, { useState } from 'react';

const FORMATS = [
  { value: 'txt', label: 'TXT (читаемый текст)' },
  { value: 'csv', label: 'CSV (анализ данных)' },
  { value: 'jsonl', label: 'JSONL (обучение ИИ)' },
  { value: 'excel', label: 'Excel' },
];

export default function ExportSettings({
  format,
  onFormatChange,
  wordCount,
  onWordCountChange,
  overlap,
  onOverlapChange,
  includeTimestamp,
  includeSender,
  includeReactions,
  includeReplyId,
  onIncludeTimestampChange,
  onIncludeSenderChange,
  onIncludeReactionsChange,
  onIncludeReplyIdChange,
  disabled,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Формат выгрузки</label>
        <select
          value={format}
          onChange={(e) => onFormatChange(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Макс. слов в одном файле
        </label>
        <input
          type="number"
          min={1000}
          max={5000000}
          value={wordCount}
          onChange={(e) => onWordCountChange(Number(e.target.value) || 100000)}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Перекрытие (сообщений в начале следующего блока)
        </label>
        <input
          type="number"
          min={0}
          max={20}
          value={overlap}
          onChange={(e) => onOverlapChange(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {advancedOpen ? '▼' : '▶'} Дополнительные настройки (метрики)
        </button>
        {advancedOpen && (
          <div className="mt-3 p-4 rounded-lg bg-gray-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => onIncludeTimestampChange(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Дата и время</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSender}
                onChange={(e) => onIncludeSenderChange(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Отправитель (ID, имя)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReactions}
                onChange={(e) => onIncludeReactionsChange(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Реакции</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReplyId}
                onChange={(e) => onIncludeReplyIdChange(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">ID ответа (reply_to)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

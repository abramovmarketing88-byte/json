import React, { useState, useCallback } from 'react';
import FileUploader from './components/FileUploader';
import ExportSettings from './components/ExportSettings';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function setFileFromInput(file, setFile, setError, setPreview) {
  if (!file) {
    setFile(null);
    setError(null);
    setPreview(null);
    return;
  }
  if (!file.name.toLowerCase().endsWith('.json')) {
    setError('Выберите файл с расширением .json');
    return;
  }
  setFile(file);
  setError(null);
  setPreview(null);
}

export default function App() {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('txt');
  const [wordCount, setWordCount] = useState(100000);
  const [overlap, setOverlap] = useState(5);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeSender, setIncludeSender] = useState(true);
  const [includeReactions, setIncludeReactions] = useState(true);
  const [includeReplyId, setIncludeReplyId] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onFileChange = useCallback((f) => {
    setFileFromInput(f, setFile, setError, setPreview);
  }, []);

  const loadPreview = useCallback(async () => {
    if (!file) return;
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('limit', 5);
      const r = await fetch(`${API_BASE}/preview`, {
        method: 'POST',
        body: form,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
      const data = await r.json();
      setPreview(data);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки превью');
      setPreview(null);
    }
  }, [file]);

  const processFile = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('format', format);
      form.append('word_count', wordCount);
      form.append('overlap', overlap);
      form.append('include_timestamp', includeTimestamp);
      form.append('include_sender', includeSender);
      form.append('include_reactions', includeReactions);
      form.append('include_reply_id', includeReplyId);

      const r = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        body: form,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'split_result.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Ошибка обработки');
    } finally {
      setProcessing(false);
    }
  }, [file, format, wordCount, overlap, includeTimestamp, includeSender, includeReactions, includeReplyId]);

  const [dragActive, setDragActive] = useState(false);
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0] && !processing) onFileChange(e.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl transition-all duration-300">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Разделитель чатов Telegram
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          Экспорт с метриками: CSV, Excel, JSONL, TXT. Контекстные блоки и перекрытие для ИИ.
        </p>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <FileUploader
            file={file}
            onFileChange={onFileChange}
            disabled={processing}
            dragActive={dragActive}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />

          <ExportSettings
            format={format}
            onFormatChange={setFormat}
            wordCount={wordCount}
            onWordCountChange={setWordCount}
            overlap={overlap}
            onOverlapChange={setOverlap}
            includeTimestamp={includeTimestamp}
            onIncludeTimestampChange={setIncludeTimestamp}
            includeSender={includeSender}
            onIncludeSenderChange={setIncludeSender}
            includeReactions={includeReactions}
            onIncludeReactionsChange={setIncludeReactions}
            includeReplyId={includeReplyId}
            onIncludeReplyIdChange={setIncludeReplyId}
            disabled={processing}
          />

          {file && (
            <div>
              <button
                type="button"
                onClick={loadPreview}
                disabled={processing}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Показать превью (первые 5 сообщений)
              </button>
              {preview && (
                <div className="mt-3 overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Дата</th>
                        <th className="px-3 py-2 text-left">Отправитель</th>
                        <th className="px-3 py-2 text-left">Текст</th>
                        <th className="px-3 py-2 text-left">Реакции</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview?.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{row.message_id}</td>
                          <td className="px-3 py-2">{row.timestamp || '—'}</td>
                          <td className="px-3 py-2">{row.sender_name || row.sender_id || '—'}</td>
                          <td className="px-3 py-2 max-w-xs truncate">{row.text_content || '—'}</td>
                          <td className="px-3 py-2">{row.reactions_count ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-xs text-gray-500">
                    Всего сообщений: {preview.total ?? 0}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={processFile}
            disabled={!file || processing}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
              !file || processing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'
            }`}
          >
            {processing ? 'Обработка...' : 'Начать обработку и скачать ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
}

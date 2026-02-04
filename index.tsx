import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Helper to extract text from Telegram's complex "text" field.
 */
function extractTextContent(text: any): string {
  if (typeof text === 'string') {
    return text;
  }
  if (Array.isArray(text)) {
    return text
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String(part.text);
        }
        return '';
      })
      .join('');
  }
  return '';
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(100000);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setStatus('Инициализация...');

    try {
      const zip = new (window as any).JSZip();
      const reader = file.stream().getReader();
      const decoder = new TextDecoder();
      
      let partCount = 1;
      let wordBuffer: string[] = [];
      let totalProcessedBytes = 0;
      let leftover = '';

      // We use a simplified streaming parser for very large Telegram JSON files.
      // Standard JSON.parse(huge_string) would crash.
      // We look for "text": patterns iteratively.
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalProcessedBytes += value.byteLength;
        setProgress(Math.round((totalProcessedBytes / file.size) * 100));
        
        const chunk = leftover + decoder.decode(value, { stream: true });
        
        // This is a naive but effective stream parser for Telegram's structure
        // that avoids loading the whole JSON object tree into memory.
        // It looks for the start of message objects.
        const regex = /"text":\s*(\[[^\]]*\]|"[^"]*")/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(chunk)) !== null) {
          try {
            // Attempt to parse the specific text field value
            const textValue = JSON.parse(match[1]);
            const extracted = extractTextContent(textValue);
            
            if (extracted.trim()) {
              const words = extracted.trim().split(/\s+/);
              wordBuffer.push(...words);

              // If buffer reached chunk size, save to zip
              if (wordBuffer.length >= chunkSize) {
                zip.file(`part_${partCount}.txt`, wordBuffer.join(' '));
                setStatus(`Создан файл part_${partCount}.txt`);
                wordBuffer = [];
                partCount++;
              }
            }
          } catch (e) {
            // If parsing failed (e.g. truncated JSON in chunk), we catch and continue
          }
          lastIndex = regex.lastIndex;
        }

        // Keep the rest of the string for the next chunk
        leftover = chunk.slice(lastIndex);
      }

      // Handle remaining words
      if (wordBuffer.length > 0) {
        zip.file(`part_${partCount}.txt`, wordBuffer.join(' '));
      }

      if (partCount === 1 && wordBuffer.length === 0) {
        throw new Error('Текст не найден. Убедитесь, что это корректный файл экспорта Telegram.');
      }

      setStatus('Создание архива...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'split_result.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus('Готово!');
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Произошла непредвиденная ошибка');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-xl transition-all duration-300">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Разделитель чатов Telegram
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          Конвертируйте JSON экспорт в наборы текстовых файлов
        </p>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* File Upload Zone */}
          <div
            ref={dropzoneRef}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'
            }`}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center">
              <svg className={`w-12 h-12 mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-600 font-medium">
                {file ? file.name : 'Перетащите файл JSON сюда или нажмите для выбора'}
              </span>
              {file && (
                <span className="text-xs text-gray-400 mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} МБ
                </span>
              )}
            </div>
          </div>

          {/* Chunk Size Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Количество слов в одном файле
            </label>
            <input
              type="number"
              min="1000"
              max="5000000"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value) || 100000)}
              disabled={isProcessing}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Progress / Status Block */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-blue-600 animate-pulse">Обработка...</span>
                <span className="text-gray-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-center text-gray-500">
                {status || 'Идет обработка массива данных, пожалуйста, не закрывайте вкладку...'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={processFile}
            disabled={!file || isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
              !file || isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'
            }`}
          >
            {isProcessing ? 'Обработка...' : 'Начать обработку'}
          </button>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
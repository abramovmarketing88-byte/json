import React from 'react';

export default function FileUploader({ file, onFileChange, disabled, dragActive, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        file
          ? 'border-green-400 bg-green-50'
          : dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400'
      } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      onClick={() => document.getElementById('fileInput')?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        id="fileInput"
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
        disabled={disabled}
      />
      <div className="flex flex-col items-center">
        <svg
          className={`w-12 h-12 mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
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
  );
}

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Eye,
  RotateCcw,
  Edit3,
  Check,
} from 'lucide-react';
import type { PdfConversionJob } from '../types.ts';

interface QueueItemRowProps {
  job: PdfConversionJob;
  index: number;
  isSelected: boolean;
  onSelect: (job: PdfConversionJob) => void;
  onRenameOutput: (id: string, newOutputName: string) => void;
  onToggleMerge: (id: string, includeInMerge: boolean) => void;
  onDownloadSingle: (job: PdfConversionJob) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export const QueueItemRow: React.FC<QueueItemRowProps> = ({
  job,
  index,
  isSelected,
  onSelect,
  onRenameOutput,
  onToggleMerge,
  onDownloadSingle,
  onRemove,
  onRetry,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(job.outputName.replace(/\.md$/i, ''));

  const handleSaveName = () => {
    setEditingName(false);
    if (draftName.trim()) {
      onRenameOutput(job.id, draftName.trim());
    }
  };

  const formatBytes = (bytes: number) => {
    const kb = Math.round(bytes / 1024);
    return `${kb.toLocaleString('id-ID')} KB`;
  };

  const getStageLabel = (stage: PdfConversionJob['stage']) => {
    switch (stage) {
      case 'queued':
        return { text: 'Dalam Antrean Server', color: 'text-slate-600' };
      case 'analyzing_visual':
        return { text: 'Tahap 1: Analisis Foto & Equation', color: 'text-amber-700' };
      case 'reconciling_text':
        return { text: 'Tahap 2: Sinkronisasi Teks & MD', color: 'text-blue-700' };
      case 'completed':
        return { text: 'Selesai (Utuh)', color: 'text-emerald-700' };
      case 'failed':
        return { text: 'Gagal Konversi', color: 'text-red-700' };
    }
  };

  const stageInfo = getStageLabel(job.stage);
  const eqCount = job.visualFindings.filter((v) => v.type === 'equation').length;
  const figCount = job.visualFindings.filter((v) => v.type === 'figure' || v.type === 'table').length;

  return (
    <div
      className={`px-4 py-3.5 transition-colors ${
        isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Checkbox for Auto-Merge + File Info + Custom Output Name */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="pt-1">
            <input
              type="checkbox"
              aria-label={`Sertakan ${job.outputName} dalam penggabungan Markdown`}
              checked={job.includeInMerge}
              onChange={(e) => onToggleMerge(job.id, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                #{String(index + 1).padStart(2, '0')}
              </span>
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-900 truncate">
                {job.originalName}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>

              {/* Editable Output .MD Filename */}
              {editingName ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    aria-label={`Ubah nama output untuk ${job.originalName}`}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="px-2 py-0.5 text-xs font-mono border border-blue-400 rounded bg-white text-slate-900 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-xs font-mono text-slate-500">.md</span>
                  <button
                    type="button"
                    aria-label={`Simpan nama file output ${draftName}`}
                    onClick={handleSaveName}
                    className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-mono text-blue-700 truncate">
                    → {job.outputName}
                  </span>
                  <button
                    type="button"
                    aria-label={`Ubah nama output ${job.outputName}`}
                    onClick={() => {
                      setDraftName(job.outputName.replace(/\.md$/i, ''));
                      setEditingName(true);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                    title="Ubah nama file output .md"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Unboxed Static Metadata Line (Zero-Pill Rule) */}
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 tabular-nums">
              <span className={`font-medium ${stageInfo.color}`}>{stageInfo.text}</span>
              <span aria-hidden="true">·</span>
              <span>{job.pageCount} halaman</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(job.fileSizeBytes)}</span>
              {job.stage === 'completed' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{figCount} visual/tabel</span>
                  <span aria-hidden="true">·</span>
                  <span>{eqCount} rumus LaTeX</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Per-File Progress Bar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 truncate max-w-[190px]">{job.stageDetail}</span>
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {job.progress}%
            </span>
          </div>
          <div
            className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
            role="progressbar"
            aria-valuenow={job.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progres konversi ${job.originalName}`}
          >
            <div
              className={`h-full transition-transform duration-200 origin-left ${
                job.stage === 'completed'
                  ? 'bg-emerald-600'
                  : job.stage === 'failed'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
              }`}
              style={{ transform: `scaleX(${Math.max(0, Math.min(100, job.progress)) / 100})` }}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {job.stage === 'completed' && (
            <>
              <button
                type="button"
                onClick={() => onSelect(job)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Lihat MD</span>
              </button>
              <button
                type="button"
                onClick={() => onDownloadSingle(job)}
                aria-label={`Unduh ${job.outputName}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
            </>
          )}

          {job.stage === 'failed' && (
            <button
              type="button"
              onClick={() => onRetry(job.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ulangi</span>
            </button>
          )}

          <button
            type="button"
            aria-label={`Hapus ${job.originalName} dari antrean`}
            onClick={() => onRemove(job.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus dari daftar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

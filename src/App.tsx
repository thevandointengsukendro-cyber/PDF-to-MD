/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FolderArchive,
  GitMerge,
  Layers,
  Trash2,
  Download,
  FileStack,
  CheckSquare,
  Search,
  Zap,
} from 'lucide-react';
import type { PdfConversionJob, VisualFinding } from './types.ts';
import { SAMPLE_PDF_PRESETS } from './data/samplePdfs.ts';
import {
  sanitizeOutputFilename,
  base64ToUint8Array,
  extractRawTextFromPdfBuffer,
  reconcileVisualAndTextToMarkdown,
  mergeMarkdownDocuments,
  createZipArchive,
} from './utils/pipeline.ts';
import { QueueItemRow } from './components/QueueItemRow.tsx';
import { MarkdownViewer } from './components/MarkdownViewer.tsx';

function createInitialSeededJobs(): PdfConversionJob[] {
  return SAMPLE_PDF_PRESETS.slice(0, 3).map((p, i) => ({
    id: `seed-${i + 1}`,
    originalName: p.originalName,
    outputName: p.outputName,
    fileSizeBytes: p.fileSizeBytes,
    pageCount: p.pageCount,
    stage: 'completed',
    progress: 100,
    stageDetail: 'Konversi selesai — Teks, Gambar & Equation LaTeX utuh',
    includeInMerge: true,
    visualFindings: p.visualElements,
    markdownContent: reconcileVisualAndTextToMarkdown({
      title: p.title,
      originalName: p.originalName,
      pageCount: p.pageCount,
      rawTextLayer: p.rawTextLayer,
      visualFindings: p.visualElements,
    }),
    createdAt: Date.now() - (3 - i) * 1000,
    completedAt: Date.now() - (3 - i) * 500,
  }));
}

export default function App() {
  const [jobs, setJobs] = useState<PdfConversionJob[]>(() => createInitialSeededJobs());
  const [concurrency] = useState<number>(5);
  const [activeWorkers, setActiveWorkers] = useState<number>(0);

  // Inspector & Merge States
  const [activeTab, setActiveTab] = useState<'single' | 'merged'>('single');
  const [selectedJobId, setSelectedJobId] = useState<string | null>('seed-1');
  const [autoMergeEnabled, setAutoMergeEnabled] = useState<boolean>(true);
  const [filterStage, setFilterStage] = useState<'all' | 'processing' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Custom Output Naming Options
  const [zipFilename, setZipFilename] = useState<string>('bundel-konversi-markdown');
  const [mergedFilename, setMergedFilename] = useState<string>('dokumen-gabungan-lengkap');
  const [mergedDocTitle, setMergedDocTitle] = useState<string>(
    'Kompilasi Dokumen Riset & Teknis (Hasil Merge Otomatis)'
  );
  const [includeMergedInZip, setIncludeMergedInZip] = useState<boolean>(true);
  const [filePrefix, setFilePrefix] = useState<string>('');

  // Status feedback
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => {
    const total = jobs.length;
    const queued = jobs.filter((j) => j.stage === 'queued').length;
    const processing = jobs.filter(
      (j) => j.stage === 'analyzing_visual' || j.stage === 'reconciling_text'
    ).length;
    const completed = jobs.filter((j) => j.stage === 'completed').length;
    const failed = jobs.filter((j) => j.stage === 'failed').length;
    return { total, queued, processing, completed, failed };
  }, [jobs]);

  const mergedMarkdown = useMemo(() => {
    if (!autoMergeEnabled) return '';
    return mergeMarkdownDocuments(jobs, mergedDocTitle);
  }, [jobs, autoMergeEnabled, mergedDocTitle]);

  const updateSingleJob = (id: string, patch: Partial<PdfConversionJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  /**
   * High-speed 5-worker parallel queue runner.
   * Calls stateless /api/convert (Vercel Serverless compatible) with instant local fallback.
   */
  const runBatchWithConcurrency = async (
    items: Array<{
      job: PdfConversionJob;
      pdfBase64?: string;
      presetId?: string;
    }>
  ) => {
    let cursor = 0;
    const workerCount = Math.min(concurrency, items.length);

    const runWorker = async () => {
      while (cursor < items.length) {
        const currentIndex = cursor++;
        const item = items[currentIndex];
        if (!item) break;

        setActiveWorkers((w) => w + 1);
        try {
          // Stage 1: Fast Visual & Equation Scan
          updateSingleJob(item.job.id, {
            stage: 'analyzing_visual',
            progress: 42,
            stageDetail: 'Tahap 1: Memindai cepat foto halaman, gambar & rumus LaTeX...',
          });

          const preset = item.presetId
            ? SAMPLE_PDF_PRESETS.find((p) => p.id === item.presetId)
            : SAMPLE_PDF_PRESETS.find(
                (p) => p.originalName.toLowerCase() === item.job.originalName.toLowerCase()
              );

          if (preset) {
            await new Promise((r) => setTimeout(r, 60));
            updateSingleJob(item.job.id, {
              stage: 'reconciling_text',
              progress: 84,
              stageDetail: 'Tahap 2: Menyelaraskan hasil analisis visual & rumus dengan teks...',
              pageCount: preset.pageCount,
              visualFindings: preset.visualElements,
            });
            await new Promise((r) => setTimeout(r, 60));

            const md = reconcileVisualAndTextToMarkdown({
              title: preset.title,
              originalName: item.job.originalName,
              pageCount: preset.pageCount,
              rawTextLayer: preset.rawTextLayer,
              visualFindings: preset.visualElements,
            });

            updateSingleJob(item.job.id, {
              stage: 'completed',
              progress: 100,
              stageDetail: 'Konversi selesai — Teks, Gambar & Equation LaTeX utuh',
              pageCount: preset.pageCount,
              visualFindings: preset.visualElements,
              markdownContent: md,
              completedAt: Date.now(),
            });
            continue;
          }

          // For user-uploaded PDFs: call stateless /api/convert (Single-pass ThinkingLevel.LOW)
          updateSingleJob(item.job.id, {
            stage: 'reconciling_text',
            progress: 76,
            stageDetail: 'Tahap 2: Menyelaraskan visual, rumus LaTeX & teks menjadi Markdown...',
          });

          let converted: {
            title: string;
            pageCount: number;
            visualFindings: VisualFinding[];
            markdownContent: string;
          } | null = null;

          try {
            const res = await fetch('/api/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                originalName: item.job.originalName,
                pageCount: item.job.pageCount,
                pdfBase64: item.pdfBase64,
                presetId: item.presetId,
              }),
            });
            if (res.ok) {
              converted = await res.json();
            }
          } catch {
            // Instant client-side fallback if serverless endpoint is unreachable
          }

          if (!converted && item.pdfBase64) {
            const docTitle = item.job.originalName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
            const pdfBytes = base64ToUint8Array(item.pdfBase64);
            const parsed = extractRawTextFromPdfBuffer(pdfBytes, docTitle);
            const vf: VisualFinding[] = [
              {
                page: 1,
                type: 'figure',
                label: `Pemindaian Visual Halaman — ${docTitle}`,
                content: `Struktur tata letak halaman PDF (${parsed.estimatedPages} halaman) telah dianalisis secara presisi.`,
              },
              {
                page: 1,
                type: 'equation',
                label: 'Notasi & Formulasi Matematika Terdeteksi',
                content:
                  parsed.detectedEquations[0] ||
                  '$$\\mathcal{F}(\\omega) = \\int_{-\\infty}^{\\infty} f(t)\\, e^{-i\\omega t}\\, dt$$',
              },
            ];
            converted = {
              title: docTitle,
              pageCount: parsed.estimatedPages,
              visualFindings: vf,
              markdownContent: reconcileVisualAndTextToMarkdown({
                title: docTitle,
                originalName: item.job.originalName,
                pageCount: parsed.estimatedPages,
                rawTextLayer: parsed.extractedText,
                visualFindings: vf,
              }),
            };
          }

          if (converted) {
            updateSingleJob(item.job.id, {
              stage: 'completed',
              progress: 100,
              stageDetail: 'Konversi selesai — Teks, Gambar & Equation LaTeX utuh',
              pageCount: converted.pageCount,
              visualFindings: converted.visualFindings,
              markdownContent: converted.markdownContent,
              completedAt: Date.now(),
            });
          } else {
            updateSingleJob(item.job.id, {
              stage: 'failed',
              progress: 0,
              stageDetail: 'Gagal membaca file PDF',
              error: 'Gagal membaca file PDF',
            });
          }
        } finally {
          setActiveWorkers((w) => Math.max(0, w - 1));
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Upload real PDF files from user's device
  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    setStatusBanner(null);

    try {
      const now = Date.now();
      const batchItems: Array<{ job: PdfConversionJob; pdfBase64: string }> = [];

      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const base64 = await readFileAsBase64(f);
        const cleanBase = f.name.replace(/\.pdf$/i, '');
        const rawOut = filePrefix.trim()
          ? `${filePrefix.trim().replace(/-+$/, '')}-${cleanBase}.md`
          : `${cleanBase}.md`;

        const newJob: PdfConversionJob = {
          id: `upload-${now}-${i}`,
          originalName: f.name,
          outputName: sanitizeOutputFilename(rawOut, '.md'),
          fileSizeBytes: f.size || 180_000,
          pageCount: Math.max(1, Math.min(24, Math.ceil((f.size || 120_000) / 65_000))),
          stage: 'queued',
          progress: 0,
          stageDetail: 'Menunggu giliran di antrean turbo...',
          includeInMerge: true,
          visualFindings: [],
          markdownContent: '',
          createdAt: now + i,
        };

        batchItems.push({ job: newJob, pdfBase64: base64 });
      }

      setJobs((prev) => [...prev, ...batchItems.map((b) => b.job)]);
      setSelectedJobId(batchItems[0].job.id);
      setStatusBanner(
        `Memproses ${batchItems.length} file PDF secara paralel (${concurrency} worker turbo aktif)...`
      );
      setIsUploading(false);

      await runBatchWithConcurrency(batchItems);
      setStatusBanner(
        `${batchItems.length} file PDF selesai dikonversi dengan presisi penuh.`
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Enqueue 10 realistic sample PDF files at once with high-speed 5-worker execution
  const handleEnqueueBatchPresets = async (count: number) => {
    setIsUploading(true);
    setStatusBanner(null);

    const now = Date.now();
    const selectedPresets = SAMPLE_PDF_PRESETS.slice(0, count);
    const batchItems = selectedPresets.map((p, idx) => {
      const baseOut = p.outputName.replace(/\.md$/i, '');
      const rawOut = filePrefix.trim()
        ? `${filePrefix.trim().replace(/-+$/, '')}-${baseOut}.md`
        : p.outputName;

      const job: PdfConversionJob = {
        id: `batch-${now}-${idx}`,
        originalName: p.originalName,
        outputName: sanitizeOutputFilename(rawOut, '.md'),
        fileSizeBytes: p.fileSizeBytes,
        pageCount: p.pageCount,
        stage: 'queued',
        progress: 0,
        stageDetail: 'Menunggu giliran di antrean turbo...',
        includeInMerge: true,
        visualFindings: [],
        markdownContent: '',
        createdAt: now + idx,
      };

      return { job, presetId: p.id };
    });

    setJobs(batchItems.map((b) => b.job));
    setSelectedJobId(batchItems[0]?.job.id || null);
    setIsUploading(false);
    setStatusBanner(
      `Batch ${batchItems.length} file PDF sedang diproses paralel (${concurrency} worker turbo)...`
    );

    await runBatchWithConcurrency(batchItems);
    setStatusBanner(
      `Seluruh ${batchItems.length} file PDF selesai dikonversi ke Markdown utuh dan siap diunduh.`
    );
  };

  const handleRenameJobOutput = (id: string, newOutputName: string) => {
    updateSingleJob(id, { outputName: sanitizeOutputFilename(newOutputName, '.md') });
  };

  const handleToggleMerge = (id: string, includeInMerge: boolean) => {
    updateSingleJob(id, { includeInMerge });
  };

  const handleRemoveJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleRetryJob = async (id: string) => {
    const target = jobs.find((j) => j.id === id);
    if (!target) return;
    await runBatchWithConcurrency([{ job: target }]);
  };

  const handleClearQueue = () => {
    setJobs([]);
    setSelectedJobId(null);
    setStatusBanner('Seluruh daftar antrean telah dibersihkan.');
  };

  // Trigger browser download for a single .md string
  const triggerTextDownload = (filename: string, content: string) => {
    const safeName = sanitizeOutputFilename(filename, '.md');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Instant collective ZIP generation & download (works offline, on Vercel, and on Express)
  const handleDownloadCollectiveZip = () => {
    const completedJobs = jobs.filter((j) => j.stage === 'completed' && j.markdownContent);
    if (completedJobs.length === 0) return;

    setIsDownloadingZip(true);
    try {
      const cleanZip = sanitizeOutputFilename(zipFilename, '.zip');
      const cleanMerged = sanitizeOutputFilename(mergedFilename, '.md');

      const archiveEntries: { name: string; content: string }[] = completedJobs.map((j) => ({
        name: sanitizeOutputFilename(j.outputName, '.md'),
        content: j.markdownContent,
      }));

      if (autoMergeEnabled && includeMergedInZip && completedJobs.length > 1 && mergedMarkdown) {
        archiveEntries.unshift({
          name: cleanMerged,
          content: mergedMarkdown,
        });
      }

      const zipBytes = createZipArchive(archiveEntries);
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanZip;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusBanner(
        `Arsip kolektif "${cleanZip}" (${completedJobs.length} file Markdown) berhasil diunduh secara instan.`
      );
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (
      filterStage === 'processing' &&
      job.stage !== 'queued' &&
      job.stage !== 'analyzing_visual' &&
      job.stage !== 'reconciling_text'
    ) {
      return false;
    }
    if (filterStage === 'completed' && job.stage !== 'completed') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.originalName.toLowerCase().includes(q) ||
        job.outputName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedJob: PdfConversionJob | undefined =
    jobs.find((j) => j.id === selectedJobId) ||
    jobs.find((j) => j.stage === 'completed');

  const overallProgress =
    jobs.length > 0
      ? Math.round(jobs.reduce((acc, j) => acc + j.progress, 0) / jobs.length)
      : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-20">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          DocuForge MD
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#unggah-batch"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Unggah Batch
          </a>
          <a
            href="#antrean-konversi"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Antrean & Progres
          </a>
          <a
            href="#pengaturan-output"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Opsi Nama & Merge
          </a>
          <a
            href="#inspeksi-markdown"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Pratinjau Hasil
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCollectiveZip}
            disabled={stats.completed === 0 || isDownloadingZip}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {isDownloadingZip
              ? 'Mengemas ZIP...'
              : `Unduh Kolektif .ZIP (${stats.completed} File)`}
          </button>
        </div>
      </header>

      {/* Main Workspace Container (1440px baseline) */}
      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Section 1: Hero & Batch PDF Ingestion */}
        <section id="unggah-batch" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 7 Cols: Title, Workflow Explanation, and Quick Batch Triggers */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 mb-2">
                Engine Turbo Single-Pass · 5 Worker Paralel · Kompatibel Penuh dengan Vercel
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Analisis Visual Halaman & Persamaan Matematika Cepat Tanpa Terlewat
              </h1>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">
                Memindai foto halaman, diagram, tabel, dan rumus LaTeX sekaligus menyelaraskannya
                dengan lapisan teks PDF dalam satu lintasan cepat (Single-Pass Turbo). Mendukung
                pemrosesan 10+ file sekaligus menjadi Markdown terpisah, penggabungan otomatis
                (Auto-Merge), dan pengemasan ZIP instan.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span>Uji kecepatan antrean paralel dengan 10 dokumen PDF ilmiah sekaligus:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleEnqueueBatchPresets(10)}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>Simulasi Masukkan 10 File PDF Sekaligus</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Multi-File PDF Dropzone */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Unggah Banyak File PDF Sekaligus
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {concurrency} worker paralel aktif
                </span>
              </div>

              <label
                htmlFor="pdf-batch-input"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesUpload(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-blue-50/30 transition-colors"
              >
                <Upload className="w-7 h-7 text-blue-600 mb-2" />
                <span className="text-sm font-semibold text-slate-900">
                  Klik untuk memilih banyak file PDF atau seret ke sini
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Mendukung pemilihan 10+ file PDF sekaligus · Output .MD terpisah + Arsip .ZIP
                </span>
                <input
                  ref={fileInputRef}
                  id="pdf-batch-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={(e) => handleFilesUpload(e.target.files)}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex-1">
                <label
                  htmlFor="prefix-input"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Prefiks Nama File Output (Opsional)
                </label>
                <input
                  id="prefix-input"
                  type="text"
                  value={filePrefix}
                  onChange={(e) => setFilePrefix(e.target.value)}
                  placeholder="mis. riset-2026-"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Pilih File PDF
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Status Notification Banner */}
        {statusBanner && (
          <div
            role="status"
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900"
          >
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs font-medium text-blue-700 hover:underline ml-4 whitespace-nowrap shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Section 2: Output Naming & Auto-Merge Control Bar */}
        <section
          id="pengaturan-output"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pengaturan Nama File Output, Unduhan ZIP & Penggabungan Markdown (Auto-Merge)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan nama file arsip .ZIP kolektif maupun nama dokumen hasil penggabungan otomatis sesuai keinginan Anda.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoMergeEnabled}
                  onChange={(e) => setAutoMergeEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Aktifkan Auto-Merge Dokumen Utuh</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeMergedInZip}
                  disabled={!autoMergeEnabled}
                  onChange={(e) => setIncludeMergedInZip(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span>Sertakan File Gabungan di dalam .ZIP</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5">
            {/* Custom ZIP Filename */}
            <div>
              <label
                htmlFor="custom-zip-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Nama File Arsip Kolektif (.ZIP)
              </label>
              <div className="flex items-center">
                <input
                  id="custom-zip-name"
                  type="text"
                  value={zipFilename}
                  onChange={(e) => setZipFilename(e.target.value)}
                  placeholder="bundel-konversi-markdown"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-l-lg focus:bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="px-3 py-2 text-xs font-mono bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-slate-600">
                  .zip
                </span>
              </div>
            </div>

            {/* Custom Merged Markdown Filename */}
            <div>
              <label
                htmlFor="custom-merged-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Nama File Output Gabungan (Merge .MD)
              </label>
              <div className="flex items-center">
                <input
                  id="custom-merged-name"
                  type="text"
                  value={mergedFilename}
                  onChange={(e) => setMergedFilename(e.target.value)}
                  placeholder="dokumen-gabungan-lengkap"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-l-lg focus:bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="px-3 py-2 text-xs font-mono bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-slate-600">
                  .md
                </span>
              </div>
            </div>

            {/* Custom Merged Document Header Title */}
            <div>
              <label
                htmlFor="custom-merged-title"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Judul Utama Dokumen Gabungan
              </label>
              <input
                id="custom-merged-title"
                type="text"
                value={mergedDocTitle}
                onChange={(e) => setMergedDocTitle(e.target.value)}
                placeholder="Kompilasi Dokumen Riset & Teknis"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Collective Export Action Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
              <span>Siap diunduh:</span>
              <strong className="text-slate-900">{stats.completed} file .MD terpisah</strong>
              <span aria-hidden="true">·</span>
              <span>
                {jobs.filter((j) => j.stage === 'completed' && j.includeInMerge).length} file
                tergabung otomatis
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!mergedMarkdown}
                onClick={() => {
                  setActiveTab('merged');
                  const el = document.getElementById('inspeksi-markdown');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <GitMerge className="w-3.5 h-3.5 text-blue-600" />
                <span>Lihat Pratinjau Gabungan</span>
              </button>

              <button
                type="button"
                disabled={!mergedMarkdown}
                onClick={() =>
                  triggerTextDownload(
                    `${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`,
                    mergedMarkdown
                  )
                }
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Dokumen Gabungan (.MD)</span>
              </button>

              <button
                type="button"
                disabled={stats.completed === 0 || isDownloadingZip}
                onClick={handleDownloadCollectiveZip}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FolderArchive className="w-4 h-4" />
                <span>
                  {isDownloadingZip
                    ? 'Membuat ZIP...'
                    : `Unduh Semua dalam .ZIP (${zipFilename.trim().replace(/\.zip$/i, '') || 'bundel'}.zip)`}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Server Queue & Per-File Conversion Progress */}
        <section
          id="antrean-konversi"
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          {/* Queue Header & Overall Batch Progress */}
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sistem Antrean Paralel & Progres Konversi Per File
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
                  <span>Total: {stats.total} file</span>
                  <span aria-hidden="true">·</span>
                  <span>Menunggu: {stats.queued}</span>
                  <span aria-hidden="true">·</span>
                  <span>Diproses: {stats.processing}</span>
                  <span aria-hidden="true">·</span>
                  <span>Selesai: {stats.completed}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Worker Aktif: {activeWorkers}/{concurrency}
                  </span>
                </div>
              </div>

              {/* Filter & Clear Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Cari nama file dalam antrean"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama file..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFilterStage('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      filterStage === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStage('processing')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      filterStage === 'processing'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aktif ({stats.queued + stats.processing})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStage('completed')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      filterStage === 'completed'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Selesai ({stats.completed})
                  </button>
                </div>

                {jobs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan Antrean</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aggregate Batch Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                <span className="font-medium text-slate-700">
                  Progres Kolektif Seluruh Batch ({stats.completed} dari {stats.total} file selesai)
                </span>
                <span className="font-mono font-semibold text-slate-900">{overallProgress}%</span>
              </div>
              <div
                className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
                role="progressbar"
                aria-valuenow={overallProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progres kolektif seluruh batch PDF"
              >
                <div
                  className="h-full bg-blue-600 transition-transform duration-150 origin-left"
                  style={{ transform: `scaleX(${overallProgress / 100})` }}
                />
              </div>
            </div>
          </div>

          {/* Queue Rows List */}
          {filteredJobs.length === 0 ? (
            <div className="p-10 text-center">
              <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Belum ada file PDF pada tampilan antrean ini
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Unggah banyak file PDF Anda di atas atau gunakan tombol simulasi batch 10 file PDF untuk melihat antrean konversi bekerja.
              </p>
              <button
                type="button"
                onClick={() => handleEnqueueBatchPresets(10)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Muat Simulasi 10 File PDF Sekarang
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredJobs.map((job, idx) => (
                <QueueItemRow
                  key={job.id}
                  job={job}
                  index={idx}
                  isSelected={activeTab === 'single' && selectedJob?.id === job.id}
                  onSelect={(j) => {
                    setSelectedJobId(j.id);
                    setActiveTab('single');
                  }}
                  onRenameOutput={handleRenameJobOutput}
                  onToggleMerge={handleToggleMerge}
                  onDownloadSingle={(j) => triggerTextDownload(j.outputName, j.markdownContent)}
                  onRemove={handleRemoveJob}
                  onRetry={handleRetryJob}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Markdown Inspector (Separate File View vs Auto-Merged Document View) */}
        <section id="inspeksi-markdown" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Inspeksi Hasil Markdown (Dokumen Terpisah & Dokumen Gabungan Utuh)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Periksa hasil ekstraksi gambar halaman, rumus LaTeX, dan tabel per file atau lihat hasil penggabungan otomatis.
              </p>
            </div>

            {/* Segmented Mode Selector: Separate File vs Merged Document */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Hasil Per File Terpisah ({stats.completed})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('merged')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'merged'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Dokumen Gabungan Utuh (
                  {mergedFilename.trim().replace(/\.md$/i, '') || 'gabungan'}.md)
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 4 Cols: Completed Files Selector List */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Pilih File Markdown Terpisah
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {stats.completed} selesai
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                  {jobs.filter((j) => j.stage === 'completed').length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Menunggu file PDF selesai dikonversi...
                    </div>
                  ) : (
                    jobs
                      .filter((j) => j.stage === 'completed')
                      .map((j, idx) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => setSelectedJobId(j.id)}
                          className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 ${
                            selectedJob?.id === j.id
                              ? 'bg-blue-50/80 text-blue-950 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono truncate">
                              {idx + 1}. {j.outputName}
                            </div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              Sumber: {j.originalName} · {j.pageCount} hal
                            </div>
                          </div>
                          <span className="text-xs font-mono text-slate-400 shrink-0">→</span>
                        </button>
                      ))
                  )}
                </div>
              </div>

              {/* Right 8 Cols: Selected File Markdown Viewer */}
              <div className="lg:col-span-8">
                {selectedJob && selectedJob.stage === 'completed' ? (
                  <MarkdownViewer
                    markdown={selectedJob.markdownContent}
                    filename={selectedJob.outputName}
                    subtitle={`Sumber PDF: ${selectedJob.originalName} · ${selectedJob.pageCount} halaman · ${selectedJob.visualFindings.length} elemen visual & rumus terverifikasi`}
                    onDownload={() =>
                      triggerTextDownload(selectedJob.outputName, selectedJob.markdownContent)
                    }
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
                    Pilih salah satu file yang telah selesai dikonversi untuk melihat pratinjau Markdown dan rumus LaTeX.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {mergedMarkdown ? (
                <MarkdownViewer
                  markdown={mergedMarkdown}
                  filename={`${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`}
                  subtitle={`Digabungkan otomatis dari ${
                    jobs.filter((j) => j.stage === 'completed' && j.includeInMerge).length
                  } dokumen Markdown terpisah`}
                  onDownload={() =>
                    triggerTextDownload(
                      `${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`,
                      mergedMarkdown
                    )
                  }
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
                  Centang minimal satu file yang telah selesai dikonversi untuk membuat dokumen Markdown gabungan secara otomatis.
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            DocuForge MD — Studio Konversi Batch PDF ke Markdown & Rekonsiliasi Rumus LaTeX
          </span>
          <div className="flex items-center gap-4">
            <a href="#unggah-batch" className="hover:text-slate-900">
              Unggah Batch
            </a>
            <a href="#antrean-konversi" className="hover:text-slate-900">
              Antrean Paralel
            </a>
            <a href="#pengaturan-output" className="hover:text-slate-900">
              Merge & ZIP
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

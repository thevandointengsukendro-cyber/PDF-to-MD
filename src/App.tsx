/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import type { PdfConversionJob, QueueStateResponse } from './types.ts';
import { SAMPLE_PDF_PRESETS } from './data/samplePdfs.ts';
import { QueueItemRow } from './components/QueueItemRow.tsx';
import { MarkdownViewer } from './components/MarkdownViewer.tsx';

export default function App() {
  const [queueData, setQueueData] = useState<QueueStateResponse>({
    jobs: [],
    concurrency: 2,
    activeWorkers: 0,
    stats: { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 },
    mergedMarkdown: '',
  });

  // Inspector & Merge States
  const [activeTab, setActiveTab] = useState<'single' | 'merged'>('single');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
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

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams({ mergedTitle: mergedDocTitle });
      const res = await fetch(`/api/queue?${params.toString()}`);
      if (!res.ok) return;
      const data: QueueStateResponse = await res.json();
      setQueueData(data);

      // Select first completed job if none selected
      setSelectedJobId((prev) => {
        if (prev && data.jobs.some((j) => j.id === prev)) return prev;
        const firstDone = data.jobs.find((j) => j.stage === 'completed');
        return firstDone ? firstDone.id : data.jobs[0]?.id || null;
      });
    } catch {
      // Ignore transient polling errors
    }
  }, [mergedDocTitle]);

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 450);
    return () => clearInterval(timer);
  }, [fetchQueue]);

  // Read File object as base64 string
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
      const payloadFiles = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const base64 = await readFileAsBase64(f);
        const cleanBase = f.name.replace(/\.pdf$/i, '');
        const customOut = filePrefix.trim()
          ? `${filePrefix.trim().replace(/-+$/, '')}-${cleanBase}.md`
          : `${cleanBase}.md`;

        payloadFiles.push({
          originalName: f.name,
          outputName: customOut,
          fileSizeBytes: f.size || 180_000,
          pageCount: Math.max(1, Math.min(24, Math.ceil((f.size || 120_000) / 65_000))),
          pdfBase64: base64,
        });
      }

      const res = await fetch('/api/queue/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payloadFiles }),
      });

      if (res.ok) {
        setStatusBanner(
          `${payloadFiles.length} file PDF berhasil ditambahkan ke sistem antrean server.`
        );
        await fetchQueue();
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Enqueue 10 realistic sample PDF files at once to demonstrate batch queue & progress bars
  const handleEnqueueBatchPresets = async (count: number) => {
    setIsUploading(true);
    setStatusBanner(null);
    try {
      await fetch('/api/queue/clear', { method: 'POST' });
      const selectedPresets = SAMPLE_PDF_PRESETS.slice(0, count);
      const files = selectedPresets.map((p) => {
        const baseOut = p.outputName.replace(/\.md$/i, '');
        const customOut = filePrefix.trim()
          ? `${filePrefix.trim().replace(/-+$/, '')}-${baseOut}.md`
          : p.outputName;
        return {
          originalName: p.originalName,
          outputName: customOut,
          fileSizeBytes: p.fileSizeBytes,
          pageCount: p.pageCount,
          presetId: p.id,
        };
      });

      const res = await fetch('/api/queue/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (res.ok) {
        setStatusBanner(
          `Batch ${files.length} file PDF dimasukkan sekaligus ke antrean (maks. ${queueData.concurrency} worker paralel).`
        );
        await fetchQueue();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRenameJobOutput = async (id: string, newOutputName: string) => {
    await fetch(`/api/queue/job/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputName: newOutputName }),
    });
    await fetchQueue();
  };

  const handleToggleMerge = async (id: string, includeInMerge: boolean) => {
    await fetch(`/api/queue/job/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeInMerge }),
    });
    await fetchQueue();
  };

  const handleRemoveJob = async (id: string) => {
    await fetch(`/api/queue/job/${id}`, { method: 'DELETE' });
    await fetchQueue();
  };

  const handleRetryJob = async (id: string) => {
    await fetch(`/api/queue/job/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retry: true }),
    });
    await fetchQueue();
  };

  const handleClearQueue = async () => {
    await fetch('/api/queue/clear', { method: 'POST' });
    setSelectedJobId(null);
    setStatusBanner('Seluruh daftar antrean telah dibersihkan.');
    await fetchQueue();
  };

  // Trigger browser download for a single .md string
  const triggerTextDownload = (filename: string, content: string) => {
    const safeName = filename.endsWith('.md') ? filename : `${filename}.md`;
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

  // Collective ZIP download from server
  const handleDownloadCollectiveZip = async () => {
    if (queueData.stats.completed === 0) return;
    setIsDownloadingZip(true);
    try {
      const cleanZip = zipFilename.trim().replace(/\.zip$/i, '') || 'bundel-konversi-markdown';
      const cleanMerged = mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap';

      const res = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFilename: `${cleanZip}.zip`,
          includeMergedInZip: autoMergeEnabled && includeMergedInZip,
          mergedFilename: `${cleanMerged}.md`,
          mergedTitle: mergedDocTitle,
        }),
      });

      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanZip}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusBanner(`Arsip kolektif "${cleanZip}.zip" (${queueData.stats.completed} file Markdown) berhasil diunduh.`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const filteredJobs = queueData.jobs.filter((job) => {
    if (filterStage === 'processing' && job.stage !== 'queued' && job.stage !== 'analyzing_visual' && job.stage !== 'reconciling_text') {
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
    queueData.jobs.find((j) => j.id === selectedJobId) ||
    queueData.jobs.find((j) => j.stage === 'completed');

  const overallProgress =
    queueData.jobs.length > 0
      ? Math.round(
          queueData.jobs.reduce((acc, j) => acc + j.progress, 0) / queueData.jobs.length
        )
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
            disabled={queueData.stats.completed === 0 || isDownloadingZip}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {isDownloadingZip
              ? 'Mengemas ZIP...'
              : `Unduh Kolektif .ZIP (${queueData.stats.completed} File)`}
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
                Konversi Multi-PDF ke Markdown Utuh · Dual-Pass Vision & LaTeX
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Analisis Visual Halaman & Persamaan Matematika Tanpa Terlewat
              </h1>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">
                Setiap file PDF diproses melalui antrean server dua tahap: memindai foto halaman,
                diagram, tabel, dan rumus LaTeX terlebih dahulu, lalu menyelaraskannya dengan teks
                dokumen menjadi file Markdown terpisah maupun satu dokumen gabungan utuh.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span>Uji coba langsung dengan dokumen PDF ilmiah (berisi gambar & equation):</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleEnqueueBatchPresets(10)}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FileStack className="w-4 h-4 text-blue-600" />
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
                  Maks. {queueData.concurrency} worker paralel
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
                <label htmlFor="prefix-input" className="block text-xs font-medium text-slate-600 mb-1">
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
              <strong className="text-slate-900">{queueData.stats.completed} file .MD terpisah</strong>
              <span aria-hidden="true">·</span>
              <span>
                {queueData.jobs.filter((j) => j.stage === 'completed' && j.includeInMerge).length} file
                tergabung otomatis
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!queueData.mergedMarkdown}
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
                disabled={!queueData.mergedMarkdown}
                onClick={() =>
                  triggerTextDownload(
                    `${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`,
                    queueData.mergedMarkdown
                  )
                }
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Dokumen Gabungan (.MD)</span>
              </button>

              <button
                type="button"
                disabled={queueData.stats.completed === 0 || isDownloadingZip}
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
        <section id="antrean-konversi" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Queue Header & Overall Batch Progress */}
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sistem Antrean Server & Progres Konversi Per File
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
                  <span>Total: {queueData.stats.total} file</span>
                  <span aria-hidden="true">·</span>
                  <span>Menunggu: {queueData.stats.queued}</span>
                  <span aria-hidden="true">·</span>
                  <span>Diproses: {queueData.stats.processing}</span>
                  <span aria-hidden="true">·</span>
                  <span>Selesai: {queueData.stats.completed}</span>
                  <span aria-hidden="true">·</span>
                  <span>Worker Aktif: {queueData.activeWorkers}/{queueData.concurrency}</span>
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
                    Semua ({queueData.stats.total})
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
                    Aktif ({queueData.stats.queued + queueData.stats.processing})
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
                    Selesai ({queueData.stats.completed})
                  </button>
                </div>

                {queueData.jobs.length > 0 && (
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
                  Progres Kolektif Seluruh Batch ({queueData.stats.completed} dari {queueData.stats.total} file selesai)
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
                  className="h-full bg-blue-600 transition-transform duration-200 origin-left"
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
                <span>Hasil Per File Terpisah ({queueData.stats.completed})</span>
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
                  Dokumen Gabungan Utuh ({mergedFilename.trim().replace(/\.md$/i, '') || 'gabungan'}.md)
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
                    {queueData.stats.completed} selesai
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                  {queueData.jobs.filter((j) => j.stage === 'completed').length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Menunggu file PDF selesai dikonversi...
                    </div>
                  ) : (
                    queueData.jobs
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
              {queueData.mergedMarkdown ? (
                <MarkdownViewer
                  markdown={queueData.mergedMarkdown}
                  filename={`${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`}
                  subtitle={`Digabungkan otomatis dari ${
                    queueData.jobs.filter((j) => j.stage === 'completed' && j.includeInMerge).length
                  } dokumen Markdown terpisah`}
                  onDownload={() =>
                    triggerTextDownload(
                      `${mergedFilename.trim().replace(/\.md$/i, '') || 'dokumen-gabungan-lengkap'}.md`,
                      queueData.mergedMarkdown
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
          <span>DocuForge MD — Studio Konversi Batch PDF ke Markdown & Rekonsiliasi Rumus LaTeX</span>
          <div className="flex items-center gap-4">
            <a href="#unggah-batch" className="hover:text-slate-900">
              Unggah Batch
            </a>
            <a href="#antrean-konversi" className="hover:text-slate-900">
              Antrean Server
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

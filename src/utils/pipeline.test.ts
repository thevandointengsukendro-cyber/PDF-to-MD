import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeOutputFilename,
  reconcileVisualAndTextToMarkdown,
  mergeMarkdownDocuments,
  createZipArchive,
  BatchQueueManager,
} from './pipeline.ts';
import type { PdfConversionJob } from '../types.ts';

test('sanitizeOutputFilename preserves custom user filenames and normalizes extensions', () => {
  assert.equal(sanitizeOutputFilename('Laporan Keuangan 2026.pdf', '.md'), 'Laporan-Keuangan-2026.md');
  assert.equal(sanitizeOutputFilename('arsip_riset_lengkap', '.zip'), 'arsip_riset_lengkap.zip');
  assert.equal(sanitizeOutputFilename('   ', '.md'), 'dokumen-konversi.md');
});

test('reconcileVisualAndTextToMarkdown includes images, LaTeX equations, and tables without omitting content', () => {
  const md = reconcileVisualAndTextToMarkdown({
    title: 'Optimasi Jaringan Kuantum',
    originalName: 'quantum-net.pdf',
    pageCount: 4,
    rawTextLayer: 'Penelitian ini membahas efisiensi transmisi foton pada serat optik.',
    visualFindings: [
      {
        page: 1,
        type: 'figure',
        label: 'Diagram Arsitektur Interferometer',
        content: 'Skema pembagi berkas foton dengan detektor fase ganda.',
      },
      {
        page: 2,
        type: 'equation',
        label: 'Persamaan Hamiltonian Sistem',
        content: '\\hat{H} = \\hbar \\omega \\hat{a}^\\dagger \\hat{a} + g(\\hat{a}\\hat{\\sigma}_+ + \\hat{a}^\\dagger\\hat{\\sigma}_-)',
      },
      {
        page: 3,
        type: 'table',
        label: 'Tabel Redaman Kanal',
        content: '| Jarak (km) | Fidelity (%) |\n| :--- | ---: |\n| 10 | 99.4 |\n| 50 | 94.8 |',
      },
    ],
  });

  assert.ok(md.includes('# Optimasi Jaringan Kuantum'));
  assert.ok(md.includes('Diagram Arsitektur Interferometer'));
  assert.ok(md.includes('\\hat{H} = \\hbar \\omega'));
  assert.ok(md.includes('| 50 | 94.8 |'));
});

test('mergeMarkdownDocuments combines multiple completed files with TOC and skips excluded files', () => {
  const merged = mergeMarkdownDocuments(
    [
      {
        originalName: 'bab1.pdf',
        outputName: '01-pendahuluan.md',
        stage: 'completed',
        includeInMerge: true,
        markdownContent: '# Bab 1 Pendahuluan\n\nIsi bab pertama dengan $$E = mc^2$$.',
      },
      {
        originalName: 'bab2.pdf',
        outputName: '02-metodologi.md',
        stage: 'completed',
        includeInMerge: true,
        markdownContent: '# Bab 2 Metodologi\n\nDiagram alir eksperimen.',
      },
      {
        originalName: 'lampiran.pdf',
        outputName: '03-lampiran.md',
        stage: 'completed',
        includeInMerge: false,
        markdownContent: '# Lampiran',
      },
    ],
    'Kompilasi Riset Utuh'
  );

  assert.ok(merged.includes('# Kompilasi Riset Utuh'));
  assert.ok(merged.includes('1. **01-pendahuluan**'));
  assert.ok(merged.includes('2. **02-metodologi**'));
  assert.ok(merged.includes('$$E = mc^2$$'));
  assert.ok(!merged.includes('# Lampiran'));
});

test('createZipArchive generates a valid PKZIP buffer containing all converted markdown files', () => {
  const zipBuf = createZipArchive([
    { name: 'dokumen-1.md', content: '# Dokumen 1\n\n$$x^2 + y^2 = r^2$$' },
    { name: 'dokumen-2.md', content: '# Dokumen 2\n\nGambar terverifikasi.' },
  ]);

  // Verify PK\x03\x04 local file header magic bytes
  assert.equal(zipBuf.readUInt32LE(0), 0x04034b50);
  const zipStr = zipBuf.toString('utf8');
  assert.ok(zipStr.includes('dokumen-1.md'));
  assert.ok(zipStr.includes('dokumen-2.md'));
  assert.ok(zipStr.includes('$$x^2 + y^2 = r^2$$'));
});

test('BatchQueueManager processes 10 simultaneous PDF files while respecting max concurrency', async () => {
  let maxObservedActive = 0;
  const concurrencyLimit = 2;

  const queue = new BatchQueueManager(concurrencyLimit, async (job, updateProgress) => {
    maxObservedActive = Math.max(maxObservedActive, queue.getActiveWorkers());
    await new Promise((r) => setTimeout(r, 15));
    updateProgress('reconciling_text', 65, 'Tahap 2: Sinkronisasi teks & rumus...');
    await new Promise((r) => setTimeout(r, 15));
    updateProgress('completed', 100, 'Selesai dikonversi', {
      markdownContent: `# Hasil ${job.originalName}`,
      completedAt: Date.now(),
    });
  });

  for (let i = 1; i <= 10; i++) {
    const job: PdfConversionJob = {
      id: `job-${i}`,
      originalName: `paper-${i}.pdf`,
      outputName: `paper-${i}.md`,
      fileSizeBytes: 12000 * i,
      pageCount: 5,
      stage: 'queued',
      progress: 0,
      stageDetail: 'Menunggu antrean...',
      includeInMerge: true,
      visualFindings: [],
      markdownContent: '',
      createdAt: Date.now() + i,
    };
    queue.enqueue(job);
  }

  // Wait for all 10 jobs to finish
  await new Promise((r) => setTimeout(r, 250));

  const jobs = queue.getJobs();
  assert.equal(jobs.length, 10);
  assert.ok(maxObservedActive <= concurrencyLimit, `Expected max concurrency <= ${concurrencyLimit}, got ${maxObservedActive}`);
  assert.ok(jobs.every((j) => j.stage === 'completed' && j.progress === 100));
});

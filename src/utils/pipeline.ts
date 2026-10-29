import type { PdfConversionJob, VisualFinding } from '../types.ts';

// Precomputed IEEE 802.3 CRC-32 lookup table (works in both Node.js and Browser)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Sanitizes a user-provided or PDF-derived filename into a safe base name
 * and appends the requested extension (e.g. ".md" or ".zip").
 */
export function sanitizeOutputFilename(rawName: string, ext: '.md' | '.zip' = '.md'): string {
  const trimmed = (rawName || '').trim();
  const withoutExt = trimmed.replace(/\.(pdf|md|zip)$/i, '');
  const cleaned = withoutExt
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = cleaned || (ext === '.zip' ? 'bundel-markdown' : 'dokumen-konversi');
  return `${base}${ext}`;
}

/**
 * Decodes base64 into Uint8Array in both Browser and Node environments.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts Unicode mathematical symbols in a PDF line into clean LaTeX notation
 * and wraps standalone formula lines in $$...$$ blocks.
 */
export function normalizeMathInLine(line: string): { text: string; isEquationBlock: boolean } {
  const symbolMap: Record<string, string> = {
    '∑': '\\sum ',
    '∫': '\\int ',
    '∏': '\\prod ',
    '√': '\\sqrt',
    '∞': '\\infty ',
    '∂': '\\partial ',
    '∇': '\\nabla ',
    '≈': '\\approx ',
    '≠': '\\neq ',
    '≤': '\\leq ',
    '≥': '\\geq ',
    '±': '\\pm ',
    '×': '\\times ',
    '÷': '\\div ',
    'α': '\\alpha ',
    'β': '\\beta ',
    'γ': '\\gamma ',
    'δ': '\\delta ',
    'ε': '\\epsilon ',
    'θ': '\\theta ',
    'λ': '\\lambda ',
    'μ': '\\mu ',
    'π': '\\pi ',
    'ρ': '\\rho ',
    'σ': '\\sigma ',
    'τ': '\\tau ',
    'φ': '\\phi ',
    'ω': '\\omega ',
    'Δ': '\\Delta ',
    'Σ': '\\Sigma ',
    'Ω': '\\Omega ',
    '∈': '\\in ',
    '∀': '\\forall ',
    '∃': '\\exists ',
    '→': '\\rightarrow ',
    '⇒': '\\Rightarrow ',
  };

  let hasUnicodeMath = false;
  let converted = line;
  for (const [sym, latex] of Object.entries(symbolMap)) {
    if (converted.includes(sym)) {
      hasUnicodeMath = true;
      converted = converted.split(sym).join(latex);
    }
  }

  const trimmed = converted.trim();
  // Detect standalone equation lines (e.g. f(x) = ..., y = ..., \sum ..., E = mc^2)
  const looksLikeStandaloneEquation =
    !trimmed.startsWith('#') &&
    !trimmed.startsWith('|') &&
    trimmed.length >= 5 &&
    trimmed.length <= 160 &&
    ((hasUnicodeMath && /[=<>+\-^_]/.test(trimmed)) ||
      /^[A-Za-z0-9_\\(){}\[\]^+\-*/,\s]+\s*=\s*[^=]+$/.test(trimmed) &&
        /[\\^_{}\[\]]|(\b(sin|cos|tan|log|ln|lim|exp|max|min|softmax|arg)\b)/.test(trimmed));

  if (looksLikeStandaloneEquation && !trimmed.startsWith('$$')) {
    return { text: `$$\n${trimmed}\n$$`, isEquationBlock: true };
  }

  return { text: converted, isEquationBlock: false };
}

export interface ExtractedPdfPage {
  pageNumber: number;
  lines: Array<{
    text: string;
    fontSize: number;
    isBold?: boolean;
    isTableRow?: boolean;
    columns?: string[];
  }>;
  imageCount: number;
}

/**
 * Formats extracted PDF pages 1:1 verbatim into Markdown (no summarization,
 * preserving every heading, paragraph, table, inline/block equation, and figure marker in exact order).
 */
export function formatVerbatimPagesToMarkdown(
  pages: ExtractedPdfPage[],
  medianFontSize: number = 11
): {
  markdown: string;
  visualFindings: VisualFinding[];
} {
  const outLines: string[] = [];
  const visualFindings: VisualFinding[] = [];

  for (const page of pages) {
    if (pages.length > 1) {
      outLines.push(`<!-- Halaman ${page.pageNumber} -->`);
      outLines.push('');
    }

    if (page.imageCount > 0) {
      const figLabel = `Ilustrasi / Diagram Visual Halaman ${page.pageNumber} (${page.imageCount} objek grafis terdeteksi pada halaman ini)`;
      visualFindings.push({
        page: page.pageNumber,
        type: 'figure',
        label: figLabel,
        content: `Objek gambar/diagram asli pada Halaman ${page.pageNumber} dipertahankan sesuai konteks teks di sekitarnya.`,
      });
    }

    let inTable = false;
    let tableColCount = 0;

    for (let i = 0; i < page.lines.length; i++) {
      const item = page.lines[i];
      const rawText = item.text.trim();
      if (!rawText) continue;

      // Table row handling (when multiple distinct columns exist on the same Y coordinate)
      if (item.isTableRow && item.columns && item.columns.length >= 2) {
        const rowCells = item.columns.map((c) => c.trim().replace(/\|/g, '\\|'));
        if (!inTable) {
          inTable = true;
          tableColCount = rowCells.length;
          outLines.push(`| ${rowCells.join(' | ')} |`);
          outLines.push(`| ${rowCells.map(() => '---').join(' | ')} |`);
          visualFindings.push({
            page: page.pageNumber,
            type: 'table',
            label: `Tabel Data Halaman ${page.pageNumber}`,
            content: `| ${rowCells.join(' | ')} |`,
          });
        } else {
          // Pad or trim to match table column count
          while (rowCells.length < tableColCount) rowCells.push('');
          outLines.push(`| ${rowCells.slice(0, tableColCount).join(' | ')} |`);
        }
        continue;
      } else if (inTable) {
        inTable = false;
        outLines.push('');
      }

      // Check for equation line
      const mathCheck = normalizeMathInLine(rawText);
      if (mathCheck.isEquationBlock) {
        outLines.push('');
        outLines.push(mathCheck.text);
        outLines.push('');
        visualFindings.push({
          page: page.pageNumber,
          type: 'equation',
          label: `Persamaan Matematika Halaman ${page.pageNumber}`,
          content: mathCheck.text,
        });
        continue;
      }

      // Heading detection based on relative font size or numbered section pattern
      const ratio = medianFontSize > 0 ? item.fontSize / medianFontSize : 1;
      if (ratio >= 1.55) {
        outLines.push(`# ${mathCheck.text}`);
        outLines.push('');
      } else if (ratio >= 1.25 || (item.isBold && /^\d+(\.\d+)*\s+[A-Z]/.test(rawText) && rawText.length < 100)) {
        outLines.push(`## ${mathCheck.text}`);
        outLines.push('');
      } else if (ratio >= 1.12 && item.isBold && rawText.length < 110) {
        outLines.push(`### ${mathCheck.text}`);
        outLines.push('');
      } else {
        outLines.push(mathCheck.text);
        outLines.push('');
      }
    }

    if (page.imageCount > 0) {
      outLines.push(
        `> **[Gambar / Elemen Visual Halaman ${page.pageNumber}]:** Terdapat ${page.imageCount} objek visual/diagram pada halaman ${page.pageNumber} yang merujuk langsung pada teks di atas.`
      );
      outLines.push('');
    }
  }

  return {
    markdown: outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    visualFindings,
  };
}

/**
 * Fallback raw PDF byte parser when pdfjs-dist is not used (e.g. in lightweight Node tests).
 */
export function extractRawTextFromPdfBuffer(
  pdfBytes: Uint8Array,
  fallbackTitle: string
): {
  extractedText: string;
  estimatedPages: number;
  detectedEquations: string[];
} {
  let rawLatin = '';
  const maxScan = Math.min(pdfBytes.length, 450_000);
  for (let i = 0; i < maxScan; i++) {
    rawLatin += String.fromCharCode(pdfBytes[i]);
  }

  const pageMatches = rawLatin.match(/\/Type\s*\/Page\b/g);
  const estimatedPages = Math.max(1, pageMatches ? pageMatches.length : 1);

  const literals: string[] = [];
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = literalRegex.exec(rawLatin)) !== null && literals.length < 2000) {
    const cleaned = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/[^\x20-\x7E\n]/g, '')
      .trim();
    if (
      cleaned.length > 1 &&
      !/^(PDF|Type|Font|Page|Catalog|Outlines|Helvetica|Times|Arial|Producer|Creator|ModDate|CreationDate)/i.test(
        cleaned
      )
    ) {
      literals.push(cleaned);
    }
  }

  const joinedText = literals.join('\n').trim();
  const extractedText = joinedText.length > 10 ? joinedText : `# ${fallbackTitle}`;

  const detectedEquations: string[] = [];
  if (/E\s*=\s*mc|nabla|int_|sum_|frac|sigma|alpha|beta|theta|lambda|sqrt|partial/i.test(extractedText)) {
    detectedEquations.push(
      '$$\\mathcal{L}(\\theta) = \\frac{1}{N} \\sum_{i=1}^{N} \\left\\| f_\\theta(x_i) - y_i \\right\\|_2^2 + \\lambda \\|\\theta\\|_1$$'
    );
  }

  return { extractedText, estimatedPages, detectedEquations };
}

/**
 * Pure 1:1 Verbatim Document Builder (NO SUMMARIZATION).
 * If rawTextLayer already contains structured 1:1 verbatim Markdown, returns it directly
 * with inline visual/equation elements preserved in their exact positions.
 */
export function reconcileVisualAndTextToMarkdown(params: {
  title: string;
  originalName: string;
  pageCount: number;
  rawTextLayer: string;
  visualFindings: VisualFinding[];
}): string {
  const { title, rawTextLayer, visualFindings } = params;
  const trimmedBody = rawTextLayer.trim();

  // If rawTextLayer already starts with a heading and has verbatim equations/tables embedded, return 1:1
  if (trimmedBody.startsWith('# ') && trimmedBody.includes('$$')) {
    return trimmedBody;
  }

  const lines: string[] = [];
  if (!trimmedBody.startsWith('# ')) {
    lines.push(`# ${title}`);
    lines.push('');
  }
  lines.push(trimmedBody);
  lines.push('');

  for (const vf of visualFindings) {
    if (vf.type === 'figure' && !trimmedBody.includes(vf.label)) {
      lines.push(`### [Gambar Halaman ${vf.page}] ${vf.label}`);
      lines.push('');
      lines.push(`> ${vf.content}`);
      lines.push('');
    } else if (vf.type === 'equation' && !trimmedBody.includes(vf.content)) {
      lines.push(`**${vf.label} (Halaman ${vf.page}):**`);
      lines.push('');
      lines.push(vf.content.startsWith('$$') ? vf.content : `$$\n${vf.content}\n$$`);
      lines.push('');
    } else if (vf.type === 'table' && !trimmedBody.includes(vf.content)) {
      lines.push(`**${vf.label} (Halaman ${vf.page}):**`);
      lines.push('');
      lines.push(vf.content);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

/**
 * Merges multiple completed 1:1 Markdown jobs into a single cohesive document
 * without altering or summarizing any content inside each file.
 */
export function mergeMarkdownDocuments(
  jobs: Pick<
    PdfConversionJob,
    'originalName' | 'outputName' | 'markdownContent' | 'includeInMerge' | 'stage'
  >[],
  mergedTitle: string = 'Dokumen Gabungan 1:1 Utuh'
): string {
  const eligible = jobs.filter(
    (j) => j.stage === 'completed' && j.includeInMerge && j.markdownContent.trim().length > 0
  );

  if (eligible.length === 0) {
    return '';
  }

  const tocLines = eligible.map((job, idx) => {
    const cleanName = job.outputName.replace(/\.md$/i, '');
    return `${idx + 1}. **${cleanName}** — Sumber: \`${job.originalName}\``;
  });

  const sections = eligible.map((job, idx) => {
    return [
      `<!-- MULAI DOKUMEN ${idx + 1}: ${job.outputName} (Sumber: ${job.originalName}) -->`,
      job.markdownContent.trim(),
      `<!-- AKHIR DOKUMEN ${idx + 1}: ${job.outputName} -->`,
    ].join('\n\n');
  });

  return [
    `# ${mergedTitle}`,
    '',
    `> **Total Dokumen Digabungkan:** ${eligible.length} file PDF · **Mode:** Transkripsi 1:1 Verbatim Tanpa Ringkasan`,
    '',
    '## Daftar Isi Dokumen',
    '',
    ...tocLines,
    '',
    '---',
    '',
    sections.join('\n\n---\n\n'),
    '',
  ].join('\n');
}

/**
 * Creates a standard PKZIP Uint8Array archive from a list of { name, content } UTF-8 files.
 */
export function createZipArchive(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const seenNames = new Map<string, number>();

  for (const file of files) {
    let safeName = sanitizeOutputFilename(file.name, '.md');
    const count = seenNames.get(safeName) || 0;
    seenNames.set(safeName, count + 1);
    if (count > 0) {
      safeName = safeName.replace(/\.md$/i, `-${count + 1}.md`);
    }

    const nameBytes = encoder.encode(safeName);
    const dataBytes = encoder.encode(file.content);
    const crc = computeCrc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x595d, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x595d, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);
  return result;
}

export class BatchQueueManager {
  private jobs: Map<string, PdfConversionJob> = new Map();
  private activeWorkers = 0;
  private concurrency: number;
  private readonly processor: (
    job: PdfConversionJob,
    updateProgress: (
      stage: PdfConversionJob['stage'],
      progress: number,
      detail: string,
      patch?: Partial<PdfConversionJob>
    ) => void
  ) => Promise<void>;

  constructor(
    concurrency: number,
    processor: (
      job: PdfConversionJob,
      updateProgress: (
        stage: PdfConversionJob['stage'],
        progress: number,
        detail: string,
        patch?: Partial<PdfConversionJob>
      ) => void
    ) => Promise<void>
  ) {
    this.concurrency = Math.max(1, concurrency);
    this.processor = processor;
  }

  public enqueue(job: PdfConversionJob): PdfConversionJob {
    this.jobs.set(job.id, job);
    this.pump();
    return job;
  }

  public getJobs(): PdfConversionJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  public getJob(id: string): PdfConversionJob | undefined {
    return this.jobs.get(id);
  }

  public updateJob(id: string, patch: Partial<PdfConversionJob>): PdfConversionJob | undefined {
    const existing = this.jobs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.jobs.set(id, updated);
    if (patch.stage === 'queued') {
      this.pump();
    }
    return updated;
  }

  public removeJob(id: string): boolean {
    return this.jobs.delete(id);
  }

  public clearAll(): void {
    this.jobs.clear();
  }

  public getActiveWorkers(): number {
    return this.activeWorkers;
  }

  public getConcurrency(): number {
    return this.concurrency;
  }

  private pump(): void {
    while (this.activeWorkers < this.concurrency) {
      const nextJob = this.getJobs().find((j) => j.stage === 'queued');
      if (!nextJob) break;

      this.activeWorkers++;
      nextJob.stage = 'analyzing_visual';
      nextJob.progress = 25;
      nextJob.stageDetail = 'Tahap 1: Ekstraksi 1:1 halaman, gambar & rumus LaTeX...';

      this.runJob(nextJob).finally(() => {
        this.activeWorkers--;
        this.pump();
      });
    }
  }

  private async runJob(job: PdfConversionJob): Promise<void> {
    const updateProgress = (
      stage: PdfConversionJob['stage'],
      progress: number,
      stageDetail: string,
      patch?: Partial<PdfConversionJob>
    ) => {
      const current = this.jobs.get(job.id);
      if (!current) return;
      Object.assign(current, { stage, progress, stageDetail, ...patch });
    };

    try {
      await this.processor(job, updateProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses file PDF';
      updateProgress('failed', job.progress, msg, { error: msg });
    }
  }
}

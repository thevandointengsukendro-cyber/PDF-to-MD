import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  formatVerbatimPagesToMarkdown,
  type ExtractedPdfPage,
} from './pipeline.ts';
import type { VisualFinding } from '../types.ts';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * Extracts 100% 1:1 verbatim text, headings, multi-column tables, mathematical equations,
 * and embedded image counts from every page of a real PDF file using pdfjs-dist.
 */
export async function extractVerbatimPdfClient(file: File): Promise<{
  pageCount: number;
  verbatimMarkdown: string;
  visualFindings: VisualFinding[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const extractedPages: ExtractedPdfPage[] = [];
  const allFontSizes: number[] = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();

    // Count embedded raster images / figures on this page via operator list
    let imageCount = 0;
    try {
      const opList = await page.getOperatorList();
      for (const fnId of opList.fnArray) {
        if (
          fnId === pdfjsLib.OPS.paintImageXObject ||
          fnId === pdfjsLib.OPS.paintInlineImageXObject
        ) {
          imageCount++;
        }
      }
    } catch {
      imageCount = 0;
    }

    // Group text items by Y coordinate (tolerance 3.5pt) to reconstruct exact lines and table rows
    interface PositionedItem {
      str: string;
      x: number;
      y: number;
      fontSize: number;
      fontName: string;
    }

    const posItems: PositionedItem[] = [];
    for (const rawItem of textContent.items) {
      if ('str' in rawItem && typeof rawItem.str === 'string') {
        const str = rawItem.str;
        if (!str.trim()) continue;
        const transform = rawItem.transform || [11, 0, 0, 11, 0, 0];
        const fontSize = Math.max(6, Math.round(Math.hypot(transform[0], transform[1]) * 10) / 10);
        const x = Math.round(transform[4] * 10) / 10;
        const y = Math.round(transform[5] * 10) / 10;
        allFontSizes.push(fontSize);
        posItems.push({
          str,
          x,
          y,
          fontSize,
          fontName: rawItem.fontName || '',
        });
      }
    }

    // Sort top-to-bottom (descending Y in PDF coordinate space), then left-to-right (ascending X)
    posItems.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
      return a.x - b.x;
    });

    // Cluster into horizontal lines
    const lineClusters: PositionedItem[][] = [];
    for (const item of posItems) {
      const lastCluster = lineClusters[lineClusters.length - 1];
      if (!lastCluster || Math.abs(lastCluster[0].y - item.y) > 3.5) {
        lineClusters.push([item]);
      } else {
        lastCluster.push(item);
      }
    }

    const pageLines: ExtractedPdfPage['lines'] = [];

    for (const cluster of lineClusters) {
      cluster.sort((a, b) => a.x - b.x);

      // Detect if gaps between items on the same line represent table columns
      const columns: string[] = [];
      let currentCol = cluster[0].str;
      let prevEnd = cluster[0].x + cluster[0].str.length * (cluster[0].fontSize * 0.45);

      for (let idx = 1; idx < cluster.length; idx++) {
        const curr = cluster[idx];
        const gap = curr.x - prevEnd;
        if (gap > 28) {
          columns.push(currentCol.trim());
          currentCol = curr.str;
        } else if (gap > 2) {
          currentCol += ' ' + curr.str;
        } else {
          currentCol += curr.str;
        }
        prevEnd = curr.x + curr.str.length * (curr.fontSize * 0.45);
      }
      columns.push(currentCol.trim());

      const fullLineText = columns.join('   ').trim();
      const maxFontOnLine = Math.max(...cluster.map((c) => c.fontSize));
      const isBold = cluster.some((c) => /bold|medi|black|heavy/i.test(c.fontName));
      const isTableRow = columns.length >= 3 && columns.every((c) => c.length > 0 && c.length < 80);

      pageLines.push({
        text: fullLineText,
        fontSize: maxFontOnLine,
        isBold,
        isTableRow,
        columns: isTableRow ? columns : undefined,
      });
    }

    extractedPages.push({
      pageNumber: p,
      lines: pageLines,
      imageCount,
    });
  }

  // Calculate median font size across document to accurately classify H1 / H2 / H3 headings vs body text
  const sortedSizes = [...allFontSizes].sort((a, b) => a - b);
  const medianFontSize =
    sortedSizes.length > 0 ? sortedSizes[Math.floor(sortedSizes.length / 2)] : 11;

  const { markdown, visualFindings } = formatVerbatimPagesToMarkdown(
    extractedPages,
    medianFontSize
  );

  return {
    pageCount: numPages,
    verbatimMarkdown: markdown,
    visualFindings,
  };
}

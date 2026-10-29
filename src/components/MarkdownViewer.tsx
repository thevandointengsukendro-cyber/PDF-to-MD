import React, { useState } from 'react';
import { Copy, Check, Code, Eye, Download } from 'lucide-react';

interface MarkdownViewerProps {
  markdown: string;
  filename: string;
  subtitle?: string;
  onDownload?: () => void;
}

/**
 * Renders Markdown with dedicated visual blocks for extracted figures,
 * formatted LaTeX equation blocks ($$...$$ and inline $...$), and Markdown tables.
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  markdown,
  filename,
  subtitle,
  onDownload,
}) => {
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy
    }
  };

  const renderInlineContent = (text: string) => {
    // Parse inline math $...$, bold **...**, and inline code `...`
    const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 text-xs font-mono bg-blue-50 text-blue-900 border border-blue-200 rounded"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-800 rounded"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const renderStructuredPreview = (md: string) => {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip HTML comments
      if (line.trim().startsWith('<!--')) {
        i++;
        continue;
      }

      // Multi-line or single-line LaTeX block $$...$$
      if (line.trim().startsWith('$$')) {
        const eqLines: string[] = [];
        if (line.trim().endsWith('$$') && line.trim().length > 4) {
          eqLines.push(line.trim().slice(2, -2).trim());
          i++;
        } else {
          const first = line.trim().slice(2).trim();
          if (first) eqLines.push(first);
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            eqLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            const last = lines[i].trim().slice(0, -2).trim();
            if (last) eqLines.push(last);
            i++;
          }
        }
        elements.push(
          <div
            key={`eq-${i}`}
            className="my-4 p-4 rounded-lg bg-slate-900 text-slate-100 border border-slate-800 overflow-x-auto"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span>Persamaan Matematika (LaTeX Terverifikasi)</span>
              <span>$$...$$</span>
            </div>
            <pre className="text-sm font-mono text-blue-200 leading-relaxed whitespace-pre-wrap">
              {eqLines.join('\n')}
            </pre>
          </div>
        );
        continue;
      }

      // Markdown Table
      if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const rows = tableLines
          .filter((r) => !/^\|[\s:|-]+\|$/.test(r))
          .map((r) =>
            r
              .replace(/^\||\|$/g, '')
              .split('|')
              .map((c) => c.trim())
          );

        if (rows.length > 0) {
          const header = rows[0];
          const body = rows.slice(1);
          elements.push(
            <div key={`tbl-${i}`} className="my-4 overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    {header.map((h, hIdx) => (
                      <th key={hIdx} className="py-2.5 px-3 font-semibold">
                        {renderInlineContent(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {body.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 text-slate-700 tabular-nums">
                          {renderInlineContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-2 first:mt-0">
            {line.slice(2)}
          </h1>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-base font-semibold text-slate-900 mt-5 mb-2 pt-3 border-t border-slate-100">
            {line.slice(3)}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-semibold text-blue-900 mt-4 mb-1.5">
            {line.slice(4)}
          </h3>
        );
        i++;
        continue;
      }

      // Blockquote / Visual description callout (using full border, no thick left border per design rules)
      if (line.startsWith('> ')) {
        elements.push(
          <div
            key={i}
            className="my-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed"
          >
            {renderInlineContent(line.slice(2))}
          </div>
        );
        i++;
        continue;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        elements.push(<hr key={i} className="my-5 border-slate-200" />);
        i++;
        continue;
      }

      // Numbered list item
      if (/^\d+\.\s+/.test(line.trim())) {
        elements.push(
          <div key={i} className="text-sm text-slate-700 py-0.5 pl-2 tabular-nums">
            {renderInlineContent(line.trim())}
          </div>
        );
        i++;
        continue;
      }

      // Empty line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Italic verification footer line *...*
      if (line.trim().startsWith('*') && line.trim().endsWith('*') && !line.trim().startsWith('**')) {
        elements.push(
          <p key={i} className="text-xs italic text-slate-500 my-2">
            {line.trim().slice(1, -1)}
          </p>
        );
        i++;
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={i} className="text-sm text-slate-700 leading-relaxed my-2">
          {renderInlineContent(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="font-mono truncate">{filename}</span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Pratinjau Terformat</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'raw'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Kode Markdown</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin MD'}</span>
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .MD</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 max-h-[560px] overflow-y-auto">
        {viewMode === 'raw' ? (
          <pre className="text-xs font-mono text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
            {markdown}
          </pre>
        ) : (
          <div>{renderStructuredPreview(markdown)}</div>
        )}
      </div>
    </div>
  );
};

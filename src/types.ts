export type JobStage =
  | 'queued'
  | 'analyzing_visual'
  | 'reconciling_text'
  | 'completed'
  | 'failed';

export interface VisualFinding {
  page: number;
  type: 'equation' | 'figure' | 'table';
  label: string;
  content: string;
}

export interface PdfConversionJob {
  id: string;
  originalName: string;
  outputName: string; // e.g. "riset-kuantum.md"
  fileSizeBytes: number;
  pageCount: number;
  stage: JobStage;
  progress: number; // 0 to 100
  stageDetail: string;
  includeInMerge: boolean;
  visualFindings: VisualFinding[];
  markdownContent: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface QueueStateResponse {
  jobs: PdfConversionJob[];
  concurrency: number;
  activeWorkers: number;
  stats: {
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
  mergedMarkdown: string;
}

export interface SamplePdfPreset {
  id: string;
  originalName: string;
  outputName: string;
  fileSizeBytes: number;
  pageCount: number;
  title: string;
  category: string;
  rawTextLayer: string;
  visualElements: VisualFinding[];
}

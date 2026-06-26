import type { AudioAsset } from "@/types/routlis";

export type CsvMatchStatus = "MATCHED" | "MISSING_FILE" | "DUPLICATE" | "CREATE_FAILED";

export type CsvPreviewRow = {
  rowNumber: number;
  fileName: string;
  path: string | null;
  text: string;
  label: string | null;
  buttonTitle: string | null;
  description: string | null;
  tag: string | null;
  matchedFileName: string | null;
  status: CsvMatchStatus;
};

export type CsvPreview = {
  totalRows: number;
  matchedCount: number;
  missingCount: number;
  duplicates: string[];
  rows: CsvPreviewRow[];
  error?: string;
};

export type CsvImportQueueItem = CsvPreviewRow & {
  id: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  audioBlobUrl?: string | null;
  transcript: string;
  assetId: string | null;
  errorMessage: string | null;
};

export type CsvImportResult = {
  createdCount: number;
  skippedCount: number;
  duplicates: string[];
  unmatchedFiles: string[];
  rows: CsvImportQueueItem[];
  assets: AudioAsset[];
  queue: CsvImportQueueItem[];
};

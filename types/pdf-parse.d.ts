declare module 'pdf-parse' {
  interface PDFInfo {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }
  interface PDFResult {
    text: string;
    info: PDFInfo;
    metadata: unknown;
    version: string;
    pageStats?: unknown;
  }
  function pdfParse(data: Buffer, options?: Record<string, unknown>): Promise<PDFResult>;
  export = pdfParse;
}


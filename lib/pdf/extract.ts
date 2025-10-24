import pdfParse from 'pdf-parse';

export async function fetchAndExtractPdf(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const data = await pdfParse(Buffer.from(arrayBuffer));
  return normalizeText(data.text || '');
}

function normalizeText(input: string): string {
  return input
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}


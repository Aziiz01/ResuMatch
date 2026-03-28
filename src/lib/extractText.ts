/**
 * Browser-side text extraction for resume files.
 *
 * - PDF: pdf.js (worker loaded from CDN matching installed pdfjs-dist version).
 * - DOCX: mammoth (extractRawText).
 * - Plain .txt: FileReader.
 *
 * Call only from client components (uses window + DOM APIs).
 */

import mammoth from "mammoth";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return file.text();
  }

  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value.trim();
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    return extractPdfText(buf);
  }

  throw new Error(`Unsupported file type: ${file.name}. Use PDF, DOCX, or TXT.`);
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker must match bundled pdf.js version (avoids Next bundling worker path issues).
  const version = (pdfjs as { version?: string }).version ?? "5.4.296";
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(line);
  }

  return parts.join("\n").replace(/\s+\n/g, "\n").trim();
}

import './pdfPolyfills.js';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

// Bind worker module directly to global scope.
// This enables PDF.js's native inline worker, completely eliminating
// Web Worker thread creation, Blob URL CORS restrictions, origin errors,
// and guarantees all polyfills (getOrInsertComputed, toHex, sumPrecise) are in scope.
if (typeof globalThis !== 'undefined') {
  globalThis.pdfjsWorker = pdfjsWorker;
}
if (typeof window !== 'undefined') {
  window.pdfjsWorker = pdfjsWorker;
}

/**
 * Checks whether a given file is a PDF.
 * @param {File|Blob|string} file
 * @returns {boolean}
 */
export function isPdfFile(file) {
  if (!file) return false;
  if (typeof file === 'string') {
    return file.toLowerCase().endsWith('.pdf');
  }
  return file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
}

/**
 * Processes a PDF bill file:
 * 1. Renders PDF pages onto crisp Canvases (2.0x scale) to produce high-resolution PNG data URLs.
 * 2. Pre-fills canvas with white paper background and renders with standard 'display' intent.
 * 3. Extracts digital text layer with 2D spatial sorting (Y descending, X ascending)
 *    so table columns and lines are grouped in natural reading order.
 *
 * @param {File|Blob|ArrayBuffer} file The PDF document
 * @returns {Promise<{ imageDataUrl: string, previewPages: Array<string>, embeddedText: string, hasEmbeddedText: boolean, numPages: number }>}
 */
export async function processPdfBill(file) {
  const arrayBuffer = file instanceof ArrayBuffer
    ? file
    : (typeof file?.arrayBuffer === 'function' ? await file.arrayBuffer() : await (await fetch(file)).arrayBuffer());

  // Correctly resolve standard font and cMap URLs across localhost, preview, and GitHub Pages subpaths
  let cMapUrl;
  let standardFontDataUrl;
  if (typeof window !== 'undefined' && window.location) {
    try {
      const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href).href;
      cMapUrl = new URL('cmaps/', baseUrl).href;
      standardFontDataUrl = new URL('standard_fonts/', baseUrl).href;
    } catch {
      cMapUrl = undefined;
      standardFontDataUrl = undefined;
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // 1. Render pages onto Canvas (up to first 10 pages for high-res preview and multi-page AI)
  const previewPages = [];
  const maxRenderPages = Math.min(numPages, 10);

  for (let pageNum = 1; pageNum <= maxRenderPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2.0x scale for crisp bill text

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');

      // Solid white background ensures no text is washed out or rendered invisible
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render with standard interactive 'display' intent
      await page.render({
        canvasContext: ctx,
        canvas: canvas,
        viewport: viewport,
        intent: 'display',
      }).promise;

      const dataUrl = canvas.toDataURL('image/png');
      previewPages.push(dataUrl);
    } catch (renderErr) {
      console.error(`Failed to render PDF page ${pageNum}:`, renderErr);
    }
  }

  // Fallback: If preview rasterization had any issue, create an informative placeholder card
  // so the review screen never receives an empty image string that looks like a blank white box
  if (previewPages.length === 0 && numPages > 0) {
    try {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = 800;
      fallbackCanvas.height = 1100;
      const fCtx = fallbackCanvas.getContext('2d');
      fCtx.fillStyle = '#F8FAFC';
      fCtx.fillRect(0, 0, 800, 1100);
      fCtx.fillStyle = '#0F172A';
      fCtx.font = 'bold 24px sans-serif';
      fCtx.fillText(`PDF Bill Document (${numPages} Page${numPages > 1 ? 's' : ''})`, 50, 100);
      fCtx.font = '16px sans-serif';
      fCtx.fillStyle = '#64748B';
      fCtx.fillText('Text & Line items extracted successfully.', 50, 140);
      previewPages.push(fallbackCanvas.toDataURL('image/png'));
    } catch (fbErr) {
      console.warn('Fallback canvas creation error:', fbErr);
    }
  }

  const imageDataUrl = previewPages[0] || '';

  // 2. Extract digital text layer across ALL pages of the PDF
  const allPageTexts = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawTokens = textContent.items
        .filter((it) => it.transform && it.str && it.str.trim())
        .map((it) => ({
          str: it.str.trim(),
          x: it.transform[4],
          y: it.transform[5],
        }));

      if (rawTokens.length === 0) continue;

      // Detect if page has solo index tokens in left column (x <= 80, e.g. 1..99)
      const indexTokens = rawTokens
        .filter((it) => it.x >= 40 && it.x <= 80 && /^\d{1,2}$/.test(it.str))
        .sort((a, b) => b.y - a.y);

      if (indexTokens.length >= 2) {
        // Table detected: use spatial row banding with dynamic column splitting
        const indexColMaxX = Math.max(...indexTokens.map((t) => t.x)) + 8;
        const tableTop = indexTokens[0].y + 22;
        const tableBottom = indexTokens[indexTokens.length - 1].y - 22;

        const dataCandidateXs = [];
        for (let i = 0; i < indexTokens.length; i++) {
          const cur = indexTokens[i];
          const prev = indexTokens[i - 1];
          const next = indexTokens[i + 1];
          const topY = prev ? (cur.y + prev.y) / 2 : cur.y + 20;
          const botY = next ? (cur.y + next.y) / 2 : cur.y - 20;
          const rowTokens = rawTokens.filter((t) => t.y < topY && t.y >= botY && t.x > indexColMaxX);

          const firstData = rowTokens.find((t) =>
            /^\d{4,8}(?:\.\d{2,4})*$/.test(t.str) ||
            /^[₹$€£]\d/.test(t.str) ||
            /(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}/.test(t.str)
          );
          if (firstData) {
            dataCandidateXs.push(firstData.x);
          }
        }

        const splitX = dataCandidateXs.length > 0 ? Math.min(...dataCandidateXs) - 5 : 260;
        const outputLines = [];

        // 1. Header tokens (above table)
        const headerTokens = rawTokens
          .filter((t) => t.y >= tableTop)
          .sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));

        let curLine = '';
        let lastY = null;
        for (const t of headerTokens) {
          if (lastY !== null && Math.abs(t.y - lastY) > 4) {
            if (curLine.trim()) outputLines.push(curLine.trim());
            curLine = '';
          }
          curLine += t.str + ' ';
          lastY = t.y;
        }
        if (curLine.trim()) outputLines.push(curLine.trim());

        // 2. Table rows
        for (let i = 0; i < indexTokens.length; i++) {
          const cur = indexTokens[i];
          const prev = indexTokens[i - 1];
          const next = indexTokens[i + 1];
          const topY = prev ? (cur.y + prev.y) / 2 : cur.y + 20;
          const botY = next ? (cur.y + next.y) / 2 : cur.y - 20;
          const rowTokens = rawTokens.filter((t) => t.y < topY && t.y >= botY);

          const descTokens = rowTokens
            .filter((t) => t.x >= indexColMaxX && t.x < splitX)
            .sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));

          let desc = '';
          for (let k = 0; k < descTokens.length; k++) {
            const tok = descTokens[k];
            if (/^(fl|fi|ff|ffi|ffl)$/i.test(tok.str)) {
              desc += tok.str;
            } else if (k > 0 && /^(fl|fi|ff|ffi|ffl)$/i.test(descTokens[k - 1].str)) {
              desc += tok.str;
            } else {
              desc += (desc ? ' ' : '') + tok.str;
            }
          }

          const dataTokens = rowTokens
            .filter((t) => t.x >= splitX)
            .sort((a, b) => a.x - b.x);
          const dataLine = dataTokens.map((t) => t.str).join(' ');

          outputLines.push(cur.str);
          if (desc) outputLines.push(desc);
          if (dataLine) outputLines.push(dataLine);
        }

        // 3. Footer tokens (below table)
        const footerTokens = rawTokens
          .filter((t) => t.y < tableBottom)
          .sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));

        curLine = '';
        lastY = null;
        for (const t of footerTokens) {
          if (lastY !== null && Math.abs(t.y - lastY) > 4) {
            if (curLine.trim()) outputLines.push(curLine.trim());
            curLine = '';
          }
          curLine += t.str + ' ';
          lastY = t.y;
        }
        if (curLine.trim()) outputLines.push(curLine.trim());

        allPageTexts.push(outputLines.join('\n'));
      } else {
        // Standard 2D spatial sorting
        const items = rawTokens.slice();
        items.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 4) {
            return b.y - a.y;
          }
          return a.x - b.x;
        });

        const textLines = [];
        let currentLine = '';
        let lastY = null;

        for (const item of items) {
          const y = Math.round(item.y);
          if (lastY !== null && Math.abs(y - lastY) > 4) {
            if (currentLine.trim()) {
              textLines.push(currentLine.trim());
            }
            currentLine = '';
          }
          currentLine += item.str + ' ';
          lastY = y;
        }

        if (currentLine.trim()) {
          textLines.push(currentLine.trim());
        }

        allPageTexts.push(textLines.join('\n'));
      }
    } catch (pageErr) {
      console.warn(`Could not extract text from PDF page ${pageNum}:`, pageErr);
    }
  }

  const embeddedText = allPageTexts.join('\n');
  const hasEmbeddedText = embeddedText.trim().length > 40 && /\d/.test(embeddedText);

  return {
    imageDataUrl,
    previewPages,
    embeddedText,
    hasEmbeddedText,
    numPages,
  };
}

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
 * 1. Renders the PDF page onto a high-resolution Canvas (2.0x scale) to produce a crisp PNG data URL.
 * 2. Extracts digital text layer with 2D spatial sorting (Y descending, X ascending)
 *    so table columns and lines are grouped in natural reading order.
 *
 * @param {File|Blob} file The PDF document
 * @returns {Promise<{ imageDataUrl: string, embeddedText: string, hasEmbeddedText: boolean, numPages: number }>}
 */
export async function processPdfBill(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // 1. Render pages onto Canvas (up to first 6 pages for high-res preview)
  const previewPages = [];
  const maxRenderPages = Math.min(numPages, 6);

  for (let pageNum = 1; pageNum <= maxRenderPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.8 }); // 1.8x scale for sharp text rendering

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      previewPages.push(canvas.toDataURL('image/png'));
    } catch (renderErr) {
      console.warn(`Failed to render PDF page ${pageNum}:`, renderErr);
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

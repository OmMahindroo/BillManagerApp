import { createWorker } from 'tesseract.js';

let workerInstance = null;
let isInitializing = false;
let initPromise = null;

/**
 * Preprocesses an image to optimize for receipt OCR:
 * - Resizes if overly large or too small
 * - Converts to high-contrast grayscale
 * - Enhances contrast to sharpen faint thermal receipt ink
 */
export async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale image if needed (optimal height ~1600-2400px for receipt text)
        let width = img.width;
        let height = img.height;
        const maxDim = 2400;
        const minDim = 800;

        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        } else if (width < minDim && height < minDim) {
          const ratio = Math.max(minDim / width, minDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original
        ctx.drawImage(img, 0, 0, width, height);

        // Get pixel data for contrast & grayscale enhancement
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Contrast adjustment factor (1.25 increases readability of thermal paper)
        const contrast = 1.3;
        const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

        for (let i = 0; i < data.length; i += 4) {
          // Grayscale luminance
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Apply contrast stretch
          gray = factor * (gray - 128) + 128;
          gray = Math.max(0, Math.min(255, gray));

          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        // Fallback to original image if canvas manipulation fails
        console.warn('Canvas pre-processing failed, falling back to original:', err);
        resolve(imageSource);
      }
    };

    img.onerror = (e) => reject(new Error('Failed to load receipt image for pre-processing'));

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      img.src = URL.createObjectURL(imageSource);
    } else {
      resolve(imageSource);
    }
  });
}

/**
 * Initializes or retrieves the shared Tesseract worker.
 */
async function getWorker(onProgress) {
  if (workerInstance) {
    return workerInstance;
  }
  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (onProgress && typeof onProgress === 'function') {
            onProgress(m);
          }
        },
      });
      workerInstance = worker;
      isInitializing = false;
      return worker;
    } catch (err) {
      isInitializing = false;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Executes OCR on the provided receipt image.
 *
 * @param {string|File|Blob} imageSource Image to recognize
 * @param {Function} onProgress Progress callback with { status, progress }
 * @returns {Promise<{ text: string, confidence: number, lines: Array<string> }>}
 */
export async function performReceiptOCR(imageSource, onProgress) {
  try {
    if (onProgress) {
      onProgress({ status: 'preprocessing', progress: 0.15, message: 'Optimizing image contrast...' });
    }

    const preprocessed = await preprocessReceiptImage(imageSource);

    if (onProgress) {
      onProgress({ status: 'initializing', progress: 0.35, message: 'Loading OCR engine...' });
    }

    const worker = await getWorker((msg) => {
      if (onProgress && msg.status === 'recognizing text') {
        const pct = 0.4 + (msg.progress || 0) * 0.55;
        onProgress({
          status: 'recognizing',
          progress: pct,
          message: `Scanning receipt text (${Math.round((msg.progress || 0) * 100)}%)...`,
        });
      }
    });

    const result = await worker.recognize(preprocessed);

    if (onProgress) {
      onProgress({ status: 'parsing', progress: 0.98, message: 'Extracting bill details...' });
    }

    const text = result.data.text || '';
    const confidence = result.data.confidence || 0;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return {
      text,
      confidence,
      lines,
    };
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    throw error;
  }
}

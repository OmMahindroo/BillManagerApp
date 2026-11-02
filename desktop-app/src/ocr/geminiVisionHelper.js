/**
 * Google Gemini Vision Multimodal Line-Items Extractor
 * Uses Gemini 1.5/2.0 Flash to extract structured purchase orders,
 * bills, and itemized invoice tables in one single call.
 */

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Recommended - Fast & High Accuracy)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (High Speed)' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (Stable)' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro Latest (Complex Formats)' },
];

// Helper to convert any image source (data URL, File, Blob) to base64
async function sourceToInlineData(source) {
  let mimeType = 'image/png';
  let base64Data = '';

  if (typeof source === 'string' && source.startsWith('data:')) {
    const parts = source.split(',');
    mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    base64Data = parts[1];
  } else {
    const blob = typeof source === 'string'
      ? await (await fetch(source)).blob()
      : source;
    mimeType = blob.type || 'image/png';
    base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        resolve(res.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return {
    inline_data: {
      mime_type: mimeType,
      data: base64Data,
    },
  };
}

/**
 * Extracts line items and metadata from a bill image or multi-page PDF using Gemini Vision API.
 *
 * @param {string|File|Blob|Array<string>} imageSource Single image or array of page images
 * @param {string} apiKey User's Google Gemini API Key
 * @param {string} model Model ID (default: gemini-3.5-flash)
 * @returns {Promise<Object>} Structured bill data with line items
 */
export async function extractBillWithGemini(imageSource, apiKey, model = 'gemini-3.5-flash') {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API Key is required for AI Vision extraction.');
  }

  // Gracefully migrate deprecated model names
  const activeModel = (!model || model.includes('1.5') || model.includes('2.0') || model.includes('2.5'))
    ? 'gemini-3.5-flash'
    : model;

  // Normalize single image or multi-page array
  const sources = Array.isArray(imageSource) ? imageSource : [imageSource];
  const imageParts = [];

  for (const src of sources) {
    if (!src) continue;
    try {
      const inlinePart = await sourceToInlineData(src);
      imageParts.push(inlinePart);
    } catch (conversionErr) {
      console.warn('Failed to convert page image for Gemini:', conversionErr);
    }
  }

  if (imageParts.length === 0) {
    throw new Error('No valid document pages found to analyze.');
  }

  const prompt = `You are an expert invoice, receipt, purchase order, and delivery challan data extraction system.
Analyze the provided document page(s). Note that documents may contain multiple pages (such as formal tax invoices, delivery challans, or purchase orders spanning multiple pages).

Extract ALL valid itemized bill/invoice line items across all provided pages.
Guidelines:
1. If the document contains formal tax invoices alongside delivery challans, prioritize extracting the itemized line rows from the tax invoices (as they include the official rates, tax percentages, and final amounts).
2. If multiple invoices or line items exist across pages, combine and list EVERY itemized row.
3. Consolidate vendor name, PO/invoice number, date, and grand total.

Required fields to extract:
1. "vendor": Vendor or Company Name (e.g. DEE ECH PRINT N PACK LLP)
2. "poNumber": Purchase Order / Invoice / Bill Number (e.g. PPL/2254/26-27)
3. "date": Date of bill (normalized to YYYY-MM-DD or DD.MM.YYYY)
4. "totalAmount": Grand Total / Final payable amount as a numeric float
5. "totalTax": Total GST / Tax amount as a numeric float
6. "items": A list of all line items present across the bill table(s). For each item:
   - "srNo": Sequential row number (1, 2, 3...)
   - "description": Complete item name / description
   - "quantity": Ordered/billed quantity string with unit if available (e.g. "4120.000" or "4120 PC")
   - "mrp": MRP / Unit Rate as float
   - "sgst": SGST tax amount or percentage as float
   - "cgst": CGST tax amount or percentage as float
   - "gst": Total GST for this item (SGST + CGST or IGST) as float
   - "finalAmount": Item total / net amount as float

Respond ONLY with a valid JSON object matching this schema, without markdown formatting or code fences:
{
  "vendor": "string",
  "poNumber": "string",
  "date": "string",
  "totalAmount": 0.0,
  "totalTax": 0.0,
  "items": [
    {
      "srNo": 1,
      "description": "string",
      "quantity": "string",
      "mrp": 0.0,
      "sgst": 0.0,
      "cgst": 0.0,
      "gst": 0.0,
      "finalAmount": 0.0
    }
  ]
}`;

  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cleanKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error (${response.status}): ${response.statusText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Clean markdown fences if any
  const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    merchant: parsed.vendor || 'Vendor',
    date: parsed.date || new Date().toISOString().split('T')[0],
    invoiceNumber: parsed.poNumber || '',
    totalAmount: Number(parsed.totalAmount) || 0,
    totalTax: Number(parsed.totalTax) || 0,
    items: (parsed.items || []).map((item, idx) => ({
      srNo: Number(item.srNo) || idx + 1,
      description: item.description || `Item #${idx + 1}`,
      quantity: String(item.quantity || '1'),
      mrp: Number(item.mrp) || 0,
      sgst: Number(item.sgst) || 0,
      cgst: Number(item.cgst) || 0,
      gst: Number(item.gst) || ((Number(item.sgst) || 0) + (Number(item.cgst) || 0)),
      finalAmount: Number(item.finalAmount) || 0,
    })),
    rawText: rawText,
    isAiParsed: true,
  };
}

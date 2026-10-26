/**
 * Google Gemini Vision Multimodal Line-Items Extractor
 * Uses Gemini 1.5/2.0 Flash to extract structured purchase orders,
 * bills, and itemized invoice tables in one single call.
 */

export const GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast & Accurate)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen High Accuracy)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Complex Formats)' },
];

/**
 * Extracts line items and metadata from a bill image using Gemini Vision API.
 *
 * @param {string|File|Blob} imageSource Image base64 data URL or File
 * @param {string} apiKey User's Google Gemini API Key
 * @param {string} model Model ID (default: gemini-1.5-flash)
 * @returns {Promise<Object>} Structured bill data with line items
 */
export async function extractBillWithGemini(imageSource, apiKey, model = 'gemini-1.5-flash') {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API Key is required for AI Vision extraction.');
  }

  // Convert imageSource to base64
  let base64Data = '';
  let mimeType = 'image/png';

  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    const parts = imageSource.split(',');
    mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    base64Data = parts[1];
  } else {
    const blob = typeof imageSource === 'string' 
      ? await (await fetch(imageSource)).blob() 
      : imageSource;
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

  const prompt = `You are an expert invoice and purchase order data extraction system.
Analyze this bill / invoice / purchase order image and extract the complete data, especially EVERY itemized row in the table.

Required fields to extract:
1. "vendor": Vendor or Company Name (e.g. M/s Natures Basket Limited or DP SOLUTIONS)
2. "poNumber": Purchase Order / Invoice / Bill Number
3. "date": Date of bill (normalized to YYYY-MM-DD or DD.MM.YYYY)
4. "totalAmount": Total payable / Grand Total / Total Value as a numeric float
5. "totalTax": Total GST / Tax amount as a numeric float
6. "items": A list of all line items present in the bill table. For each item:
   - "srNo": Sequential row number (normalize 10, 20, 30 to 1, 2, 3)
   - "description": Complete item name / description (e.g. "PLUCKK COLD PRESSED CHILLI GUAVA 250ML /P")
   - "quantity": Ordered quantity string with unit if available (e.g. "14.000 PC" or "14")
   - "mrp": MRP / Unit Rate as float (e.g. 109.00)
   - "sgst": SGST tax amount or percentage as float (e.g. 25.43)
   - "cgst": CGST tax amount or percentage as float (e.g. 25.43)
   - "gst": Total GST for this item (SGST + CGST, e.g. 50.86)
   - "finalAmount": Item total / net amount as float (e.g. 1017.38)

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
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
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.statusText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Clean markdown if any
  const cleanJson = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
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

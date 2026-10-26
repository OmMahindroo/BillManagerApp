/**
 * Heuristic and Regex Bill & Receipt Parser.
 * Handles Indian (Lakh/Crore) and International currency formatting,
 * multi-line line-item tables, and purchase orders.
 */

const DATE_PATTERNS = [
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/,
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/,
  // DD-Mon-YYYY (e.g. 26-Oct-2026, 26 Oct 2026, 26-October-2026)
  /\b(\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]\d{2,4})\b/i,
  // Mon DD, YYYY (e.g. Oct 26, 2026 or October 26, 2026)
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i,
];

const TOTAL_KEYWORDS = [
  'invoice total',
  'grand total',
  'total value',
  'total amount',
  'net amount',
  'amount payable',
  'total payable',
  'net payable',
  'balance due',
  'amount due',
  'total due',
  'final total',
  'bill total',
  'total (inr)',
  'total:',
];

const SUBTOTAL_KEYWORDS = [
  'taxable subtotal',
  'subtotal',
  'sub total',
  'sub-total',
  'item total',
  'items total',
  'taxable value',
];

const TAX_KEYWORDS = [
  'cgst',
  'sgst',
  'igst',
  'gst',
  'total tax',
  'sales tax',
  'vat',
  'taxes',
];

// Handles Indian (2,06,449.80) and Western (206,449.80) comma grouping
const FLEX_AMOUNT_REGEX = /(?:[₹$€£]|(?:rs\.?|inr|usd|eur|cad|aud)\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/gi;
const DECIMAL_AMOUNT_REGEX = /(?<![0-9])([0-9]{1,3}(?:,[0-9]{2,3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})(?![0-9])/g;

const CATEGORY_KEYWORDS = {
  Groceries: [
    'supermarket', 'grocery', 'groceries', 'mart', 'produce', 'vegetable', 'fruit', 'milk',
    'bread', 'organic', 'meat', 'bakery', 'market', 'foods', 'pluckk', 'whole foods', 'walmart'
  ],
  Office: [
    'supply', 'solutions', 'stationery', 'paper', 'supplies', 'staples', 'print', 'copier',
    'packaging', 'packaging', 'tape', 'box', 'boxes', 'labels', 'thermal roll'
  ],
  Electronics: [
    'computer', 'tech', 'electronics', 'laptop', 'hardware', 'mouse', 'keyboard', 'cable',
    'hdmi', 'usb', 'phone', 'barcode scanner', 'scanner', 'printer'
  ],
  Dining: [
    'restaurant', 'cafe', 'coffee', 'kitchen', 'bistro', 'bar', 'grill', 'diner', 'pizza',
    'burger', 'fast food', 'dining', 'bakery', 'tea', 'food'
  ],
  Utilities: [
    'electricity', 'electric', 'power', 'water', 'internet', 'broadband', 'wifi', 'telecom'
  ],
  Fuel: [
    'fuel', 'petrol', 'diesel', 'gas station', 'shell', 'bp', 'oil'
  ],
  Healthcare: [
    'pharmacy', 'chemist', 'hospital', 'clinic', 'medical', 'medicine', 'dr.', 'doctor'
  ],
  Shopping: [
    'apparel', 'clothing', 'fashion', 'shoes', 'footwear', 'retail', 'mall'
  ],
  Travel: [
    'hotel', 'flight', 'airline', 'train', 'railway', 'taxi', 'uber', 'cab'
  ],
};

function normalizeDate(rawStr) {
  if (!rawStr) return null;
  const clean = rawStr.replace(/,/g, '').trim();

  // Try direct date parsing
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2050) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Handle YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return clean;
}

function parseCurrencyAmount(rawStr) {
  if (!rawStr) return 0;
  const cleaned = rawStr.replace(/[₹$€£,]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function extractMerchant(lines) {
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    // Skip noisy headers
    if (/(http|www|\.com|@|billed to|shipment|gstin|cin:|pan:|date:|due date:|po ref:)/i.test(line)) {
      continue;
    }
    if (/^[0-9/.:\s-]+$/.test(line)) {
      continue;
    }

    // Strip document header keywords if present in company title line (e.g. "PACIFIC CREST APPAREL EXPORTS LTD. COMMERCIAL INVOICE")
    let clean = line
      .replace(/\b(?:tax\s*invoice|commercial\s*invoice|cash\s*invoice|retail\s*invoice|tax\s*bill|purchase\s*order|cash\s*receipt|tax\s*receipt|invoice|bill)\b/gi, '')
      .replace(/[^a-zA-Z0-9 &.,'’\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (clean.length >= 3 && clean.length <= 60) {
      return clean;
    }
  }
  return lines[0]?.slice(0, 50) || 'Store / Vendor';
}

function extractDate(lines) {
  // Priority 1: line with explicit "date:"
  for (const line of lines) {
    if (/date|dated/i.test(line) && !/timestamp|due date|printed/i.test(line)) {
      for (const pattern of DATE_PATTERNS) {
        const m = line.match(pattern);
        if (m && m[1]) {
          const norm = normalizeDate(m[1]);
          if (norm) return norm;
        }
      }
    }
  }

  // Priority 2: any line with valid date pattern
  for (const line of lines) {
    if (/timestamp/i.test(line)) continue;
    for (const pattern of DATE_PATTERNS) {
      const m = line.match(pattern);
      if (m && m[1]) {
        const norm = normalizeDate(m[1]);
        if (norm) return norm;
      }
    }
  }

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractInvoiceNumber(lines) {
  const fullText = lines.join('\n');
  const patterns = [
    /Invoice\s*(?:#|no|num|number)?\s*[:#]\s*([a-zA-Z0-9/_-]{3,})/i,
    /\bINV[-\s:#]+([a-zA-Z0-9/_-]{4,})/i,
    /PO\s*(?:#|no|num|number|ref|reference)?\s*[:#]\s*([a-zA-Z0-9/_-]{3,})/i,
    /Bill\s*(?:#|no|num|number)?\s*[:#]\s*([a-zA-Z0-9/_-]{3,})/i,
  ];

  for (const p of patterns) {
    const m = fullText.match(p);
    if (m && m[1]) {
      const val = m[1].trim();
      // Avoid false matches like "OICE" from "TAX INVOICE"
      if (!/^(tax|invoice|bill|cash|original|duplicate|page|dated|total|order)$/i.test(val)) {
        return val;
      }
    }
  }
  return '';
}

function extractTotalAmount(lines) {
  // Priority 1: Check lines with explicit keywords (bottom-up so final totals win)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lower = line.toLowerCase();

    for (const kw of TOTAL_KEYWORDS) {
      if (lower.includes(kw)) {
        const searchScope = line + ' ' + (lines[i + 1] || '');
        const matches = searchScope.match(/(?:[₹$€£]|inr|usd|rs\.?)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/gi);
        if (matches && matches.length > 0) {
          // Take last match in the line (e.g. "Invoice Total (INR): ₹2,06,449.80")
          const lastMatch = matches[matches.length - 1];
          const val = parseCurrencyAmount(lastMatch);
          if (val > 0) {
            return { amount: val, fromLabel: true, keyword: kw };
          }
        }
      }
    }
  }

  // Priority 2: Standalone word "total"
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (/\btotal\b/i.test(line) && !lower.includes('subtotal') && !lower.includes('item total')) {
      const searchScope = line + ' ' + (lines[i + 1] || '');
      const matches = searchScope.match(/(?:[₹$€£]|inr|usd|rs\.?)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/gi);
      if (matches && matches.length > 0) {
        const val = parseCurrencyAmount(matches[matches.length - 1]);
        if (val > 0) return { amount: val, fromLabel: true, keyword: 'total' };
      }
    }
  }

  // Priority 3: Fallback to largest decimal amount under 1 crore
  let maxAmount = 0;
  for (const line of lines) {
    if (/gstin|cin|phone|ac|bank|pin|date/i.test(line)) continue;
    const matches = line.match(FLEX_AMOUNT_REGEX) || [];
    for (const m of matches) {
      const val = parseCurrencyAmount(m);
      if (val > maxAmount && val < 10000000) {
        maxAmount = val;
      }
    }
  }

  return { amount: maxAmount, fromLabel: false, keyword: null };
}

function extractTaxAmount(lines, totalAmount) {
  let totalTax = 0.0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (/tax invoice|tax bill/i.test(lower)) continue;

    const isTaxLine = TAX_KEYWORDS.some((kw) => lower.includes(kw));
    if (isTaxLine) {
      const matches = line.match(FLEX_AMOUNT_REGEX) || [];
      for (const m of matches) {
        const amt = parseCurrencyAmount(m);
        if (amt > 0 && amt < totalAmount) {
          if (lower.includes('cgst') || lower.includes('sgst') || lower.includes('igst')) {
            totalTax += amt;
            break;
          } else if (lower.includes('total tax') || lower.includes('gst:')) {
            if (totalTax === 0.0) totalTax = amt;
            break;
          }
        }
      }
    }
  }
  return totalTax;
}

function extractSubtotal(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    for (const kw of SUBTOTAL_KEYWORDS) {
      if (lower.includes(kw)) {
        const matches = (line + ' ' + (lines[i + 1] || '')).match(FLEX_AMOUNT_REGEX) || [];
        for (const m of matches) {
          const amt = parseCurrencyAmount(m);
          if (amt > 0) return amt;
        }
      }
    }
  }
  return 0.0;
}

/**
 * Universal Line Items Extractor:
 * Handles solo row numbers (1..99), combo rows (10 1459571...), multi-line descriptions,
 * HSN codes, packaging units (PK, RL, BD, EA, PC), rates, taxes, and amounts.
 */
export function extractLineItems(lines, rawText, totalAmount = 0, merchant = '') {
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Identify row indicator:
    // Case 1: Solo index on its own line: e.g. "1", "2", ... "9"
    // Case 2: Combo row: e.g. "10 1459571 PLUCKK..." or "1 Thermal Receipt..."
    let srNo = null;
    let isSoloIndex = false;

    if (/^(\d{1,2})$/.test(line)) {
      const num = parseInt(line);
      if (num === items.length + 1 || (items.length === 0 && num === 1)) {
        srNo = num;
        isSoloIndex = true;
      }
    } else {
      const m = line.match(/^(\d{1,4})\s+(?:(\d{4,10})\s+)?([A-Za-z(×].*)/);
      if (m && !/total|subtotal|gst|vat|freight|discount|s\.no|article|description|page|hsn|item/i.test(line)) {
        srNo = parseInt(m[1]);
      }
    }

    if (srNo !== null) {
      let descLines = [];
      let amountsLine = '';
      let j = isSoloIndex ? i + 1 : i;

      if (!isSoloIndex) {
        const m = line.match(/^(\d{1,4})\s+(?:(\d{4,10})\s+)?([A-Za-z(×].*)/);
        if (m && m[3]) descLines.push(m[3]);
        j = i + 1;
      }

      // Collect item lines until numeric amounts row or next item begins
      while (j < lines.length) {
        const next = lines[j];

        // Skip page breaks or repeated column headers spanning across pages
        if (/^(page\s+\d+|--- page|header text|s\.no\s+article|hsn\/sac|description\s+ean)/i.test(next) || /^[-\s=]{5,}$/.test(next)) {
          j++;
          continue;
        }

        if (/^(banking|terms|taxable|cgst|sgst|freight|invoice total|total value|authorized signatory|delivery site|delivery at|vendors\s+will|in\s+view)/i.test(next)) break;
        if (/^total\s+(?:0\.00|[0-9])/i.test(next)) break;
        if (/^(\d{1,2})$/.test(next) && parseInt(next) === srNo + 1) break;
        if (/^(\d{1,4})\s+(?:(\d{4,10})\s+)?[A-Za-z(×]/.test(next) && !/sku:|hsn/i.test(next)) break;

        // Check if line contains tabular monetary data (e.g. "4811 25 PK 1,450.00 18% 36,250.00" or "07099990 279.00 ... 176.00")
        if (/(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}/.test(next) && /\b\d+(?:\.\d+)?\b/.test(next)) {
          amountsLine = next;
          j++;
          break;
        } else {
          descLines.push(next);
        }
        j++;
      }

      // Check if description line already contains explicit quantity + unit (e.g. "1.000 KG" or "14.000 PC")
      let qtyFromDesc = '';
      const qm = descLines.join(' ').match(/\b(\d+(?:\.\d+)?)\s*(KG|G|PC|PCS|PK|RL|BD|EA|BOX|BOTTLE|MTR|BAG|CTNS|CTN)\b/i);
      if (qm) {
        qtyFromDesc = qm[0].trim();
      }

      // Construct clean description
      let desc = descLines
        .filter((l) => !/^\d{4,8}\s+\d+/.test(l) && !/^page\s+\d+/i.test(l))
        .join(' ')
        .replace(/\b10\d{12,14}\b/g, '') // long barcodes
        .replace(/\b89\d{11}\b/g, '')    // 890... barcodes
        .replace(/\b\d{7,14}\b/g, '')    // EAN numbers
        .replace(/\b0\.00\b/g, '')       // tax zeros
        .replace(/\b\d+(?:\.\d+)?\s*(?:PK|RL|BD|EA|PC|PCS|KG|G|NOS|UNITS|BOX|BOTTLE|MTR|BAG|CTNS|CTN)\b/gi, '') // remove standalone quantity+unit
        .replace(/\s+\d{1,3}$/g, '')     // wrapped barcode fragments
        .replace(/\s+/g, ' ')
        .trim();

      // Clean line for quantity & unit parsing
      // Strip HSN/HTS codes like "4811" or "6109.10.00" or "07099990"
      let cleanedAmountsLine = amountsLine.replace(/^\s*\d{4,8}(?:\.\d{2,4})*(?:\.\d{2})?\s+/, '');

      // Extract all monetary decimals
      const decMatches = cleanedAmountsLine.match(/(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}/g) || [];
      const decimals = decMatches.map((s) => parseFloat(s.replace(/,/g, '')));

      // Extract Tax % if present (e.g. "18%" or "12%")
      const taxPctMatch = amountsLine.match(/(\d+(?:\.\d+)?)%/);
      const taxPct = taxPctMatch ? parseFloat(taxPctMatch[1]) : 0;

      let mrp = 0;
      let finalAmount = 0;
      let sgst = 0;
      let cgst = 0;
      let gst = 0;

      if (decimals.length >= 2) {
        mrp = decimals[0]; // Rate or MRP
        finalAmount = decimals[decimals.length - 1]; // Line Total
      } else if (decimals.length === 1) {
        finalAmount = decimals[0];
        mrp = decimals[0];
      }

      // Quantity extraction:
      // Priority 1: explicitly matched unit from amounts line (e.g. "25 PK", "40 RL", "2,400 PCS")
      const qtyUnitMatch =
        cleanedAmountsLine.match(/\b([0-9]{1,3}(?:,[0-9]{3})*|\d+)\s*(PK|RL|BD|EA|PC|PCS|KG|G|NOS|UNITS|BOX|BOTTLE|MTR|BAG|CTNS|CTN)\b/i);

      let quantity = '1';
      if (qtyUnitMatch) {
        quantity = qtyUnitMatch[0].trim();
      } else if (qtyFromDesc) {
        // Priority 2: explicitly matched unit from description line (e.g. "1.000 KG", "14.000 PC")
        quantity = qtyFromDesc;
      } else {
        // Priority 3: integer appearing before the price/rate (e.g. in "40 2,400 $4.85", take "2,400")
        const firstDecStr = decMatches[0];
        const beforeDec = firstDecStr ? cleanedAmountsLine.split(firstDecStr)[0] : cleanedAmountsLine;
        const intMatches = beforeDec.match(/\b([0-9]{1,3}(?:,[0-9]{3})+|\d+)\b/g);
        if (intMatches && intMatches.length > 0) {
          quantity = intMatches[intMatches.length - 1];
        } else {
          const anyInt = cleanedAmountsLine.match(/\b\d+\b/);
          if (anyInt) quantity = anyInt[0];
        }
      }

      if (taxPct > 0 && finalAmount > 0) {
        const rateHalf = taxPct / 2;
        sgst = parseFloat(rateHalf.toFixed(2));
        cgst = parseFloat(rateHalf.toFixed(2));
        gst = parseFloat(taxPct.toFixed(2));
      } else if (decimals.length >= 4) {
        sgst = decimals[1];
        cgst = decimals[2];
        gst = parseFloat((sgst + cgst).toFixed(2));
      }

      if (finalAmount > 0 || mrp > 0) {
        items.push({
          srNo: items.length + 1,
          description: desc || `Item #${items.length + 1}`,
          quantity,
          mrp,
          sgst,
          cgst,
          gst,
          finalAmount: finalAmount || mrp,
        });
      }

      i = j - 1;
    }
  }

  // Fallback to single item if no tabular lines identified
  if (items.length === 0) {
    items.push({
      srNo: 1,
      description: merchant ? `${merchant} - Bill Items` : 'Bill Expense',
      quantity: '1',
      mrp: totalAmount,
      sgst: 0,
      cgst: 0,
      gst: 0,
      finalAmount: totalAmount,
    });
  }

  return items;
}

function detectCategory(rawText) {
  const lower = rawText.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return cat;
      }
    }
  }
  return 'Office';
}

function detectPaymentMethod(rawText) {
  const lower = rawText.toLowerCase();
  if (/bank\s*transfer|neft|rtgs|imps|wire|ifsc/i.test(lower)) {
    return 'Bank Transfer';
  }
  if (/visa|mastercard|credit/i.test(lower)) {
    return 'Credit Card';
  }
  if (/debit/i.test(lower)) {
    return 'Debit Card';
  }
  if (/upi|gpay|qr/i.test(lower)) {
    return 'UPI / QR';
  }
  return 'Bank Transfer';
}

function detectCurrencySymbol(rawText) {
  if (rawText.includes('₹') || /rs\.?|inr/i.test(rawText)) return '₹';
  if (rawText.includes('€') || /eur/i.test(rawText)) return '€';
  if (rawText.includes('£') || /gbp/i.test(rawText)) return '£';
  return '₹';
}

/**
 * Main parser function: takes raw text and returns structured Bill data with itemized lines.
 */
export function parseBillText(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const notes = [];
  const merchant = extractMerchant(lines);
  const date = extractDate(lines);
  const invoiceNumber = extractInvoiceNumber(lines);
  const totalRes = extractTotalAmount(lines);
  const totalAmount = totalRes.amount;
  const tax = extractTaxAmount(lines, totalAmount);
  const subtotal = extractSubtotal(lines);

  const category = detectCategory(rawText);
  const paymentMethod = detectPaymentMethod(rawText);
  const currency = detectCurrencySymbol(rawText);

  // Extract structured line items
  const items = extractLineItems(lines, rawText, totalAmount, merchant);

  if (totalRes.fromLabel) {
    notes.push(`Total detected from "${totalRes.keyword}"`);
  } else if (totalAmount > 0) {
    notes.push('Total estimated from invoice figure');
  }

  if (invoiceNumber) {
    notes.push(`Invoice #${invoiceNumber} found`);
  }

  if (items.length > 1) {
    notes.push(`${items.length} line items extracted`);
  }

  return {
    merchant,
    date,
    invoiceNumber,
    subtotal,
    tax,
    totalAmount,
    category,
    paymentMethod,
    currency,
    items,
    notes: notes.join(' • '),
    rawText,
    timestamp: Date.now(),
  };
}

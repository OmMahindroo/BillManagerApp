import ExcelJS from 'exceljs';

export const EXCEL_HEADERS = [
  'Sr. No',
  'Item Name / Description',
  'Quantity',
  'MRP',
  'GST',
  'SGST',
  'CGST',
  'Final Amount',
  'PO / Invoice #',
  'Bill Date',
  'Store / Vendor',
  'Scanned Timestamp',
];

export const COLUMN_WIDTHS = [
  { header: 'Sr. No', key: 'srNo', width: 10 },
  { header: 'Item Name / Description', key: 'description', width: 38 },
  { header: 'Quantity', key: 'quantity', width: 16 },
  { header: 'MRP', key: 'mrp', width: 14 },
  { header: 'GST', key: 'gst', width: 14 },
  { header: 'SGST', key: 'sgst', width: 14 },
  { header: 'CGST', key: 'cgst', width: 14 },
  { header: 'Final Amount', key: 'finalAmount', width: 16 },
  { header: 'PO / Invoice #', key: 'invoiceNumber', width: 18 },
  { header: 'Bill Date', key: 'date', width: 14 },
  { header: 'Store / Vendor', key: 'merchant', width: 26 },
  { header: 'Scanned Timestamp', key: 'scannedTimestamp', width: 20 },
];

const THEME_HEADER_COLOR = 'FF005C53'; // Dark Teal

function applyHeaderRowStyle(row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME_HEADER_COLOR },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF808080' } },
      left: { style: 'thin', color: { argb: 'FF808080' } },
      bottom: { style: 'medium', color: { argb: 'FF404040' } },
      right: { style: 'thin', color: { argb: 'FF808080' } },
    };
  });
}

function applyDataRowStyle(row) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 10.5,
      color: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Columns: MRP (4), GST (5), SGST (6), CGST (7), Final Amount (8)
    if (colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNumber === 1 || colNumber === 3 || colNumber === 9 || colNumber === 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });
}

function formatTimestamp(timestamp) {
  const d = timestamp ? new Date(timestamp) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Creates a new Excel workbook with itemized columns and adds initial bill line items.
 */
export async function createNewWorkbook(fileName, initialBill = null) {
  const cleanName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BillScanner Desktop';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Itemized Bills', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = COLUMN_WIDTHS;
  applyHeaderRowStyle(worksheet.getRow(1));

  const rows = [];
  let totalSpent = 0;

  if (initialBill) {
    const items = (initialBill.items && initialBill.items.length > 0)
      ? initialBill.items
      : [
          {
            srNo: 1,
            description: initialBill.merchant ? `${initialBill.merchant} - Items` : 'Bill Expense',
            quantity: '1',
            mrp: Number(initialBill.totalAmount) || 0,
            gst: Number(initialBill.tax) || 0,
            sgst: Number(initialBill.tax) / 2 || 0,
            cgst: Number(initialBill.tax) / 2 || 0,
            finalAmount: Number(initialBill.totalAmount) || 0,
          },
        ];

    const formattedTime = formatTimestamp(initialBill.timestamp);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;
      const finalAmt = Number(item.finalAmount) || 0;
      totalSpent += finalAmt;

      const rowValues = [
        rowNum,
        item.description || 'Item Description',
        String(item.quantity || '1'),
        Number(item.mrp) || 0,
        Number(item.gst) || 0,
        Number(item.sgst) || 0,
        Number(item.cgst) || 0,
        finalAmt,
        initialBill.invoiceNumber || '',
        initialBill.date || '',
        initialBill.merchant || 'Vendor',
        formattedTime,
      ];

      const newRow = worksheet.addRow(rowValues);
      applyDataRowStyle(newRow);

      rows.push({
        srNo: rowNum,
        description: item.description,
        quantity: String(item.quantity || '1'),
        mrp: Number(item.mrp) || 0,
        gst: Number(item.gst) || 0,
        sgst: Number(item.sgst) || 0,
        cgst: Number(item.cgst) || 0,
        finalAmount: finalAmt,
        invoiceNumber: initialBill.invoiceNumber || '',
        date: initialBill.date || '',
        merchant: initialBill.merchant || 'Vendor',
        scannedTimestamp: formattedTime,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    workbook,
    buffer,
    fileName: cleanName,
    rows,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
    rowCount: rows.length,
  };
}

/**
 * Appends line items from a bill to an existing workbook buffer.
 */
export async function appendBillToWorkbook(existingBuffer, fileName, bill) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(existingBuffer);

  let worksheet = workbook.getWorksheet('Itemized Bills') || workbook.worksheets[0];
  if (!worksheet) {
    worksheet = workbook.addWorksheet('Itemized Bills');
    worksheet.columns = COLUMN_WIDTHS;
    applyHeaderRowStyle(worksheet.getRow(1));
  }

  const items = (bill.items && bill.items.length > 0)
    ? bill.items
    : [
        {
          srNo: 1,
          description: bill.merchant ? `${bill.merchant} - Items` : 'Bill Expense',
          quantity: '1',
          mrp: Number(bill.totalAmount) || 0,
          gst: Number(bill.tax) || 0,
          sgst: Number(bill.tax) / 2 || 0,
          cgst: Number(bill.tax) / 2 || 0,
          finalAmount: Number(bill.totalAmount) || 0,
        },
      ];

  const formattedTime = formatTimestamp(bill.timestamp);
  let currentLastRow = Math.max(0, worksheet.rowCount - 1);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    currentLastRow += 1;
    const finalAmt = Number(item.finalAmount) || 0;

    const rowValues = [
      currentLastRow,
      item.description || 'Item Description',
      String(item.quantity || '1'),
      Number(item.mrp) || 0,
      Number(item.gst) || 0,
      Number(item.sgst) || 0,
      Number(item.cgst) || 0,
      finalAmt,
      bill.invoiceNumber || '',
      bill.date || '',
      bill.merchant || 'Vendor',
      formattedTime,
    ];

    const addedRow = worksheet.addRow(rowValues);
    applyDataRowStyle(addedRow);
  }

  const updatedBuffer = await workbook.xlsx.writeBuffer();
  const parsed = await parseWorkbookBuffer(updatedBuffer, fileName);

  return {
    workbook,
    buffer: updatedBuffer,
    fileName,
    rows: parsed.rows,
    totalSpent: parsed.totalSpent,
    rowCount: parsed.rowCount,
  };
}

/**
 * Reads any existing Excel workbook uploaded by user and parses rows.
 */
export async function parseWorkbookBuffer(buffer, fileName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet('Itemized Bills') || workbook.worksheets[0];
  if (!worksheet) {
    return {
      workbook,
      buffer,
      fileName,
      rows: [],
      totalSpent: 0,
      rowCount: 0,
    };
  }

  const headerRow = worksheet.getRow(1);
  const colMap = {
    srNo: 1,
    description: 2,
    quantity: 3,
    mrp: 4,
    gst: 5,
    sgst: 6,
    cgst: 7,
    finalAmount: 8,
    invoiceNumber: 9,
    date: 10,
    merchant: 11,
    timestamp: 12,
  };

  headerRow.eachCell((cell, colNum) => {
    const val = String(cell.value || '').toLowerCase();
    if (val.includes('sr') || val.includes('s.no') || val === '#') colMap.srNo = colNum;
    else if (val.includes('description') || val.includes('item')) colMap.description = colNum;
    else if (val.includes('quantity') || val.includes('qty')) colMap.quantity = colNum;
    else if (val.includes('mrp') || val.includes('rate')) colMap.mrp = colNum;
    else if (val.includes('sgst')) colMap.sgst = colNum;
    else if (val.includes('cgst')) colMap.cgst = colNum;
    else if (val.includes('gst') && !val.includes('sgst') && !val.includes('cgst')) colMap.gst = colNum;
    else if (val.includes('final') || val.includes('amount') || val.includes('total')) colMap.finalAmount = colNum;
    else if (val.includes('invoice') || val.includes('po')) colMap.invoiceNumber = colNum;
    else if (val.includes('date')) colMap.date = colNum;
    else if (val.includes('vendor') || val.includes('store') || val.includes('merchant')) colMap.merchant = colNum;
    else if (val.includes('timestamp')) colMap.timestamp = colNum;
  });

  const rows = [];
  let totalSpent = 0;

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row.hasValues) continue;

    const rawFinal = row.getCell(colMap.finalAmount).value;
    const finalAmount = typeof rawFinal === 'object' && rawFinal !== null && 'result' in rawFinal
      ? Number(rawFinal.result) || 0
      : Number(rawFinal) || 0;

    totalSpent += finalAmount;

    rows.push({
      srNo: Number(row.getCell(colMap.srNo).value) || r - 1,
      description: String(row.getCell(colMap.description).value || ''),
      quantity: String(row.getCell(colMap.quantity).value || '1'),
      mrp: Number(row.getCell(colMap.mrp).value) || 0,
      gst: Number(row.getCell(colMap.gst).value) || 0,
      sgst: Number(row.getCell(colMap.sgst).value) || 0,
      cgst: Number(row.getCell(colMap.cgst).value) || 0,
      finalAmount,
      invoiceNumber: String(row.getCell(colMap.invoiceNumber).value || ''),
      date: String(row.getCell(colMap.date).value || ''),
      merchant: String(row.getCell(colMap.merchant).value || 'Vendor'),
      scannedTimestamp: String(row.getCell(colMap.timestamp).value || ''),
    });
  }

  return {
    workbook,
    buffer,
    fileName,
    rows,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
    rowCount: rows.length,
  };
}

export function downloadWorkbookFile(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function convertRowsToCSV(rows) {
  const lines = [EXCEL_HEADERS.join(',')];
  for (const r of rows) {
    const values = [
      r.srNo,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${r.quantity}"`,
      r.mrp,
      r.gst,
      r.sgst,
      r.cgst,
      r.finalAmount,
      `"${r.invoiceNumber}"`,
      `"${r.date}"`,
      `"${(r.merchant || '').replace(/"/g, '""')}"`,
      `"${r.scannedTimestamp}"`,
    ];
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

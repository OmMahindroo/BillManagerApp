import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Search, 
  TrendingUp, 
  Receipt, 
  Check, 
  Hash,
  Boxes,
  FileCheck2
} from 'lucide-react';
import { convertRowsToCSV } from '../excel/excelManager';

export default function SpreadsheetViewer({
  workbookData,
  onDownloadExcel,
  recentlyAddedRowIndex,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCSV, setCopiedCSV] = useState(false);

  const rows = workbookData?.rows || [];

  // Filter rows by query
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = searchQuery.toLowerCase();
      return (
        q === '' ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.merchant && r.merchant.toLowerCase().includes(q)) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(q))
      );
    });
  }, [rows, searchQuery]);

  // Analytics
  const stats = useMemo(() => {
    const totalAmount = rows.reduce((acc, r) => acc + (Number(r.finalAmount) || 0), 0);
    const totalTax = rows.reduce((acc, r) => acc + (Number(r.gst) || 0), 0);
    const uniqueInvoices = new Set(rows.map((r) => r.invoiceNumber).filter(Boolean)).size || 1;

    return {
      totalAmount: totalAmount.toFixed(2),
      itemCount: rows.length,
      totalTax: totalTax.toFixed(2),
      uniqueInvoices,
    };
  }, [rows]);

  const handleCopyCSV = async () => {
    const csv = convertRowsToCSV(rows);
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedCSV(true);
      setTimeout(() => setCopiedCSV(false), 2500);
    } catch (err) {
      console.error('Failed to copy CSV:', err);
    }
  };

  if (!workbookData || rows.length === 0) {
    return null;
  }

  return (
    <div className="spreadsheet-viewer glass-panel">
      {/* KPI Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap teal">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="stat-label">Total Amount Sum</div>
            <div className="stat-value">₹{stats.totalAmount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap blue">
            <Boxes size={20} />
          </div>
          <div>
            <div className="stat-label">Itemized Rows</div>
            <div className="stat-value">{stats.itemCount} items</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap purple">
            <Receipt size={20} />
          </div>
          <div>
            <div className="stat-label">Total GST / Taxes</div>
            <div className="stat-value">₹{stats.totalTax}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap amber">
            <Hash size={20} />
          </div>
          <div>
            <div className="stat-label">Invoices / POs</div>
            <div className="stat-value">{stats.uniqueInvoices} POs</div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Header & Controls */}
      <div className="viewer-toolbar">
        <div className="viewer-title-group">
          <FileSpreadsheet className="text-teal" size={20} />
          <h3 className="viewer-title">{workbookData.fileName}</h3>
          <span className="viewer-badge">{rows.length} line items</span>
        </div>

        <div className="viewer-actions">
          <div className="search-box">
            <Search size={15} className="text-muted" />
            <input
              type="text"
              placeholder="Search description, PO, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button 
            className="btn-secondary btn-sm"
            onClick={handleCopyCSV}
            title="Copy as CSV table to paste in Google Sheets or Excel"
          >
            {copiedCSV ? <Check size={14} className="text-teal" /> : <Copy size={14} />}
            <span>{copiedCSV ? 'Copied CSV!' : 'Copy CSV'}</span>
          </button>

          <button 
            className="btn-primary btn-sm"
            onClick={onDownloadExcel}
            title="Download formatted .xlsx file to your PC"
          >
            <Download size={14} />
            <span>Download .xlsx</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-responsive-container">
        <table className="excel-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>Sr.No</th>
              <th>Item Name / Description</th>
              <th className="text-center" style={{ width: '110px' }}>Quantity</th>
              <th className="text-right">MRP</th>
              <th className="text-right">GST</th>
              <th className="text-right">SGST</th>
              <th className="text-right">CGST</th>
              <th className="text-right">Final Amount</th>
              <th className="text-center">PO / Invoice #</th>
              <th className="text-center">Bill Date</th>
              <th>Store / Vendor</th>
              <th>Scanned Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, idx) => {
              const isNewlyAdded = r.srNo === recentlyAddedRowIndex;

              return (
                <tr 
                  key={`${r.srNo}-${idx}`}
                  className={isNewlyAdded ? 'row-newly-added' : ''}
                >
                  <td className="text-center font-mono text-muted">{r.srNo || idx + 1}</td>
                  <td className="font-semibold text-primary">{r.description}</td>
                  <td className="text-center font-mono text-muted">{r.quantity}</td>
                  <td className="text-right font-mono text-muted">
                    {r.mrp > 0 ? `₹${Number(r.mrp).toFixed(2)}` : '—'}
                  </td>
                  <td className="text-right font-mono text-muted">
                    {r.gst > 0 ? `₹${Number(r.gst).toFixed(2)}` : '—'}
                  </td>
                  <td className="text-right font-mono text-muted">
                    {r.sgst > 0 ? `₹${Number(r.sgst).toFixed(2)}` : '—'}
                  </td>
                  <td className="text-right font-mono text-muted">
                    {r.cgst > 0 ? `₹${Number(r.cgst).toFixed(2)}` : '—'}
                  </td>
                  <td className="text-right font-mono font-bold amount-highlight">
                    ₹{Number(r.finalAmount || 0).toFixed(2)}
                  </td>
                  <td className="text-center font-mono text-muted">{r.invoiceNumber || '—'}</td>
                  <td className="text-center font-mono">{r.date || '—'}</td>
                  <td className="text-secondary">{r.merchant || '—'}</td>
                  <td className="text-muted text-xs font-mono">{r.scannedTimestamp || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

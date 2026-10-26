import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Check, 
  Calendar, 
  Store, 
  Hash, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Sparkles,
  Maximize2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function ReviewModal({
  isOpen,
  onClose,
  billData,
  imageSrc,
  onProceedToSave,
  onRunGeminiVision,
  hasGeminiKey,
}) {
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [items, setItems] = useState([]);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showRawText, setShowRawText] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);

  useEffect(() => {
    if (billData) {
      setVendor(billData.merchant || 'Store / Vendor');
      setDate(billData.date || new Date().toISOString().split('T')[0]);
      setInvoiceNumber(billData.invoiceNumber || '');
      setTotalAmount(Number(billData.totalAmount) || 0);
      setActivePageIndex(0);

      const initialItems = (billData.items && billData.items.length > 0)
        ? billData.items
        : [
            {
              srNo: 1,
              description: billData.merchant ? `${billData.merchant} - Items` : 'Bill Item',
              quantity: '1',
              mrp: Number(billData.totalAmount) || 0,
              gst: Number(billData.tax) || 0,
              sgst: Number(billData.tax) / 2 || 0,
              cgst: Number(billData.tax) / 2 || 0,
              finalAmount: Number(billData.totalAmount) || 0,
            },
          ];

      setItems(initialItems);
      setZoomLevel(1);
      setRotation(0);
      setShowRawText(false);
    }
  }, [billData]);

  if (!isOpen || !billData) return null;

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      // Auto update GST when SGST or CGST changes
      if (field === 'sgst' || field === 'cgst') {
        const s = field === 'sgst' ? parseFloat(value) || 0 : parseFloat(target.sgst) || 0;
        const c = field === 'cgst' ? parseFloat(value) || 0 : parseFloat(target.cgst) || 0;
        target.gst = parseFloat((s + c).toFixed(2));
      }

      copy[index] = target;
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        srNo: prev.length + 1,
        description: '',
        quantity: '1',
        mrp: 0,
        gst: 0,
        sgst: 0,
        cgst: 0,
        finalAmount: 0,
      },
    ]);
  };

  const handleDeleteItem = (index) => {
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((it, idx) => ({ ...it, srNo: idx + 1 }));
    });
  };

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.finalAmount) || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalRecord = {
      ...billData,
      merchant: vendor.trim() || 'Store / Vendor',
      date: date || new Date().toISOString().split('T')[0],
      invoiceNumber: invoiceNumber.trim(),
      totalAmount: totalAmount > 0 ? totalAmount : itemsTotal,
      items: items.map((it, idx) => ({
        srNo: idx + 1,
        description: it.description.trim() || `Item #${idx + 1}`,
        quantity: String(it.quantity || '1').trim(),
        mrp: parseFloat(it.mrp) || 0,
        gst: parseFloat(it.gst) || 0,
        sgst: parseFloat(it.sgst) || 0,
        cgst: parseFloat(it.cgst) || 0,
        finalAmount: parseFloat(it.finalAmount) || 0,
      })),
    };
    onProceedToSave(finalRecord);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card review-modal review-modal-wide glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="badge-icon-teal">
              <Check size={20} />
            </div>
            <div>
              <h3 className="modal-title">Review Extracted Line Items & Bill</h3>
              <p className="modal-subtitle">
                {items.length} item{items.length !== 1 ? 's' : ''} extracted from bill • Verify and edit columns before saving to Excel
              </p>
            </div>
          </div>

          <div className="header-actions">
            {onRunGeminiVision && hasGeminiKey && (
              <button 
                type="button" 
                className="btn-ai-extract"
                onClick={onRunGeminiVision}
                title="Re-extract with Google Gemini AI Vision Model"
              >
                <Sparkles size={14} />
                <span>Re-Extract with AI Model</span>
              </button>
            )}
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="review-grid-itemized">
          {/* Left: Scanned Document Preview */}
          <div className="review-preview-pane">
            {(() => {
              const previewPages = billData.previewPages || [];
              const totalPages = previewPages.length || (billData.numPages || 1);
              const currentImage = (previewPages.length > 0 && previewPages[activePageIndex]) 
                ? previewPages[activePageIndex] 
                : imageSrc;

              return (
                <>
                  <div className="preview-toolbar">
                    <div className="preview-controls">
                      <button 
                        className="btn-icon-sm" 
                        title="Zoom In" 
                        onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      >
                        <ZoomIn size={15} />
                      </button>
                      <button 
                        className="btn-icon-sm" 
                        title="Zoom Out" 
                        onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      >
                        <ZoomOut size={15} />
                      </button>
                      <button 
                        className="btn-icon-sm" 
                        title="Reset Zoom" 
                        onClick={() => { setZoomLevel(1); setRotation(0); }}
                      >
                        <Maximize2 size={15} />
                      </button>
                      <button 
                        className="btn-icon-sm" 
                        title="Rotate 90°" 
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                      >
                        <RotateCw size={15} />
                      </button>

                      {totalPages > 1 && (
                        <div className="preview-pagination">
                          <button
                            type="button"
                            className="btn-page-nav"
                            title="Previous Page"
                            disabled={activePageIndex === 0}
                            onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="page-indicator">
                            Page {activePageIndex + 1} of {totalPages}
                          </span>
                          <button
                            type="button"
                            className="btn-page-nav"
                            title="Next Page"
                            disabled={activePageIndex >= totalPages - 1}
                            onClick={() => setActivePageIndex((p) => Math.min(totalPages - 1, p + 1))}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button 
                      className={`btn-toggle-raw ${showRawText ? 'active' : ''}`}
                      onClick={() => setShowRawText(!showRawText)}
                    >
                      <FileText size={14} />
                      <span>{showRawText ? 'Show Scan' : 'OCR Raw Text'}</span>
                    </button>
                  </div>

                  <div className="preview-viewport">
                    {showRawText ? (
                      <div className="raw-text-viewer">
                        <div className="raw-text-header">Raw Recognized OCR Text</div>
                        <pre>{billData.rawText || 'No text recognized.'}</pre>
                      </div>
                    ) : (
                      <div className="image-zoom-container">
                        <img
                          src={currentImage}
                          alt={`Intercepted Bill Page ${activePageIndex + 1}`}
                          className="review-image"
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {billData.notes && (
              <div className="detection-notes-pill">
                <AlertCircle size={14} className="text-teal" />
                <span>{billData.notes}</span>
              </div>
            )}
          </div>

          {/* Right: Bill Metadata & Itemized Table Editor */}
          <form className="itemized-editor-pane" onSubmit={handleSubmit}>
            {/* Metadata Bar */}
            <div className="metadata-bar">
              <div className="form-group flex-2">
                <label>
                  <Store size={13} className="text-teal" />
                  <span>Vendor / Company</span>
                </label>
                <input
                  type="text"
                  required
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. M/s Natures Basket Limited"
                />
              </div>

              <div className="form-group flex-1">
                <label>
                  <Hash size={13} className="text-teal" />
                  <span>PO / Invoice #</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. 8700957961"
                />
              </div>

              <div className="form-group flex-1">
                <label>
                  <Calendar size={13} className="text-teal" />
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label className="text-teal font-bold">
                  <span>Grand Total</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="font-mono font-bold"
                  value={totalAmount || itemsTotal.toFixed(2)}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Line Items Table Header & Add Button */}
            <div className="items-section-header">
              <div className="items-count-badge">
                <span className="font-bold">{items.length} Line Items</span>
                <span className="text-muted">• Items Total: ₹{itemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <button 
                type="button" 
                className="btn-secondary btn-sm"
                onClick={handleAddItem}
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            {/* Editable Items Table */}
            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>Sr.No</th>
                    <th>Item Name / Description</th>
                    <th style={{ width: '100px' }}>Quantity</th>
                    <th style={{ width: '90px' }}>MRP</th>
                    <th style={{ width: '80px' }}>SGST</th>
                    <th style={{ width: '80px' }}>CGST</th>
                    <th style={{ width: '80px' }}>GST</th>
                    <th style={{ width: '110px' }}>Final Amount</th>
                    <th style={{ width: '38px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="text-center font-mono text-muted">
                        {it.srNo || idx + 1}
                      </td>
                      <td>
                        <input
                          type="text"
                          required
                          className="table-input desc-input"
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Item Description"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input text-center font-mono"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="e.g. 14.000 PC"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="table-input text-right font-mono"
                          value={it.mrp}
                          onChange={(e) => handleItemChange(idx, 'mrp', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="table-input text-right font-mono text-muted"
                          value={it.sgst}
                          onChange={(e) => handleItemChange(idx, 'sgst', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="table-input text-right font-mono text-muted"
                          value={it.cgst}
                          onChange={(e) => handleItemChange(idx, 'cgst', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="table-input text-right font-mono text-muted"
                          value={it.gst}
                          onChange={(e) => handleItemChange(idx, 'gst', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="table-input text-right font-mono font-bold amount-input"
                          value={it.finalAmount}
                          onChange={(e) => handleItemChange(idx, 'finalAmount', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-delete-row"
                          onClick={() => handleDeleteItem(idx)}
                          title="Delete line item"
                          disabled={items.length <= 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Action Buttons */}
            <div className="modal-footer-sticky">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Discard
              </button>
              <button type="submit" className="btn-primary">
                <FileSpreadsheet size={18} />
                <span>Save {items.length} Items to Excel...</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Printer, 
  Clipboard, 
  Sparkles, 
  FileText, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Radio,
  FolderOpen
} from 'lucide-react';

export default function DropZone({
  onImageSelected,
  isProcessing,
  ocrProgress,
  scannerStatus,
  onOpenScannerSettings,
  onConnectScannerFolder,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Global Ctrl+V paste interceptor for laptop/desktop
  useEffect(() => {
    const handlePaste = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            onImageSelected(file, 'Clipboard Paste');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImageSelected]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.name.endsWith('.pdf')) {
        onImageSelected(file, file.name);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onImageSelected(file, file.name);
      e.target.value = '';
    }
  };

  const handleLoadSample = async (samplePath, sampleName) => {
    try {
      const response = await fetch(samplePath);
      const blob = await response.blob();
      const file = new File([blob], `${sampleName}.jpg`, { type: 'image/jpeg' });
      onImageSelected(file, sampleName);
    } catch (err) {
      console.error('Failed to load sample image:', err);
    }
  };

  return (
    <div className="dropzone-container">
      {/* Live External Scanner Radar Banner */}
      {scannerStatus.connected && (
        <div className="scanner-live-banner glass-panel">
          <div className="scanner-live-left">
            <span className="radar-pulse"></span>
            <Printer size={18} className="text-teal" />
            <div>
              <span className="scanner-live-title">External Scanner Active & Listening</span>
              <span className="scanner-live-desc">Watching folder: <code>{scannerStatus.folderName}</code>. Any new scan will be intercepted immediately.</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-secondary btn-sm"
            onClick={onOpenScannerSettings}
          >
            Configure Scanner
          </button>
        </div>
      )}

      <div 
        className={`dropzone-card glass-panel ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf, .pdf"
          style={{ display: 'none' }}
        />

        {isProcessing ? (
          <div className="processing-overlay">
            <div className="scan-laser"></div>
            <div className="processing-content">
              <div className="spinner-ring"></div>
              <h3 className="processing-title">Intercepting & Scanning Bill</h3>
              <p className="processing-message">{ocrProgress?.message || 'Processing receipt...'}</p>
              
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${Math.round((ocrProgress?.progress || 0.1) * 100)}%` }}
                ></div>
              </div>
              <span className="progress-percentage">
                {Math.round((ocrProgress?.progress || 0.1) * 100)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="dropzone-inner">
            <div className="upload-icon-circle">
              <Printer size={42} className="upload-icon text-teal" />
            </div>

            <h2 className="dropzone-heading">
              Drop or Intercept Scanned Bill Here
            </h2>

            <p className="dropzone-subheading">
              Supports <strong>PDF Invoices</strong>, Scanned Images (JPG, PNG), or paste screenshot with <kbd>Ctrl</kbd>+<kbd>V</kbd>
            </p>

            <div className="quick-actions-bar" onClick={(e) => e.stopPropagation()}>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={18} />
                <span>Import PDF or Image</span>
              </button>

              {scannerStatus.connected ? (
                <button 
                  type="button" 
                  className="btn-secondary active-scanner-btn"
                  onClick={onOpenScannerSettings}
                  title="Configure connected external scanner"
                >
                  <Printer size={18} className="text-teal" />
                  <span>Scanner: {scannerStatus.folderName}</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={onConnectScannerFolder}
                  title="Connect the folder where your external scanner saves files"
                >
                  <FolderOpen size={18} className="text-teal" />
                  <span>Connect External Scanner Folder</span>
                </button>
              )}
            </div>

            <div className="shortcut-banner">
              <Clipboard size={14} className="text-teal" />
              <span>
                <strong>Instant Paste:</strong> Press <kbd>Ctrl</kbd> + <kbd>V</kbd> anywhere on screen to paste a Snipping Tool screenshot or copied bill!
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Demo Receipts, POs & PDF */}
      <div className="sample-bills-bar">
        <span className="sample-label">
          <Sparkles size={14} className="text-teal" />
          <span>Test Samples:</span>
        </span>

        <button 
          className="sample-pill po-pill"
          onClick={async () => {
            try {
              const res = await fetch('/sample_natures_basket_5page.pdf');
              const blob = await res.blob();
              const file = new File([blob], 'Natures_Basket_PO_5Page_40Items.pdf', { type: 'application/pdf' });
              onImageSelected(file, 'M/s Natures Basket 5-Page Purchase Order (40 Items PDF)');
            } catch (err) {
              console.error('Failed to load 5-page sample PDF:', err);
            }
          }}
          disabled={isProcessing}
          title="Test processing the full 5-page Nature's Basket Purchase Order with 40 line items"
        >
          📑 Natures Basket 5-Page PO (40 Items PDF)
        </button>

        <button 
          className="sample-pill po-pill"
          onClick={async () => {
            try {
              const res = await fetch('/sample_pacific_invoice.pdf');
              const blob = await res.blob();
              const file = new File([blob], 'Pacific_Crest_Export_Invoice.pdf', { type: 'application/pdf' });
              onImageSelected(file, 'Pacific Crest Commercial Invoice (7 Items PDF)');
            } catch (err) {
              console.error('Failed to load Pacific sample PDF:', err);
            }
          }}
          disabled={isProcessing}
          title="Test processing the 7 line-items Pacific Crest Commercial Invoice PDF"
        >
          📦 Pacific Crest Invoice (7 Items PDF)
        </button>

        <button 
          className="sample-pill po-pill"
          onClick={async () => {
            try {
              const res = await fetch('/sample_apex_invoice.pdf');
              const blob = await res.blob();
              const file = new File([blob], 'Apex_Supply_Solutions_Invoice.pdf', { type: 'application/pdf' });
              onImageSelected(file, 'Apex Supply Solutions Tax Invoice (9 Items PDF)');
            } catch (err) {
              console.error('Failed to load Apex sample PDF:', err);
            }
          }}
          disabled={isProcessing}
          title="Test processing the 9 line-items Apex Supply Solutions Tax Invoice PDF"
        >
          📑 Apex Tax Invoice (9 Items PDF)
        </button>

        <button 
          className="sample-pill po-pill"
          onClick={() => handleLoadSample('/sample_purchase_order.png', 'M/s Natures Basket PO (3 Items)')}
          disabled={isProcessing}
          title="Test with the 3 line-items purchase order"
        >
          📋 Natures Basket PO (3 Items)
        </button>

        <button 
          className="sample-pill"
          onClick={() => handleLoadSample('/sample_grocery.jpg', 'Supermarket Scanner File')}
          disabled={isProcessing}
        >
          🛒 Grocery Bill
        </button>

        <button 
          className="sample-pill"
          onClick={() => handleLoadSample('/sample_tech.jpg', 'Computer Store Invoice Scan')}
          disabled={isProcessing}
        >
          💻 Computer Store Scan
        </button>

        <button 
          className="sample-pill pdf-pill"
          onClick={async () => {
            try {
              const res = await fetch('/sample_invoice.pdf');
              const blob = await res.blob();
              const file = new File([blob], 'Office_Supplies_Invoice.pdf', { type: 'application/pdf' });
              onImageSelected(file, 'Office Supplies PDF Invoice');
            } catch (err) {
              console.error('Failed to load sample PDF:', err);
            }
          }}
          disabled={isProcessing}
          title="Test processing a PDF bill document"
        >
          📄 Sample PDF Invoice
        </button>
      </div>
    </div>
  );
}

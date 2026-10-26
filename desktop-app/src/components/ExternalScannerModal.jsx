import React from 'react';
import { 
  Printer, 
  FolderCheck, 
  FolderOpen, 
  CheckCircle2, 
  X, 
  Radio, 
  Zap, 
  Info, 
  HelpCircle,
  FileCheck,
  RefreshCw
} from 'lucide-react';

export default function ExternalScannerModal({
  isOpen,
  onClose,
  scannerStatus,
  onConnectFolder,
  onDisconnectFolder,
  autoAppendMode,
  setAutoAppendMode,
  onSimulateExternalScan,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card external-scanner-modal glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="badge-icon-teal">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="modal-title">External Scanner Configuration</h3>
              <p className="modal-subtitle">Configure real-time interception for USB / Wi-Fi Document Scanners</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="scanner-modal-body">
          {/* Status Banner */}
          <div className={`scanner-connection-card ${scannerStatus.connected ? 'connected' : 'disconnected'}`}>
            <div className="scanner-card-left">
              <div className="scanner-icon-bubble">
                <Printer size={28} />
              </div>
              <div>
                <div className="scanner-status-heading">
                  {scannerStatus.connected ? (
                    <>
                      <span className="live-dot"></span>
                      <span>External Scanner Folder: <strong>CONNECTED</strong></span>
                    </>
                  ) : (
                    <>
                      <span className="offline-dot"></span>
                      <span>External Scanner Folder: <strong>NOT CONNECTED</strong></span>
                    </>
                  )}
                </div>
                <p className="scanner-status-sub">
                  {scannerStatus.connected 
                    ? `Watching directory: "${scannerStatus.folderName}" for new incoming scans.` 
                    : 'Connect the directory where your external scanner software (HP, Epson, Canon, Windows Fax & Scan) saves files.'}
                </p>
              </div>
            </div>

            <div className="scanner-card-action">
              {scannerStatus.connected ? (
                <button className="btn-secondary btn-sm" onClick={onDisconnectFolder}>
                  Disconnect
                </button>
              ) : (
                <button className="btn-primary" onClick={onConnectFolder}>
                  <FolderOpen size={16} />
                  <span>Select Scanner Folder</span>
                </button>
              )}
            </div>
          </div>

          {/* Workflow Explanation Cards */}
          <div className="workflow-steps-grid">
            <div className="workflow-step-card">
              <div className="step-num">1</div>
              <div className="step-content">
                <h5>Physical Scanner</h5>
                <p>Place paper receipt into your flatbed or feeder scanner and press <strong>SCAN</strong>.</p>
              </div>
            </div>

            <div className="workflow-step-card">
              <div className="step-num">2</div>
              <div className="step-content">
                <h5>Auto-Interception</h5>
                <p>Scanner software saves image to your PC; BillScanner intercepts the file instantly.</p>
              </div>
            </div>

            <div className="workflow-step-card">
              <div className="step-num">3</div>
              <div className="step-content">
                <h5>Excel Export</h5>
                <p>OCR automatically extracts data and appends directly into your Excel spreadsheet.</p>
              </div>
            </div>
          </div>

          {/* Automation Options */}
          <div className="scanner-options-box">
            <div className="option-row">
              <div className="option-info">
                <div className="option-title-wrap">
                  <Zap size={16} className="text-teal" />
                  <span className="option-title">Instant Auto-Append Mode</span>
                </div>
                <p className="option-desc">
                  When enabled, intercepted scans from your external scanner will be appended to your active Excel file immediately without stopping for confirmation.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoAppendMode}
                  onChange={(e) => setAutoAppendMode(e.target.value === 'true' || e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Hardware Compatibility List */}
          <div className="hardware-compatibility-banner">
            <Info size={16} className="text-teal flex-shrink-0" />
            <span>
              <strong>Supported Hardware:</strong> All USB and Wi-Fi Scanners (HP, Epson, Canon, Brother, Fujitsu ScanSnap, Xerox, Ricoh, Windows Fax & Scan).
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => {
              onSimulateExternalScan();
              onClose();
            }}
            title="Simulate a new scan arriving from your external scanner"
          >
            <RefreshCw size={14} />
            <span>Simulate Incoming Scanner File</span>
          </button>

          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Receipt, 
  Sun, 
  Moon, 
  PlusCircle, 
  FolderOpen, 
  Download,
  Printer,
  Radio,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';

export default function Navbar({
  theme,
  toggleTheme,
  activeWorkbook,
  onOpenExistingFile,
  onCreateNewSheet,
  onDownloadCurrent,
  scannerStatus,
  onOpenScannerSettings,
  hasGeminiKey,
  onOpenAiModal,
}) {
  return (
    <header className="navbar glass-panel">
      <div className="navbar-left">
        <div className="brand-badge">
          <div className="brand-icon-wrapper">
            <Receipt className="brand-icon" size={22} />
          </div>
          <div>
            <div className="brand-title">
              <span>BillScanner</span>
              <span className="brand-accent">Desktop</span>
            </div>
            <div className="brand-subtitle">
              <Printer size={12} className="text-teal" />
              <span>External Scanner & Excel Interceptor</span>
            </div>
          </div>
        </div>
      </div>

      <div className="navbar-center">
        {/* Active Workbook Indicator */}
        {activeWorkbook ? (
          <div className="active-file-pill">
            <span className="status-dot online"></span>
            <FileSpreadsheet size={16} className="text-teal" />
            <span className="file-name" title={activeWorkbook.fileName}>
              {activeWorkbook.fileName}
            </span>
            <span className="badge-count">{activeWorkbook.rowCount} bills</span>
            <span className="badge-amount">
              ${Number(activeWorkbook.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {onDownloadCurrent && (
              <button 
                className="btn-icon-subtle" 
                title="Download updated Excel file"
                onClick={onDownloadCurrent}
              >
                <Download size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="active-file-pill empty">
            <span className="status-dot standby"></span>
            <span className="text-secondary">No active Excel file • Scans will prompt destination</span>
          </div>
        )}

        {/* Scanner Hardware Connection Status Pill */}
        <button 
          className={`scanner-status-pill ${scannerStatus.connected ? 'connected' : 'disconnected'}`}
          onClick={onOpenScannerSettings}
          title="Click to configure External Scanner Watcher"
        >
          {scannerStatus.connected ? (
            <>
              <span className="radar-pulse"></span>
              <Printer size={14} className="text-teal" />
              <span className="scanner-text">Scanner Folder: <strong>{scannerStatus.folderName || 'Active'}</strong></span>
            </>
          ) : (
            <>
              <Radio size={14} className="text-amber" />
              <span className="scanner-text">External Scanner: <strong>Not Connected</strong></span>
            </>
          )}
        </button>
      </div>

      <div className="navbar-right">
        {/* AI Model Settings Button */}
        <button 
          className={`btn-secondary btn-sm ${hasGeminiKey ? 'ai-active' : ''}`}
          onClick={onOpenAiModal}
          title={hasGeminiKey ? 'AI Vision Model Active' : 'Configure Google Gemini Vision Model'}
        >
          <Sparkles size={14} className={hasGeminiKey ? 'text-teal' : ''} />
          <span>{hasGeminiKey ? 'AI Model' : 'Enable AI'}</span>
        </button>

        <label className="btn-secondary btn-sm" title="Open an existing .xlsx file from your PC">
          <FolderOpen size={15} />
          <span>Open Excel</span>
          <input
            type="file"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            onChange={onOpenExistingFile}
          />
        </label>

        <button 
          className="btn-secondary btn-sm" 
          onClick={onCreateNewSheet}
          title="Start a fresh Excel workbook"
        >
          <PlusCircle size={15} />
          <span>New Sheet</span>
        </button>

        <button 
          className="btn-icon" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

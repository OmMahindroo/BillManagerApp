import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  FolderOpen, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  FileCheck,
  X
} from 'lucide-react';

export default function DestinationDialog({
  isOpen,
  onClose,
  billRecord,
  activeWorkbook,
  onAppendToCurrent,
  onCreateNew,
  onPickExistingFileAndAppend,
}) {
  const [selectedMode, setSelectedMode] = useState(activeWorkbook ? 'current' : 'new');
  const [newFileName, setNewFileName] = useState(() => {
    const d = new Date();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `Expenses_${month}_${year}.xlsx`;
  });
  const [isAppendingExisting, setIsAppendingExisting] = useState(false);

  if (!isOpen || !billRecord) return null;

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const clean = newFileName.trim() || 'Bills_Spreadsheet.xlsx';
    onCreateNew(clean, billRecord);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onPickExistingFileAndAppend(file, billRecord);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card destination-modal glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="badge-icon-teal">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="modal-title">Select Excel Destination</h3>
              <p className="modal-subtitle">Choose where to save this bill ({billRecord.merchant} • ${billRecord.totalAmount})</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="destination-options">
          {/* Option 1: Continue adding into current active file */}
          {activeWorkbook && (
            <div 
              className={`dest-option-card ${selectedMode === 'current' ? 'selected' : ''}`}
              onClick={() => setSelectedMode('current')}
            >
              <div className="dest-radio">
                <div className={`radio-dot ${selectedMode === 'current' ? 'checked' : ''}`}></div>
              </div>
              <div className="dest-info">
                <div className="dest-title-row">
                  <span className="dest-badge active">Active Spreadsheet</span>
                  <h4 className="dest-title">Continue adding to current file</h4>
                </div>
                <p className="dest-desc">
                  Appends as <strong>Row #{activeWorkbook.rowCount + 1}</strong> inside <code>{activeWorkbook.fileName}</code>.
                </p>
                <div className="dest-meta">
                  <span>Current: {activeWorkbook.rowCount} bills</span>
                  <span>•</span>
                  <span>Total: ${activeWorkbook.totalSpent?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Option 2: Make a new Excel file */}
          <div 
            className={`dest-option-card ${selectedMode === 'new' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('new')}
          >
            <div className="dest-radio">
              <div className={`radio-dot ${selectedMode === 'new' ? 'checked' : ''}`}></div>
            </div>
            <div className="dest-info">
              <div className="dest-title-row">
                <span className="dest-badge new">New Workbook</span>
                <h4 className="dest-title">Create a new Excel file (.xlsx)</h4>
              </div>
              <p className="dest-desc">
                Initializes a fresh styled spreadsheet with custom formatted headers and auto column widths.
              </p>

              {selectedMode === 'new' && (
                <div className="new-file-input-group" onClick={(e) => e.stopPropagation()}>
                  <label>Workbook File Name:</label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="e.g. Office_Expenses_Oct_2026.xlsx"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Option 3: Choose an existing Excel file from laptop */}
          <div 
            className={`dest-option-card ${selectedMode === 'existing' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('existing')}
          >
            <div className="dest-radio">
              <div className={`radio-dot ${selectedMode === 'existing' ? 'checked' : ''}`}></div>
            </div>
            <div className="dest-info">
              <div className="dest-title-row">
                <span className="dest-badge browse">From Laptop</span>
                <h4 className="dest-title">Append into an existing Excel file</h4>
              </div>
              <p className="dest-desc">
                Select any <code>.xlsx</code> file from your laptop drive. The tool will parse it and append this bill at the end.
              </p>

              {selectedMode === 'existing' && (
                <div className="upload-existing-box" onClick={(e) => e.stopPropagation()}>
                  <label className="btn-secondary btn-block">
                    <FolderOpen size={16} />
                    <span>Select .xlsx from your Laptop</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      style={{ display: 'none' }}
                      onChange={handleFileInputChange}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>

          {selectedMode === 'current' && (
            <button 
              className="btn-primary" 
              onClick={() => onAppendToCurrent(billRecord)}
            >
              <FileCheck size={18} />
              <span>Append as Row #{activeWorkbook?.rowCount + 1}</span>
            </button>
          )}

          {selectedMode === 'new' && (
            <button 
              className="btn-primary" 
              onClick={handleCreateSubmit}
            >
              <PlusCircle size={18} />
              <span>Create & Save Workbook</span>
            </button>
          )}

          {selectedMode === 'existing' && (
            <label className="btn-primary">
              <FolderOpen size={18} />
              <span>Choose File & Append</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  Laptop, 
  Layers, 
  FileCheck,
  Zap,
  Printer
} from 'lucide-react';

import Navbar from './components/Navbar';
import DropZone from './components/DropZone';
import ExternalScannerModal from './components/ExternalScannerModal';
import ReviewModal from './components/ReviewModal';
import DestinationDialog from './components/DestinationDialog';
import SpreadsheetViewer from './components/SpreadsheetViewer';
import AiModelModal from './components/AiModelModal';

import { performReceiptOCR } from './ocr/tesseractHelper';
import { parseBillText } from './ocr/billParser';
import { isPdfFile, processPdfBill } from './ocr/pdfHelper';
import { extractBillWithGemini } from './ocr/geminiVisionHelper';
import { 
  createNewWorkbook, 
  appendBillToWorkbook, 
  parseWorkbookBuffer, 
  downloadWorkbookFile 
} from './excel/excelManager';

import './App.css';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('billscanner_theme') || 'dark');
  const [activeWorkbook, setActiveWorkbook] = useState(null);
  
  // OCR & Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [billImageSrc, setBillImageSrc] = useState(null);
  const [currentFileObject, setCurrentFileObject] = useState(null);
  const [interceptedBill, setInterceptedBill] = useState(null);

  // AI Vision Model State
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('billscanner_gemini_key') || '');
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('billscanner_gemini_model') || 'gemini-1.5-flash');
  const [useAiByDefault, setUseAiByDefault] = useState(() => localStorage.getItem('billscanner_use_ai') === 'true');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // External Scanner State & Folder Watcher
  const [scannerStatus, setScannerStatus] = useState({
    connected: false,
    folderName: '',
  });
  const [isScannerSettingsOpen, setIsScannerSettingsOpen] = useState(false);
  const [autoAppendMode, setAutoAppendMode] = useState(false);
  const dirHandleRef = useRef(null);
  const knownFilesRef = useRef(new Set());
  const watcherIntervalRef = useRef(null);

  // Modals
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDestinationOpen, setIsDestinationOpen] = useState(false);
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [newSheetNameInput, setNewSheetNameInput] = useState('');

  // Notifications & Table Highlight
  const [recentlyAddedIndex, setRecentlyAddedIndex] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('billscanner_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /**
   * Main Interceptor: handles any image or PDF file from external scanner, drop, browse, or paste.
   */
  const handleImageSelected = useCallback(async (file, sourceName) => {
    try {
      setIsProcessing(true);
      setCurrentFileObject(file);
      setOcrProgress({ status: 'preparing', progress: 0.1, message: `Intercepting "${sourceName}"...` });

      let previewImageSrc = null;
      let textToParse = '';
      let pdfResult = null;

      if (isPdfFile(file)) {
        setOcrProgress({ status: 'pdf', progress: 0.2, message: 'Rendering PDF invoice pages...' });
        pdfResult = await processPdfBill(file);
        previewImageSrc = pdfResult.imageDataUrl;
        setBillImageSrc(previewImageSrc);

        // Check if Gemini AI should run first
        if (geminiKey && useAiByDefault) {
          try {
            setOcrProgress({ status: 'gemini', progress: 0.6, message: 'Extracting line items with Gemini AI Vision...' });
            const aiResult = await extractBillWithGemini(previewImageSrc, geminiKey, geminiModel);
            aiResult.previewPages = pdfResult.previewPages;
            aiResult.numPages = pdfResult.numPages;
            setInterceptedBill(aiResult);
            setIsProcessing(false);
            setOcrProgress(null);
            setIsReviewOpen(true);
            return;
          } catch (aiErr) {
            console.warn('Gemini AI failed, falling back to local OCR:', aiErr);
          }
        }

        if (pdfResult.hasEmbeddedText) {
          setOcrProgress({ status: 'pdf_text', progress: 0.85, message: 'Extracting digital invoice data...' });
          textToParse = pdfResult.embeddedText;
        } else {
          setOcrProgress({ status: 'ocr_scanned_pdf', progress: 0.35, message: 'Performing OCR on scanned PDF...' });
          const ocrResult = await performReceiptOCR(pdfResult.imageDataUrl, (progressInfo) => {
            setOcrProgress(progressInfo);
          });
          textToParse = ocrResult.text;
        }
      } else {
        // Standard Image (JPG, PNG, WEBP)
        const objectUrl = URL.createObjectURL(file);
        previewImageSrc = objectUrl;
        setBillImageSrc(objectUrl);

        // Check if Gemini AI should run first
        if (geminiKey && useAiByDefault) {
          try {
            setOcrProgress({ status: 'gemini', progress: 0.6, message: 'Extracting line items with Gemini AI Vision...' });
            const aiResult = await extractBillWithGemini(file, geminiKey, geminiModel);
            setInterceptedBill(aiResult);
            setIsProcessing(false);
            setOcrProgress(null);
            setIsReviewOpen(true);
            return;
          } catch (aiErr) {
            console.warn('Gemini AI failed, falling back to local OCR:', aiErr);
          }
        }

        const ocrResult = await performReceiptOCR(file, (progressInfo) => {
          setOcrProgress(progressInfo);
        });
        textToParse = ocrResult.text;
      }

      // Parse structured bill fields & itemized lines
      const parsed = parseBillText(textToParse);
      if (pdfResult) {
        parsed.previewPages = pdfResult.previewPages;
        parsed.numPages = pdfResult.numPages;
      }

      setInterceptedBill(parsed);
      setIsProcessing(false);
      setOcrProgress(null);
      setIsReviewOpen(true);
    } catch (err) {
      console.error('Failed to process bill file:', err);
      setIsProcessing(false);
      setOcrProgress(null);
      showToast('Error processing bill/PDF. Please check the file.', 'error');
    }
  }, [geminiKey, geminiModel, useAiByDefault]);

  /**
   * Manual trigger to run or re-run Gemini AI Vision extraction from the Review screen.
   */
  const handleRunGeminiVision = async () => {
    if (!billImageSrc && !currentFileObject) return;
    if (!geminiKey) {
      setIsAiModalOpen(true);
      return;
    }

    try {
      showToast('Analyzing line items with Google Gemini Vision...', 'info');
      const targetSource = currentFileObject || billImageSrc;
      const aiResult = await extractBillWithGemini(targetSource, geminiKey, geminiModel);
      setInterceptedBill(aiResult);
      showToast(`AI Model successfully extracted ${aiResult.items.length} line items!`, 'success');
    } catch (err) {
      console.error('Gemini extraction failed:', err);
      showToast(err.message || 'AI extraction failed. Check your API key.', 'error');
    }
  };

  /**
   * Connect to the local folder where the external scanner saves files.
   * Uses modern browser Directory Picker API.
   */
  const handleConnectScannerFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        showToast('Your browser does not support folder picker. Use Chrome or Edge.', 'error');
        return;
      }

      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      dirHandleRef.current = dirHandle;

      // Seed initial files so we only intercept newly created scans
      const initialSet = new Set();
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          initialSet.add(entry.name);
        }
      }
      knownFilesRef.current = initialSet;

      setScannerStatus({
        connected: true,
        folderName: dirHandle.name,
      });

      showToast(`External Scanner Folder connected: "${dirHandle.name}"! Listening for scans...`, 'success');

      // Start real-time folder polling
      if (watcherIntervalRef.current) clearInterval(watcherIntervalRef.current);
      watcherIntervalRef.current = setInterval(async () => {
        if (!dirHandleRef.current) return;
        try {
          for await (const entry of dirHandleRef.current.values()) {
            if (entry.kind === 'file' && !knownFilesRef.current.has(entry.name)) {
              const ext = entry.name.toLowerCase();
              if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp') || ext.endsWith('.pdf')) {
                // New scan intercepted from hardware scanner!
                knownFilesRef.current.add(entry.name);
                const file = await entry.getFile();
                showToast(`New bill intercepted from external scanner: ${entry.name}`, 'info');
                handleImageSelected(file, `External Scanner: ${entry.name}`);
                break;
              }
            }
          }
        } catch (pollErr) {
          console.warn('Folder watch poll error:', pollErr);
        }
      }, 1500);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to select scanner folder:', err);
        showToast('Could not access selected directory.', 'error');
      }
    }
  };

  const handleDisconnectScannerFolder = () => {
    if (watcherIntervalRef.current) clearInterval(watcherIntervalRef.current);
    dirHandleRef.current = null;
    knownFilesRef.current = new Set();
    setScannerStatus({ connected: false, folderName: '' });
    showToast('External scanner folder disconnected.', 'info');
  };

  /**
   * Simulates a new incoming scan from an external hardware scanner.
   */
  const handleSimulateExternalScan = async () => {
    try {
      showToast('Simulating incoming document from External Scanner...', 'info');
      const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      const response = await fetch(`${baseUrl}sample_tech.jpg`);
      const blob = await response.blob();
      const file = new File([blob], `Scanner_Scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleImageSelected(file, 'External Scanner (Hardware Feed)');
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  const handleProceedToSave = (reviewedRecord) => {
    setInterceptedBill(reviewedRecord);
    setIsReviewOpen(false);
    setIsDestinationOpen(true);
  };

  /**
   * Option 1: Append to current active workbook
   */
  const handleAppendToCurrent = async (record) => {
    if (!activeWorkbook) return;
    try {
      const result = await appendBillToWorkbook(
        activeWorkbook.buffer,
        activeWorkbook.fileName,
        record
      );

      setActiveWorkbook(result);
      setRecentlyAddedIndex(result.rowCount);
      setIsDestinationOpen(false);

      // Trigger celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#0d9488', '#14b8a6', '#0284c7', '#38bdf8'],
      });

      downloadWorkbookFile(result.buffer, result.fileName);
      showToast(`Appended row #${result.rowCount} into "${result.fileName}" & saved!`, 'success');
    } catch (err) {
      console.error('Failed to append to current workbook:', err);
      showToast('Failed to append bill to Excel workbook.', 'error');
    }
  };

  /**
   * Option 2: Create brand new workbook
   */
  const handleCreateNew = async (fileName, record) => {
    try {
      const result = await createNewWorkbook(fileName, record);
      setActiveWorkbook(result);
      setRecentlyAddedIndex(result.rowCount);
      setIsDestinationOpen(false);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#0d9488', '#10b981', '#3b82f6', '#f59e0b'],
      });

      downloadWorkbookFile(result.buffer, result.fileName);
      showToast(`Created new workbook "${result.fileName}" with initial bill!`, 'success');
    } catch (err) {
      console.error('Failed to create new workbook:', err);
      showToast('Failed to create new Excel workbook.', 'error');
    }
  };

  /**
   * Option 3: Pick existing file from laptop and append
   */
  const handlePickExistingFileAndAppend = async (file, record) => {
    try {
      const buffer = await file.arrayBuffer();
      const result = await appendBillToWorkbook(buffer, file.name, record);

      setActiveWorkbook(result);
      setRecentlyAddedIndex(result.rowCount);
      setIsDestinationOpen(false);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#0d9488', '#14b8a6', '#0284c7'],
      });

      downloadWorkbookFile(result.buffer, result.fileName);
      showToast(`Appended bill into "${file.name}" (Row #${result.rowCount})!`, 'success');
    } catch (err) {
      console.error('Failed to load existing file:', err);
      showToast('Could not parse the selected Excel file. Make sure it is a valid .xlsx file.', 'error');
    }
  };

  /**
   * Navbar: Open existing Excel file to view/append
   */
  const handleOpenExistingFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseWorkbookBuffer(buffer, file.name);
      setActiveWorkbook(result);
      showToast(`Loaded "${file.name}" with ${result.rowCount} bills.`, 'info');
      e.target.value = '';
    } catch (err) {
      console.error('Failed to open Excel file:', err);
      showToast('Failed to open Excel file. Please choose a valid .xlsx workbook.', 'error');
    }
  };

  /**
   * Navbar: Create blank sheet
   */
  const handleCreateBlankSheet = async (fileName) => {
    const clean = fileName.trim() || 'Expenses_New.xlsx';
    try {
      const result = await createNewWorkbook(clean, null);
      setActiveWorkbook(result);
      setIsNewSheetModalOpen(false);
      showToast(`Created fresh spreadsheet "${result.fileName}"! Ready to intercept bills.`, 'success');
    } catch (err) {
      console.error('Failed to create blank sheet:', err);
    }
  };

  const handleDownloadCurrent = () => {
    if (!activeWorkbook) return;
    downloadWorkbookFile(activeWorkbook.buffer, activeWorkbook.fileName);
    showToast(`Downloaded "${activeWorkbook.fileName}"`, 'info');
  };

  return (
    <div className="app-container">
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        activeWorkbook={activeWorkbook}
        onOpenExistingFile={handleOpenExistingFile}
        onCreateNewSheet={() => setIsNewSheetModalOpen(true)}
        onDownloadCurrent={activeWorkbook ? handleDownloadCurrent : null}
        scannerStatus={scannerStatus}
        onOpenScannerSettings={() => setIsScannerSettingsOpen(true)}
        hasGeminiKey={!!geminiKey}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      <main className="main-content">
        {/* Hero Banner / Instructions */}
        <section className="hero-banner">
          <div className="hero-tag">
            <Printer size={14} className="text-teal" />
            <span>External Scanner & Laptop Suite</span>
          </div>
          <h1 className="hero-title">
            External Scanner to Excel Interceptor
          </h1>
          <p className="hero-desc">
            Place paper bills in your external USB/Wi-Fi scanner. BillScanner intercepts newly saved scans in real-time, extracts all fields and itemized tables via OCR or AI Vision, and automatically converts or appends them into your Excel spreadsheets.
          </p>
        </section>

        {/* Drop Zone & Scanner Watcher Area */}
        <section className="scanner-section">
          <DropZone
            onImageSelected={handleImageSelected}
            isProcessing={isProcessing}
            ocrProgress={ocrProgress}
            scannerStatus={scannerStatus}
            onOpenScannerSettings={() => setIsScannerSettingsOpen(true)}
            onConnectScannerFolder={handleConnectScannerFolder}
          />
        </section>

        {/* Live Spreadsheet Grid View */}
        {activeWorkbook && activeWorkbook.rowCount > 0 && (
          <section className="spreadsheet-section">
            <SpreadsheetViewer
              workbookData={activeWorkbook}
              onDownloadExcel={handleDownloadCurrent}
              recentlyAddedRowIndex={recentlyAddedIndex}
            />
          </section>
        )}
      </main>

      {/* External Scanner Settings & Guide Modal */}
      <ExternalScannerModal
        isOpen={isScannerSettingsOpen}
        onClose={() => setIsScannerSettingsOpen(false)}
        scannerStatus={scannerStatus}
        onConnectFolder={handleConnectScannerFolder}
        onDisconnectFolder={handleDisconnectScannerFolder}
        autoAppendMode={autoAppendMode}
        setAutoAppendMode={setAutoAppendMode}
        onSimulateExternalScan={handleSimulateExternalScan}
      />

      {/* AI Vision Model Settings Modal */}
      <AiModelModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        apiKey={geminiKey}
        setApiKey={setGeminiKey}
        selectedModel={geminiModel}
        setSelectedModel={setGeminiModel}
        useAiByDefault={useAiByDefault}
        setUseAiByDefault={setUseAiByDefault}
      />

      {/* Review & Edit Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        billData={interceptedBill}
        imageSrc={billImageSrc}
        onProceedToSave={handleProceedToSave}
        onRunGeminiVision={handleRunGeminiVision}
        hasGeminiKey={!!geminiKey}
      />

      {/* Destination Selection Dialog */}
      <DestinationDialog
        isOpen={isDestinationOpen}
        onClose={() => setIsDestinationOpen(false)}
        billRecord={interceptedBill}
        activeWorkbook={activeWorkbook}
        onAppendToCurrent={handleAppendToCurrent}
        onCreateNew={handleCreateNew}
        onPickExistingFileAndAppend={handlePickExistingFileAndAppend}
      />

      {/* Blank Workbook Creation Modal */}
      {isNewSheetModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card small-modal glass-panel">
            <div className="modal-header">
              <h3 className="modal-title">Create New Spreadsheet</h3>
              <button className="btn-icon" onClick={() => setIsNewSheetModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateBlankSheet(newSheetNameInput); }}>
              <div className="form-group" style={{ padding: '16px 20px' }}>
                <label>Workbook Name (.xlsx)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October_Office_Expenses.xlsx"
                  value={newSheetNameInput}
                  onChange={(e) => setNewSheetNameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsNewSheetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`toast-notification glass-panel toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-teal" />}
          {toast.type === 'error' && <AlertTriangle size={18} className="text-rose" />}
          {toast.type === 'info' && <Info size={18} className="text-sky" />}
          <span className="toast-message">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

# BillScanner - Smart Bill, Receipt & PO to Excel Interceptor

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-teal?style=for-the-badge&logo=github)](https://ommahindroo.github.io/BillManagerApp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **🚀 Try it Live Online:** [https://ommahindroo.github.io/BillManagerApp/](https://ommahindroo.github.io/BillManagerApp/)
> Anyone can drop in bill images or multi-page PDFs to extract line-item tables and export to Excel directly in their browser without installing anything!

A comprehensive suite for converting scanned paper bills, commercial invoices, and multi-page purchase orders directly into **Microsoft Excel (`.xlsx`)** spreadsheets and **Google Sheets**.

Includes:
1. **Desktop / Web App (`desktop-app/`)**: High-performance React + Vite web application that intercepts documents from external hardware scanners, folders, drag-and-drop, multi-page PDFs, or clipboard screenshots. Features multi-page PDF processing with up to 40+ itemized lines (quantities, MRP, GST, SGST, CGST, final amounts), interactive preview verification, and direct `.xlsx` spreadsheet management.
2. **Android Mobile App (`app/`)**: Native Android app built with Kotlin, Jetpack Compose, ML Kit Document Scanner, and Apache POI.

---

## 🖥️ BillScanner Desktop (PC & Laptop)

Built specifically for high-volume receipt and invoice processing on computers without relying on webcams.

### Desktop Key Features
- **External Hardware Scanner Integration**:
  - Connect your external USB, network, or Wi-Fi scanner's output folder via the File System Access API.
  - Automatically intercepts newly scanned bills as soon as they are saved to disk.
- **Multi-Page PDF Processing**:
  - Handles multi-page commercial documents (tested with 5-page purchase orders containing 40+ line items).
  - Handles cross-page items seamlessly where item headers and totals span across page breaks.
- **Deep Line-Item Extraction**:
  - Automatically parses:
    - **Sr. No**
    - **Item Name / Description** (filters barcodes, EANs, and formatting artifacts)
    - **Quantity & Units** (`KG`, `PC`, `PK`, `RL`, `EA`, `g`)
    - **MRP / Unit Rate**
    - **SGST & CGST**
    - **GST %**
    - **Final Amount**
- **Interactive Review & Verification Modal**:
  - Left pane: High-resolution document viewer with multi-page flipping (`Page 1 of 5 [<] [>]`), zoom, and rotation controls.
  - Right pane: Metadata editor (Vendor, Invoice/PO #, Date, Grand Total) and an editable itemized spreadsheet table with real-time tax calculations.
- **Local Excel Engine**:
  - Automatically creates and manages styled `.xlsx` workbooks.
  - Direct download and instant in-browser spreadsheet preview with totals and statistics.
- **AI Extraction (Optional)**:
  - Supports Google Gemini AI Vision for unstructured or complex foreign invoices.

### Running the Desktop App
```bash
cd desktop-app
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser.

---

## 📱 BillScanner Mobile (Android)

Built with **Kotlin** and **Jetpack Compose (Material 3)**.

### Android Key Features
- **On-Device Document Scanner**: Powered by `play-services-mlkit-document-scanner` with auto-edge detection and shadow removal.
- **On-Device OCR**: 100% private text recognition with `play-services-mlkit-text-recognition`.
- **Apache POI Excel Engine**: Generates `.xlsx` spreadsheets directly on the device.
- **Google Sheets Cloud Sync**: Live sync via Google Drive & Sheets API v4.

### Running the Android App
1. Open `BillManagerApp` in **Android Studio**.
2. Connect an Android device (Android 8.0+ / API 26+).
3. Run `.\gradlew.bat assembleDebug` or click **Run** (`Shift + F10`).

---

## 📂 Repository Structure

```
BillManagerApp/
├── desktop-app/                  # Desktop Web Interceptor (React, Vite, PDF.js, Tesseract, SheetJS)
│   ├── src/
│   │   ├── components/           # ReviewModal, DropZone, ScannerSettings, SpreadsheetViewer
│   │   ├── ocr/                  # pdfHelper.js, billParser.js, ocrService.js, geminiService.js
│   │   └── excel/                # excelManager.js
│   └── public/                   # Sample test bills (5-page PO, Apex invoice, Pacific Crest)
├── app/                          # Android Application module (Kotlin, Compose, Room, POI)
│   └── src/main/java/com/billscanner/app/
├── build.gradle
├── settings.gradle
└── README.md
```

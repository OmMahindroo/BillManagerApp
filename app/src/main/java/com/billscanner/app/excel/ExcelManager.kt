package com.billscanner.app.excel

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.billscanner.app.data.model.BillRecord
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.poi.ss.usermodel.*
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ExcelManager(private val context: Context) {

    private val headers = arrayOf(
        "#",
        "Date",
        "Store / Vendor",
        "Total Amount",
        "Category",
        "Tax",
        "Subtotal",
        "Invoice / Bill #",
        "Payment Mode",
        "Notes",
        "Scanned Timestamp"
    )

    fun getExcelDirectory(): File {
        // Try public Documents directory first so files are easily visible in phone's Files/My Files app
        val publicDocs = File(
            android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOCUMENTS),
            "BillScanner"
        )
        if (publicDocs.exists() || publicDocs.mkdirs()) {
            return publicDocs
        }
        // Fallback to app-specific external storage
        val dir = File(context.getExternalFilesDir(null), "Spreadsheets")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun getReadablePath(file: File): String {
        return if (file.absolutePath.contains("Documents/BillScanner")) {
            "Documents > BillScanner > ${file.name}"
        } else if (file.absolutePath.contains("Download")) {
            "Downloads > ${file.name}"
        } else {
            "App Storage > ${file.name}"
        }
    }

    fun getUniqueFile(baseName: String): File {
        val cleanName = if (baseName.endsWith(".xlsx", ignoreCase = true)) {
            baseName.substringBeforeLast(".xlsx")
        } else {
            baseName
        }
        val dir = getExcelDirectory()
        var candidate = File(dir, "$cleanName.xlsx")
        var counter = 1
        while (candidate.exists()) {
            candidate = File(dir, "${cleanName}_$counter.xlsx")
            counter++
        }
        return candidate
    }

    /**
     * Creates a new Excel (.xlsx) file with formatted headers and adds the initial bill row if provided.
     */
    suspend fun createNewWorkbook(
        fileName: String,
        initialBill: BillRecord? = null
    ): Pair<File, Int> = withContext(Dispatchers.IO) {
        val targetFile = getUniqueFile(fileName)

        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Bills")

        // Styles
        val headerStyle = createHeaderStyle(workbook)
        val dataStyle = createDataStyle(workbook)
        val currencyStyle = createCurrencyStyle(workbook)

        // Header row
        val headerRow = sheet.createRow(0)
        for (i in headers.indices) {
            val cell = headerRow.createCell(i)
            cell.setCellValue(headers[i])
            cell.setCellStyle(headerStyle)
        }

        var rowCount = 0
        if (initialBill != null) {
            val row = sheet.createRow(1)
            writeBillToRow(1, row, initialBill, dataStyle, currencyStyle)
            rowCount = 1
        }

        // Optimized column widths for mobile screens (Total Amount visible immediately)
        val standardWidths = intArrayOf(
            1800, // #
            3200, // Date
            5500, // Store / Vendor
            4200, // Total Amount
            4200, // Category
            3200, // Tax
            3200, // Subtotal
            4200, // Invoice / Bill #
            3500, // Payment Mode
            5500, // Notes
            4500  // Scanned Timestamp
        )
        for (i in headers.indices) {
            val width = if (i < standardWidths.size) standardWidths[i] else 4000
            sheet.setColumnWidth(i, width)
        }

        FileOutputStream(targetFile).use { fos ->
            workbook.write(fos)
            fos.flush()
        }
        workbook.close()

        android.media.MediaScannerConnection.scanFile(
            context,
            arrayOf(targetFile.absolutePath),
            arrayOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            null
        )

        Pair(targetFile, rowCount)
    }

    /**
     * Appends a new bill row to an existing .xlsx file.
     * Uses memory buffer and atomic replacement to prevent file-locking corruption.
     * Returns the 1-based bill index in the sheet.
     */
    suspend fun appendBillToWorkbook(
        file: File,
        bill: BillRecord
    ): Int = withContext(Dispatchers.IO) {
        if (!file.exists()) {
            val (_, count) = createNewWorkbook(file.name, bill)
            return@withContext count
        }

        // 1. Read entire file into a memory buffer and release the file handle immediately
        val bytes = file.readBytes()
        val workbook = XSSFWorkbook(java.io.ByteArrayInputStream(bytes))
        val sheet = workbook.getSheetAt(0)

        val nextRowNum = sheet.lastRowNum + 1
        val dataStyle = createDataStyle(workbook)
        val currencyStyle = createCurrencyStyle(workbook)

        val row = sheet.createRow(nextRowNum)
        writeBillToRow(nextRowNum, row, bill, dataStyle, currencyStyle)

        // 2. Write safely to a temporary file in the same directory
        val tempFile = File(file.parentFile, "${file.name}.${System.currentTimeMillis()}.tmp")
        FileOutputStream(tempFile).use { fos ->
            workbook.write(fos)
            fos.flush()
        }
        workbook.close()

        // 3. Atomically replace the original file
        if (tempFile.exists()) {
            if (file.exists()) {
                file.delete()
            }
            tempFile.renameTo(file)
        }

        // 4. Notify Android media scanner so the OS immediately updates size & last modified timestamp
        android.media.MediaScannerConnection.scanFile(
            context,
            arrayOf(file.absolutePath),
            arrayOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            null
        )

        return@withContext nextRowNum
    }

    /**
     * Computes the total bill count and expense sum from an existing .xlsx file.
     */
    suspend fun calculateWorkbookStats(file: File): Pair<Int, Double> = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext Pair(0, 0.0)

        try {
            FileInputStream(file).use { fis ->
                val workbook = XSSFWorkbook(fis)
                val sheet = workbook.getSheetAt(0)
                val totalRows = sheet.lastRowNum
                var sum = 0.0

                // Dynamically identify Total Amount column (supports both new column 3 and legacy column 7)
                val headerRow = sheet.getRow(0)
                var totalColIdx = 3
                if (headerRow != null) {
                    for (c in 0 until headerRow.lastCellNum) {
                        val headerVal = headerRow.getCell(c)?.stringCellValue ?: ""
                        if (headerVal.contains("total amount", ignoreCase = true)) {
                            totalColIdx = c
                            break
                        }
                    }
                }

                for (r in 1..totalRows) {
                    val row = sheet.getRow(r) ?: continue
                    val totalCell = row.getCell(totalColIdx)
                    if (totalCell != null && totalCell.cellType == CellType.NUMERIC) {
                        sum += totalCell.numericCellValue
                    }
                }
                workbook.close()
                return@withContext Pair(totalRows, sum)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Pair(0, 0.0)
        }
    }

    /**
     * Copies the .xlsx file into the public Downloads directory so the user can easily find it.
     */
    fun exportToPublicFolder(sourceFile: File): File? {
        return try {
            val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val destFile = File(downloadsDir, sourceFile.name)
            sourceFile.copyTo(destFile, overwrite = true)
            android.media.MediaScannerConnection.scanFile(
                context,
                arrayOf(destFile.absolutePath),
                arrayOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                null
            )
            destFile
        } catch (t: Throwable) {
            t.printStackTrace()
            null
        }
    }

    private fun writeBillToRow(
        index: Int,
        row: Row,
        bill: BillRecord,
        dataStyle: CellStyle,
        currencyStyle: CellStyle
    ) {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        val formattedTimestamp = sdf.format(Date(bill.timestamp))

        // #
        row.createCell(0).apply {
            setCellValue(index.toDouble())
            setCellStyle(dataStyle)
        }
        // Date
        row.createCell(1).apply {
            setCellValue(bill.date)
            setCellStyle(dataStyle)
        }
        // Store / Vendor
        row.createCell(2).apply {
            setCellValue(bill.merchant)
            setCellStyle(dataStyle)
        }
        // Total Amount
        row.createCell(3).apply {
            setCellValue(bill.totalAmount)
            setCellStyle(currencyStyle)
        }
        // Category
        row.createCell(4).apply {
            setCellValue(bill.category)
            setCellStyle(dataStyle)
        }
        // Tax
        row.createCell(5).apply {
            setCellValue(bill.tax)
            setCellStyle(currencyStyle)
        }
        // Subtotal
        row.createCell(6).apply {
            setCellValue(bill.subtotal)
            setCellStyle(currencyStyle)
        }
        // Invoice #
        row.createCell(7).apply {
            setCellValue(bill.invoiceNumber)
            setCellStyle(dataStyle)
        }
        // Payment Mode
        row.createCell(8).apply {
            setCellValue(bill.paymentMethod)
            setCellStyle(dataStyle)
        }
        // Notes
        row.createCell(9).apply {
            setCellValue(bill.notes)
            setCellStyle(dataStyle)
        }
        // Scanned Timestamp
        row.createCell(10).apply {
            setCellValue(formattedTimestamp)
            setCellStyle(dataStyle)
        }
    }

    private fun createHeaderStyle(workbook: Workbook): CellStyle {
        val style = workbook.createCellStyle()
        val font = workbook.createFont().apply {
            bold = true
            color = IndexedColors.WHITE.index
            fontHeightInPoints = 11.toShort()
        }
        style.setFont(font)
        style.fillForegroundColor = IndexedColors.DARK_TEAL.index
        style.fillPattern = FillPatternType.SOLID_FOREGROUND
        style.alignment = HorizontalAlignment.CENTER
        style.verticalAlignment = VerticalAlignment.CENTER
        style.borderBottom = BorderStyle.MEDIUM
        style.setBottomBorderColor(IndexedColors.GREY_50_PERCENT.index)
        return style
    }

    private fun createDataStyle(workbook: Workbook): CellStyle {
        val style = workbook.createCellStyle()
        style.alignment = HorizontalAlignment.LEFT
        style.verticalAlignment = VerticalAlignment.CENTER
        style.borderBottom = BorderStyle.THIN
        style.borderTop = BorderStyle.THIN
        style.borderRight = BorderStyle.THIN
        style.borderLeft = BorderStyle.THIN
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.index)
        return style
    }

    private fun createCurrencyStyle(workbook: Workbook): CellStyle {
        val style = workbook.createCellStyle()
        val format = workbook.createDataFormat()
        style.dataFormat = format.getFormat("#,##0.00")
        style.alignment = HorizontalAlignment.RIGHT
        style.verticalAlignment = VerticalAlignment.CENTER
        style.borderBottom = BorderStyle.THIN
        style.borderTop = BorderStyle.THIN
        style.borderRight = BorderStyle.THIN
        style.borderLeft = BorderStyle.THIN
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.index)
        return style
    }

    /**
     * Intent to open the .xlsx file in Microsoft Excel or Google Sheets.
     */
    fun getOpenFileIntent(file: File): Intent {
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
        }
    }

    /**
     * Intent to share the .xlsx file via WhatsApp, Gmail, Slack, Drive, etc.
     */
    fun getShareFileIntent(file: File): Intent {
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        return Intent(Intent.ACTION_SEND).apply {
            type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Bill Spreadsheet: ${file.name}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}

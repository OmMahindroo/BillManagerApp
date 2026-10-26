package com.billscanner.app

import com.billscanner.app.data.model.BillRecord
import org.apache.poi.ss.usermodel.BorderStyle
import org.apache.poi.ss.usermodel.FillPatternType
import org.apache.poi.ss.usermodel.HorizontalAlignment
import org.apache.poi.ss.usermodel.IndexedColors
import org.apache.poi.ss.usermodel.VerticalAlignment
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class ExcelManagerTest {

    @Test
    fun testCreateAndReadWorkbookWithoutAwt() {
        val tempDir = File(System.getProperty("java.io.tmpdir"), "excel_test_${System.currentTimeMillis()}")
        tempDir.mkdirs()
        val file = File(tempDir, "Test_Bills.xlsx")

        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Bills")

        val headerStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
            }
            setFont(font)
            fillForegroundColor = IndexedColors.DARK_TEAL.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            alignment = HorizontalAlignment.CENTER
            verticalAlignment = VerticalAlignment.CENTER
        }

        val headerRow = sheet.createRow(0)
        val headers = arrayOf("#", "Date", "Vendor", "Total")
        for (i in headers.indices) {
            val cell = headerRow.createCell(i)
            cell.setCellValue(headers[i])
            cell.setCellStyle(headerStyle)
        }

        // Set explicit column widths (AWT-free)
        sheet.setColumnWidth(0, 2000)
        sheet.setColumnWidth(1, 4000)
        sheet.setColumnWidth(2, 6000)
        sheet.setColumnWidth(3, 3500)

        // Write a row
        val row1 = sheet.createRow(1)
        row1.createCell(0).setCellValue(1.0)
        row1.createCell(1).setCellValue("2026-09-22")
        row1.createCell(2).setCellValue("Walmart")
        row1.createCell(3).setCellValue(45.50)

        FileOutputStream(file).use { fos ->
            workbook.write(fos)
        }
        workbook.close()

        assertTrue("File should exist", file.exists())
        assertTrue("File size should be > 0", file.length() > 0)

        // Re-read workbook
        FileInputStream(file).use { fis ->
            val readWb = XSSFWorkbook(fis)
            val readSheet = readWb.getSheetAt(0)
            assertEquals("Bills", readSheet.sheetName)
            assertEquals(1, readSheet.lastRowNum)
            assertEquals("Walmart", readSheet.getRow(1).getCell(2).stringCellValue)
            assertEquals(45.50, readSheet.getRow(1).getCell(3).numericCellValue, 0.01)
            readWb.close()
        }

        file.delete()
        tempDir.delete()
    }
}

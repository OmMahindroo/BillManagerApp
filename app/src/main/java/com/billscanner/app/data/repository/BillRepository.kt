package com.billscanner.app.data.repository

import com.billscanner.app.data.db.BillDao
import com.billscanner.app.data.db.SpreadsheetTargetDao
import com.billscanner.app.data.model.BillRecord
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget
import com.billscanner.app.excel.ExcelManager
import com.billscanner.app.googlesheets.GoogleSheetsManager
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import kotlinx.coroutines.flow.Flow
import java.io.File

class BillRepository(
    private val billDao: BillDao,
    private val targetDao: SpreadsheetTargetDao,
    private val excelManager: ExcelManager,
    private val googleSheetsManager: GoogleSheetsManager
) {
    // Flows
    val allTargetsFlow: Flow<List<SpreadsheetTarget>> = targetDao.getAllTargetsFlow()
    val activeTargetFlow: Flow<SpreadsheetTarget?> = targetDao.getActiveDefaultTargetFlow()
    val recentBillsFlow: Flow<List<BillRecord>> = billDao.getRecentBillsFlow()
    val totalBillsCountFlow: Flow<Int> = billDao.getTotalBillCountFlow()
    val totalExpenseSumFlow: Flow<Double> = billDao.getTotalExpenseSumFlow()

    fun getBillsForTarget(targetId: Long): Flow<List<BillRecord>> = billDao.getBillsForTargetFlow(targetId)

    suspend fun getActiveTarget(): SpreadsheetTarget? = targetDao.getActiveDefaultTarget()

    suspend fun setActiveTarget(targetId: Long) {
        targetDao.setActiveTarget(targetId)
    }

    /**
     * Saves a bill to an existing target (Excel or Google Sheets).
     */
    suspend fun appendBillToExistingTarget(
        target: SpreadsheetTarget,
        bill: BillRecord,
        googleAccount: GoogleSignInAccount? = null
    ): BillRecord {
        val rowIndex = when (target.type) {
            DestinationType.LOCAL_EXCEL -> {
                val file = target.localFilePath?.let { File(it) }
                    ?: throw IllegalStateException("Excel file path not found for target ${target.id}")
                excelManager.appendBillToWorkbook(file, bill)
            }
            DestinationType.GOOGLE_SHEETS -> {
                val account = googleAccount
                    ?: throw IllegalStateException("Google account required to append to Google Sheets")
                val sheetId = target.googleSpreadsheetId
                    ?: throw IllegalStateException("Spreadsheet ID not found")
                googleSheetsManager.appendBillToGoogleSheet(account, sheetId, bill)
            }
        }

        // Save bill to Room DB
        val billToInsert = bill.copy(
            spreadsheetTargetId = target.id,
            spreadsheetRowIndex = rowIndex
        )
        val insertedId = billDao.insertBill(billToInsert)

        // Update target stats
        targetDao.incrementBillCountAndSum(target.id, bill.totalAmount)

        return billToInsert.copy(id = insertedId)
    }

    /**
     * Creates a new Excel spreadsheet and saves the bill as the first row.
     */
    suspend fun createAndSaveToNewExcel(
        fileName: String,
        bill: BillRecord,
        setAsDefaultActive: Boolean = true
    ): BillRecord {
        val (file, rowCount) = excelManager.createNewWorkbook(fileName, bill)

        val target = SpreadsheetTarget(
            name = file.name,
            type = DestinationType.LOCAL_EXCEL,
            localFilePath = file.absolutePath,
            billCount = rowCount,
            totalAmountSum = bill.totalAmount,
            isActiveDefault = setAsDefaultActive
        )

        if (setAsDefaultActive) {
            targetDao.clearActiveDefaults()
        }
        val targetId = targetDao.insertTarget(target)

        val billToInsert = bill.copy(
            spreadsheetTargetId = targetId,
            spreadsheetRowIndex = rowCount
        )
        val insertedId = billDao.insertBill(billToInsert)

        return billToInsert.copy(id = insertedId)
    }

    /**
     * Creates a new Google Sheet in Google Drive and saves the bill as the first row.
     */
    suspend fun createAndSaveToNewGoogleSheet(
        account: GoogleSignInAccount,
        title: String,
        bill: BillRecord,
        setAsDefaultActive: Boolean = true
    ): BillRecord {
        val (sheetId, sheetUrl) = googleSheetsManager.createNewGoogleSheet(account, title, bill)

        val target = SpreadsheetTarget(
            name = title,
            type = DestinationType.GOOGLE_SHEETS,
            googleSpreadsheetId = sheetId,
            googleSpreadsheetUrl = sheetUrl,
            billCount = 1,
            totalAmountSum = bill.totalAmount,
            isActiveDefault = setAsDefaultActive
        )

        if (setAsDefaultActive) {
            targetDao.clearActiveDefaults()
        }
        val targetId = targetDao.insertTarget(target)

        val billToInsert = bill.copy(
            spreadsheetTargetId = targetId,
            spreadsheetRowIndex = 1
        )
        val insertedId = billDao.insertBill(billToInsert)

        return billToInsert.copy(id = insertedId)
    }

    suspend fun deleteTarget(target: SpreadsheetTarget) {
        targetDao.deleteTarget(target)

        // Delete physical file only if not referenced by any other target
        if (target.type == DestinationType.LOCAL_EXCEL && target.localFilePath != null) {
            try {
                val allRemaining = targetDao.getAllTargets()
                val isShared = allRemaining.any { it.id != target.id && it.localFilePath == target.localFilePath }
                if (!isShared) {
                    File(target.localFilePath).delete()
                }
            } catch (_: Exception) {}
        }

        // If the deleted target was active default, promote the first remaining target to active
        if (target.isActiveDefault) {
            val allRemaining = targetDao.getAllTargets()
            val nextTarget = allRemaining.firstOrNull { it.id != target.id }
            if (nextTarget != null) {
                targetDao.setActiveTarget(nextTarget.id)
            }
        }
    }
}

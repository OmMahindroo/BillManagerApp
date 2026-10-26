package com.billscanner.app.googlesheets

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.billscanner.app.data.model.BillRecord
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.sheets.v4.Sheets
import com.google.api.services.sheets.v4.SheetsScopes
import com.google.api.services.sheets.v4.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class GoogleSheetsManager(private val context: Context) {

    private val headers = listOf<Any>(
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

    private fun getSheetsService(account: GoogleSignInAccount): Sheets {
        val credential = GoogleAccountCredential.usingOAuth2(
            context,
            listOf(SheetsScopes.SPREADSHEETS, SheetsScopes.DRIVE_FILE)
        ).apply {
            selectedAccount = account.account
        }

        return Sheets.Builder(
            NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("BillScanner").build()
    }

    /**
     * Creates a new Google Spreadsheet in the user's Drive with header row and optional initial bill.
     * Returns Pair(spreadsheetId, spreadsheetUrl).
     */
    suspend fun createNewGoogleSheet(
        account: GoogleSignInAccount,
        title: String,
        initialBill: BillRecord? = null
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        val service = getSheetsService(account)

        val spreadsheet = Spreadsheet().apply {
            properties = SpreadsheetProperties().apply {
                this.title = title
            }
            sheets = listOf(
                Sheet().apply {
                    properties = SheetProperties().apply {
                        this.title = "Bills"
                    }
                }
            )
        }

        val created = service.spreadsheets().create(spreadsheet).execute()
        val spreadsheetId = created.spreadsheetId
        val spreadsheetUrl = created.spreadsheetUrl ?: "https://docs.google.com/spreadsheets/d/$spreadsheetId"

        // Insert Header row
        val values = mutableListOf<List<Any>>()
        values.add(headers)

        if (initialBill != null) {
            values.add(convertBillToRow(1, initialBill))
        }

        val body = ValueRange().setValues(values)
        service.spreadsheets().values()
            .append(spreadsheetId, "Bills!A1", body)
            .setValueInputOption("USER_ENTERED")
            .execute()

        Pair(spreadsheetId, spreadsheetUrl)
    }

    /**
     * Appends a bill row to an existing Google Spreadsheet.
     * Returns the updated row index.
     */
    suspend fun appendBillToGoogleSheet(
        account: GoogleSignInAccount,
        spreadsheetId: String,
        bill: BillRecord
    ): Int = withContext(Dispatchers.IO) {
        val service = getSheetsService(account)

        // Find existing row count to assign consecutive #
        val existingData = service.spreadsheets().values()
            .get(spreadsheetId, "Bills!A:A")
            .execute()
        val existingRows = existingData.getValues()?.size ?: 1
        val billIndex = existingRows // 1-based index (header is row 1)

        val rowData = convertBillToRow(billIndex, bill)
        val body = ValueRange().setValues(listOf(rowData))

        service.spreadsheets().values()
            .append(spreadsheetId, "Bills!A:K", body)
            .setValueInputOption("USER_ENTERED")
            .execute()

        billIndex
    }

    private fun convertBillToRow(index: Int, bill: BillRecord): List<Any> {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        val formattedTimestamp = sdf.format(Date(bill.timestamp))

        return listOf(
            index,
            bill.date,
            bill.merchant,
            bill.totalAmount,
            bill.category,
            bill.tax,
            bill.subtotal,
            bill.invoiceNumber,
            bill.paymentMethod,
            bill.notes,
            formattedTimestamp
        )
    }

    fun getOpenSheetIntent(url: String): Intent {
        return Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    fun getShareSheetIntent(title: String, url: String): Intent {
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Google Sheet: $title")
            putExtra(Intent.EXTRA_TEXT, "Here is the bill spreadsheet '$title': $url")
        }
    }
}

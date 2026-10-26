package com.billscanner.app.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.billscanner.app.data.db.AppDatabase
import com.billscanner.app.data.model.BillRecord
import com.billscanner.app.data.model.SpreadsheetTarget
import com.billscanner.app.data.repository.BillRepository
import com.billscanner.app.excel.ExcelManager
import com.billscanner.app.googlesheets.GoogleAuthManager
import com.billscanner.app.googlesheets.GoogleSheetsManager
import com.billscanner.app.ocr.ParsedBillData
import com.billscanner.app.ocr.TextRecognizerHelper
import com.billscanner.app.ui.components.DestinationChoice
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val database = AppDatabase.getDatabase(application)
    val excelManager = ExcelManager(application)
    val googleSheetsManager = GoogleSheetsManager(application)
    val googleAuthManager = GoogleAuthManager(application)
    private val textRecognizerHelper = TextRecognizerHelper(application)

    private val repository = BillRepository(
        billDao = database.billDao(),
        targetDao = database.spreadsheetTargetDao(),
        excelManager = excelManager,
        googleSheetsManager = googleSheetsManager
    )

    // Data Flows
    val activeTarget: StateFlow<SpreadsheetTarget?> = repository.activeTargetFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val allTargets: StateFlow<List<SpreadsheetTarget>> = repository.allTargetsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recentBills: StateFlow<List<BillRecord>> = repository.recentBillsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allBills: StateFlow<List<BillRecord>> = database.billDao().getAllBillsFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val totalBillsCount: StateFlow<Int> = repository.totalBillsCountFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val totalExpenseSum: StateFlow<Double> = repository.totalExpenseSumFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    // Scanning & Review State
    private val _isProcessingOcr = MutableStateFlow(false)
    val isProcessingOcr: StateFlow<Boolean> = _isProcessingOcr.asStateFlow()

    private val _currentReviewBill = MutableStateFlow<BillRecord?>(null)
    val currentReviewBill: StateFlow<BillRecord?> = _currentReviewBill.asStateFlow()

    private val _showDestinationDialog = MutableStateFlow(false)
    val showDestinationDialog: StateFlow<Boolean> = _showDestinationDialog.asStateFlow()

    private val _googleAccount = MutableStateFlow<GoogleSignInAccount?>(googleAuthManager.getSignedInAccount())
    val googleAccount: StateFlow<GoogleSignInAccount?> = _googleAccount.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    fun onImageScanned(imageUri: Uri) {
        viewModelScope.launch {
            _isProcessingOcr.value = true
            try {
                val parsed = textRecognizerHelper.recognizeFromUri(imageUri)
                _currentReviewBill.value = BillRecord(
                    merchant = parsed.merchant.ifEmpty { "Store" },
                    date = parsed.date,
                    invoiceNumber = parsed.invoiceNumber,
                    category = parsed.category.title,
                    subtotal = parsed.subtotal,
                    tax = parsed.tax,
                    totalAmount = parsed.totalAmount,
                    imageUri = imageUri.toString(),
                    rawOcrText = parsed.rawText
                )
            } catch (e: Exception) {
                _userMessage.emit("OCR Failed: ${e.localizedMessage}")
            } finally {
                _isProcessingOcr.value = false
            }
        }
    }

    fun updateReviewBill(bill: BillRecord) {
        _currentReviewBill.value = bill
    }

    fun openDestinationDialog() {
        _showDestinationDialog.value = true
    }

    fun dismissDestinationDialog() {
        _showDestinationDialog.value = false
    }

    fun clearReviewBill() {
        _currentReviewBill.value = null
    }

    fun saveBillWithDestinationChoice(choice: DestinationChoice) {
        val billToSave = _currentReviewBill.value ?: return
        dismissDestinationDialog()

        viewModelScope.launch {
            try {
                when (choice) {
                    is DestinationChoice.AppendToExisting -> {
                        repository.appendBillToExistingTarget(
                            target = choice.target,
                            bill = billToSave,
                            googleAccount = _googleAccount.value
                        )
                        _userMessage.emit("Saved to '${choice.target.name}' successfully!")
                    }
                    is DestinationChoice.CreateNewExcel -> {
                        val saved = repository.createAndSaveToNewExcel(
                            fileName = choice.fileName,
                            bill = billToSave,
                            setAsDefaultActive = choice.setAsDefault
                        )
                        _userMessage.emit("Created new Excel file '${choice.fileName}' and saved bill!")
                    }
                    is DestinationChoice.CreateNewGoogleSheet -> {
                        val account = _googleAccount.value
                        if (account == null) {
                            _userMessage.emit("Please sign in to Google to create a Google Sheet")
                            return@launch
                        }
                        repository.createAndSaveToNewGoogleSheet(
                            account = account,
                            title = choice.title,
                            bill = billToSave,
                            setAsDefaultActive = choice.setAsDefault
                        )
                        _userMessage.emit("Created new Google Sheet '${choice.title}' in Google Drive!")
                    }
                }
                clearReviewBill()
            } catch (t: Throwable) {
                t.printStackTrace()
                android.util.Log.e("BillScanner", "Error saving bill", t)
                _userMessage.emit("Error saving bill: ${t.localizedMessage ?: t.javaClass.simpleName}")
            }
        }
    }

    fun exportSpreadsheetToDownloads(target: SpreadsheetTarget) {
        val path = target.localFilePath ?: return
        val file = java.io.File(path)
        if (file.exists()) {
            val exported = excelManager.exportToPublicFolder(file)
            viewModelScope.launch {
                if (exported != null) {
                    _userMessage.emit("Exported to Downloads: ${exported.name}")
                } else {
                    _userMessage.emit("Failed to export to Downloads")
                }
            }
        }
    }

    fun setActiveTarget(targetId: Long) {
        viewModelScope.launch {
            repository.setActiveTarget(targetId)
            _userMessage.emit("Active spreadsheet updated")
        }
    }

    fun deleteTarget(target: SpreadsheetTarget) {
        viewModelScope.launch {
            repository.deleteTarget(target)
            _userMessage.emit("Spreadsheet '${target.name}' deleted")
        }
    }

    fun deleteBill(bill: BillRecord) {
        viewModelScope.launch {
            database.billDao().deleteBill(bill)
            _userMessage.emit("Bill record deleted")
        }
    }

    fun setGoogleAccount(account: GoogleSignInAccount?) {
        _googleAccount.value = account
    }
}

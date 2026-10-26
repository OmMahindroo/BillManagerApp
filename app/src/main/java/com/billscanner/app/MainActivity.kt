package com.billscanner.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.billscanner.app.data.db.AppDatabase
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget
import com.billscanner.app.ocr.DocumentScannerHelper
import com.billscanner.app.ui.components.DestinationSelectionDialog
import com.billscanner.app.ui.screens.*
import com.billscanner.app.ui.theme.BillScannerTheme
import com.billscanner.app.viewmodel.MainViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()
    private lateinit var documentScannerHelper: DocumentScannerHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        documentScannerHelper = DocumentScannerHelper(this)

        // Observe user messages for Toasts
        lifecycleScope.launch {
            viewModel.userMessage.collect { message ->
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        setContent {
            BillScannerTheme {
                MainAppContent()
            }
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun MainAppContent() {
        var selectedScreen by remember { mutableStateOf("dashboard") }

        val activeTarget by viewModel.activeTarget.collectAsStateWithLifecycle()
        val allTargets by viewModel.allTargets.collectAsStateWithLifecycle()
        val recentBills by viewModel.recentBills.collectAsStateWithLifecycle()
        val allBills by viewModel.allBills.collectAsStateWithLifecycle()
        val totalBillsCount by viewModel.totalBillsCount.collectAsStateWithLifecycle()
        val totalExpenseSum by viewModel.totalExpenseSum.collectAsStateWithLifecycle()
        val isProcessingOcr by viewModel.isProcessingOcr.collectAsStateWithLifecycle()
        val currentReviewBill by viewModel.currentReviewBill.collectAsStateWithLifecycle()
        val showDestinationDialog by viewModel.showDestinationDialog.collectAsStateWithLifecycle()
        val googleAccount by viewModel.googleAccount.collectAsStateWithLifecycle()

        // Document Scanner Launcher
        val scannerLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val gmsResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
                val imageUri = documentScannerHelper.extractScannedImageUri(gmsResult)
                if (imageUri != null) {
                    viewModel.onImageScanned(imageUri)
                } else {
                    Toast.makeText(this, "Failed to retrieve scanned image", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Gallery Photo Picker fallback
        val galleryPickerLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.GetContent()
        ) { uri: Uri? ->
            if (uri != null) {
                viewModel.onImageScanned(uri)
            }
        }

        // Google Sign-In Launcher
        val googleSignInLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                viewModel.setGoogleAccount(account)
                Toast.makeText(this, "Connected as ${account.email}", Toast.LENGTH_SHORT).show()
            } catch (e: ApiException) {
                android.util.Log.e("BillScanner", "Google Sign-In failed code=${e.statusCode}: ${e.message}", e)
                when (e.statusCode) {
                    10 -> {
                        Toast.makeText(
                            this,
                            "Google Cloud Setup required for live Sheets sync. Tap '?' in Spreadsheets tab for details. (Excel files can be opened in Sheets directly!)",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                    12501 -> {
                        Toast.makeText(this, "Sign-in canceled", Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        Toast.makeText(this, "Google Sign-In code ${e.statusCode}: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (t: Throwable) {
                t.printStackTrace()
                Toast.makeText(this, "Google Sign-In error: ${t.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }

        fun launchScanner() {
            lifecycleScope.launch {
                try {
                    val intentSender = documentScannerHelper.getStartScanIntentSender(this@MainActivity)
                    scannerLauncher.launch(IntentSenderRequest.Builder(intentSender).build())
                } catch (e: Exception) {
                    // Fallback to gallery / photo picker if Google Play Services document scanner is unavailable
                    Toast.makeText(this@MainActivity, "Launching photo selector...", Toast.LENGTH_SHORT).show()
                    galleryPickerLauncher.launch("image/*")
                }
            }
        }

        fun openSpreadsheet(target: SpreadsheetTarget) {
            try {
                if (target.type == DestinationType.LOCAL_EXCEL) {
                    val file = target.localFilePath?.let { File(it) }
                    if (file != null && file.exists()) {
                        startActivity(viewModel.excelManager.getOpenFileIntent(file))
                    } else {
                        Toast.makeText(this@MainActivity, "Excel file not found", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val url = target.googleSpreadsheetUrl
                    if (url != null) {
                        startActivity(viewModel.googleSheetsManager.getOpenSheetIntent(url))
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "No app available to open this spreadsheet", Toast.LENGTH_SHORT).show()
            }
        }

        fun shareSpreadsheet(target: SpreadsheetTarget) {
            try {
                if (target.type == DestinationType.LOCAL_EXCEL) {
                    val file = target.localFilePath?.let { File(it) }
                    if (file != null && file.exists()) {
                        val shareIntent = viewModel.excelManager.getShareFileIntent(file)
                        startActivity(Intent.createChooser(shareIntent, "Share Excel Spreadsheet"))
                    }
                } else {
                    val url = target.googleSpreadsheetUrl
                    if (url != null) {
                        val shareIntent = viewModel.googleSheetsManager.getShareSheetIntent(target.name, url)
                        startActivity(Intent.createChooser(shareIntent, "Share Google Sheet"))
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Failed to share: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }

        // Loading Overlay while OCR is parsing
        if (isProcessingOcr) {
            Surface(
                color = MaterialTheme.colorScheme.scrim.copy(alpha = 0.6f),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Card(
                        shape = MaterialTheme.shapes.medium,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(24.dp)
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Analyzing Bill with ML Kit OCR...", style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
        }

        // If a bill is currently under review, show BillReviewScreen
        if (currentReviewBill != null) {
            BillReviewScreen(
                bill = currentReviewBill!!,
                onBillChange = { viewModel.updateReviewBill(it) },
                onSaveClick = { viewModel.openDestinationDialog() },
                onDiscardClick = { viewModel.clearReviewBill() }
            )
        } else {
            // Main App Navigation Shell
            Scaffold(
                bottomBar = {
                    NavigationBar {
                        NavigationBarItem(
                            selected = selectedScreen == "dashboard",
                            onClick = { selectedScreen = "dashboard" },
                            icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                            label = { Text("Dashboard") }
                        )
                        NavigationBarItem(
                            selected = selectedScreen == "spreadsheets",
                            onClick = { selectedScreen = "spreadsheets" },
                            icon = { Icon(Icons.Default.TableChart, contentDescription = "Spreadsheets") },
                            label = { Text("Spreadsheets") }
                        )
                        NavigationBarItem(
                            selected = selectedScreen == "history",
                            onClick = { selectedScreen = "history" },
                            icon = { Icon(Icons.Default.History, contentDescription = "History") },
                            label = { Text("History") }
                        )
                    }
                },
                floatingActionButton = {
                    FloatingActionButton(
                        onClick = { launchScanner() },
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary
                    ) {
                        Icon(Icons.Default.DocumentScanner, contentDescription = "Scan Bill")
                    }
                }
            ) { padding ->
                Box(modifier = Modifier.padding(padding)) {
                    when (selectedScreen) {
                        "dashboard" -> DashboardScreen(
                            activeTarget = activeTarget,
                            totalBillsCount = totalBillsCount,
                            totalExpenseSum = totalExpenseSum,
                            recentBills = recentBills,
                            onScanClick = { launchScanner() },
                            onSwitchTargetClick = { selectedScreen = "spreadsheets" },
                            onViewAllBillsClick = { selectedScreen = "history" },
                            onBillClick = { bill ->
                                Toast.makeText(this@MainActivity, "${bill.merchant}: $${bill.totalAmount}", Toast.LENGTH_SHORT).show()
                            }
                        )
                        "spreadsheets" -> SpreadsheetsScreen(
                            targets = allTargets,
                            googleAccount = googleAccount,
                            onGoogleSignInClick = { googleSignInLauncher.launch(viewModel.googleAuthManager.getSignInIntent()) },
                            onGoogleSignOutClick = { viewModel.googleAuthManager.signOut { viewModel.setGoogleAccount(null) } },
                            onSetDefault = { viewModel.setActiveTarget(it.id) },
                            onOpen = { openSpreadsheet(it) },
                            onShare = { shareSpreadsheet(it) },
                            onExport = { viewModel.exportSpreadsheetToDownloads(it) },
                            onDelete = { viewModel.deleteTarget(it) },
                            onCreateNewExcel = { name ->
                                val target = SpreadsheetTarget(
                                    name = if (name.endsWith(".xlsx")) name else "$name.xlsx",
                                    type = DestinationType.LOCAL_EXCEL,
                                    isActiveDefault = true
                                )
                                lifecycleScope.launch {
                                    try {
                                        val (file, _) = viewModel.excelManager.createNewWorkbook(name)
                                        val id = AppDatabase.getDatabase(this@MainActivity).spreadsheetTargetDao().insertTarget(
                                            target.copy(localFilePath = file.absolutePath)
                                        )
                                        viewModel.setActiveTarget(id)
                                        Toast.makeText(this@MainActivity, "Created '${file.name}'", Toast.LENGTH_SHORT).show()
                                    } catch (t: Throwable) {
                                        t.printStackTrace()
                                        Toast.makeText(this@MainActivity, "Creation failed: ${t.localizedMessage}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            },
                            onCreateNewGoogleSheet = { title ->
                                val account = googleAccount
                                if (account != null) {
                                    lifecycleScope.launch {
                                        val (sheetId, sheetUrl) = viewModel.googleSheetsManager.createNewGoogleSheet(account, title)
                                        AppDatabase.getDatabase(this@MainActivity).spreadsheetTargetDao().insertTarget(
                                            SpreadsheetTarget(
                                                name = title,
                                                type = DestinationType.GOOGLE_SHEETS,
                                                googleSpreadsheetId = sheetId,
                                                googleSpreadsheetUrl = sheetUrl,
                                                isActiveDefault = true
                                            )
                                        )
                                    }
                                } else {
                                    Toast.makeText(this@MainActivity, "Please connect Google account first", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                        "history" -> BillHistoryScreen(
                            bills = allBills,
                            onBillClick = { bill ->
                                Toast.makeText(this@MainActivity, "Bill #${bill.invoiceNumber} - $${bill.totalAmount}", Toast.LENGTH_SHORT).show()
                            },
                            onDeleteBill = { viewModel.deleteBill(it) }
                        )
                    }
                }
            }
        }

        // Destination Selection Dialog (Add to Current vs Create New Excel vs Create New Google Sheet)
        if (showDestinationDialog) {
            DestinationSelectionDialog(
                activeTarget = activeTarget,
                existingTargets = allTargets,
                onConfirm = { choice ->
                    viewModel.saveBillWithDestinationChoice(choice)
                },
                onDismiss = { viewModel.dismissDestinationDialog() }
            )
        }
    }
}
